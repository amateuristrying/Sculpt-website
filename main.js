import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG, RESULTS } from './config.js';

const { gsap, ScrollTrigger, SplitText } = window;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const ACCENT = new THREE.Color('#dcf2b4');

/* ─────────────────────────── Links from config ─────────────────────────── */
const LINKS = {
  mac: CONFIG.macDownloadUrl,
  windows: CONFIG.windowsNotifyUrl,
  repo: CONFIG.repoUrl,
  feedback: CONFIG.feedbackUrl,
  license: `${CONFIG.repoUrl}/blob/main/LICENSE`,
};
document.querySelectorAll('[data-link]').forEach((a) => {
  const href = LINKS[a.dataset.link];
  if (href) a.href = href;
  if (/^https?:/.test(a.href) && a.dataset.link !== 'mac') { a.target = '_blank'; a.rel = 'noopener'; }
});
document.querySelectorAll('[data-version]').forEach((el) => (el.textContent = `v${CONFIG.version}`));

/* ─────────────────────────── Math helpers ─────────────────────────── */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ramp = (p, a, b) => clamp((p - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const sramp = (p, a, b) => smooth(ramp(p, a, b));
const lerp = (a, b, t) => a + (b - a) * t;

function hash3(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u), x10 = lerp(c(0, 1, 0), c(1, 1, 0), u);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), u), x11 = lerp(c(0, 1, 1), c(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w) * 2 - 1;
}
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/* ─────────────────────────── Procedural stand-in models ─────────────────────────── */
function lathe(profile, divisions, segments) {
  const pts = new THREE.SplineCurve(profile.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(divisions);
  return { geo: new THREE.LatheGeometry(pts, segments), count: pts.length };
}
function finish(geo) {
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const merged = mergeVertices(geo, 1e-4);
  merged.computeVertexNormals();
  return merged;
}
const col = (hex) => new THREE.Color(hex);

function buildVase(divisions = 140, segments = 160) {
  const { geo } = lathe(
    [[0, 0], [0.26, 0], [0.33, 0.02], [0.45, 0.12], [0.58, 0.34], [0.6, 0.48], [0.53, 0.68], [0.36, 0.88],
      [0.22, 1.02], [0.205, 1.12], [0.25, 1.22], [0.285, 1.27], [0.265, 1.285], [0.22, 1.24], [0.17, 1.14]],
    divisions, segments,
  );
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const clayA = col('#a35a3b'), clayB = col('#c27a52'), glazeA = col('#c9dcb3'), glazeB = col('#93ad7c'), edge = col('#5f7748');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const th = Math.atan2(z, x);
    const rib = Math.sin(th * 18 + y * 2.4);
    if (r > 1e-4) {
      const env = sramp(y, 0.06, 0.3) * (1 - sramp(y, 0.98, 1.12));
      const nr = r + env * 0.016 * rib + 0.01 * noise3(x * 5, y * 5, z * 5);
      x = (x / r) * nr; z = (z / r) * nr;
      pos.setXYZ(i, x, y, z);
    }
    const drip = 0.6 + 0.1 * Math.sin(th * 5 + 1.3) + 0.05 * Math.sin(th * 11 + 0.4) + 0.05 * noise3(x * 3, 0, z * 3)
      - 0.12 * Math.max(0, Math.sin(th * 7 + 2)) ** 6;
    const g = smooth(clamp((y - drip + 0.02) / 0.04));
    const n = noise3(x * 9, y * 9, z * 9) * 0.5 + 0.5;
    const clay = c.copy(clayA).lerp(clayB, n * 0.6 + (y < 0.03 ? 0.4 : 0)).clone();
    const glaze = glazeA.clone().lerp(glazeB, 0.15 + 0.35 * (0.5 - rib * 0.5) + 0.15 * n);
    const nearEdge = Math.exp(-(((y - drip) / 0.025) ** 2));
    c.copy(clay).lerp(glaze, g).lerp(edge, nearEdge * 0.55);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return finish(geo);
}

function buildMushroom(divisions = 90, segments = 120) {
  // stem
  const stem = lathe([[0, 0], [0.15, 0], [0.185, 0.03], [0.16, 0.2], [0.13, 0.45], [0.115, 0.66], [0.11, 0.76], [0, 0.76]], 60, segments).geo;
  {
    const pos = stem.attributes.position, colors = new Float32Array(pos.count * 3);
    const cream = col('#e7dcc4'), fiber = col('#c9b796'), dirt = col('#6a5035'), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), r = Math.hypot(x, z);
      if (r > 1e-4) {
        const nr = r + 0.006 * noise3(x * 30, y * 4, z * 30);
        pos.setX(i, (x / r) * nr); pos.setZ(i, (z / r) * nr);
      }
      c.copy(cream).lerp(fiber, (noise3(x * 40, y * 3, z * 40) * 0.5 + 0.5) * 0.5).lerp(dirt, 1 - sramp(y, 0.02, 0.12));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    stem.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  // cap
  const capProfile = [[0, 1.08], [0.2, 1.06], [0.38, 0.99], [0.5, 0.88], [0.575, 0.77], [0.585, 0.715], [0.545, 0.695], [0.4, 0.715], [0.2, 0.735], [0.1, 0.745], [0, 0.75]];
  const { geo: cap, count } = lathe(capProfile, divisions, segments);
  {
    const pos = cap.attributes.position, colors = new Float32Array(pos.count * 3);
    const red = col('#b3321f'), orange = col('#d2612b'), spot = col('#f1ead8'), gill = col('#ece1c8'), gillDark = col('#c8b48f'), c = new THREE.Color();
    const rnd = seeded(7), spots = [];
    for (let s = 0; s < 22; s++) {
      const th = rnd() * Math.PI * 2, ph = 0.12 + rnd() * 1.0;
      spots.push({ d: new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)), r: 0.07 + rnd() * 0.08 });
    }
    const center = new THREE.Vector3(0, 0.55, 0), v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const j = i % count, t = j / (count - 1);
      let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const th = Math.atan2(z, x), r = Math.hypot(x, z);
      if (t < 0.5) {
        v.set(x, y, z).sub(center).normalize();
        let s = 0;
        for (const sp of spots) s = Math.max(s, 1 - sramp(v.angleTo(sp.d), sp.r * 0.7, sp.r));
        const bump = 0.012 * s + 0.008 * noise3(x * 6, y * 6, z * 6);
        x += v.x * bump; y += v.y * bump; z += v.z * bump;
        pos.setXYZ(i, x, y, z);
        c.copy(red).lerp(orange, sramp(r, 0.25, 0.58) * 0.7).lerp(spot, s * 0.95);
      } else {
        c.copy(gill).lerp(gillDark, (Math.sin(th * 110) * 0.5 + 0.5) * 0.55 * sramp(r, 0.12, 0.3));
      }
      colors.set([c.r, c.g, c.b], i * 3);
    }
    cap.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    cap.rotateZ(-0.08); cap.rotateX(0.05); cap.translate(0.04, 0.03, 0);
  }
  return mergeGeometries([finish(stem), finish(cap)]);
}

function buildDuck(w = 64, h = 44) {
  const parts = [];
  const part = (geo, hex, fn) => {
    geo.deleteAttribute('uv');
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), base = col(hex), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      if (fn) fn(pos, i);
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      c.copy(base).multiplyScalar(0.94 + 0.06 * noise3(x * 8, y * 8, z * 8));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(finish(geo));
  };
  const body = new THREE.SphereGeometry(0.5, w, h);
  body.scale(1.25, 0.82, 0.92);
  body.translate(0, 0.45, 0);
  part(body, '#f3c22e', (pos, i) => {
    const x = pos.getX(i); let y = pos.getY(i);
    y += sramp(-x, 0.3, 0.66) * (y > 0.45 ? 0.22 : 0.1);
    if (y < 0.1) y = 0.1 + (y - 0.1) * 0.25;
    pos.setY(i, y);
  });
  const head = new THREE.SphereGeometry(0.3, w, h); head.translate(0.4, 1.0, 0); part(head, '#f3c22e');
  const beak = new THREE.SphereGeometry(0.15, w / 2, h / 2); beak.scale(1.5, 0.42, 1.05); beak.translate(0.73, 0.94, 0); part(beak, '#e9762a');
  for (const s of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.042, 16, 12); eye.translate(0.6, 1.07, s * 0.166); part(eye, '#121212');
    const wing = new THREE.SphereGeometry(0.26, w / 2, h / 2); wing.scale(1.35, 0.62, 0.3); wing.rotateZ(-0.22); wing.translate(-0.06, 0.56, s * 0.38); part(wing, '#e8b126');
  }
  return mergeGeometries(parts);
}

const BUILDERS = { vase: buildVase, mushroom: buildMushroom, duck: buildDuck };

function fitGeometry(geo, height = 1.3) {
  geo.computeBoundingBox();
  const b = geo.boundingBox, size = new THREE.Vector3(), center = new THREE.Vector3();
  b.getSize(size); b.getCenter(center);
  geo.translate(-center.x, -b.min.y, -center.z);
  geo.scale(height / size.y, height / size.y, height / size.y);
  return geo;
}

/* ─────────────────────────── Shared three.js bits ─────────────────────────── */
function makeRenderer(canvas, alpha = true) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}
function studio(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;
  pmrem.dispose();
  const key = new THREE.DirectionalLight('#fff6ea', 1.6); key.position.set(-2.5, 4, 3); scene.add(key);
  const rim = new THREE.DirectionalLight('#dcf2b4', 0.9); rim.position.set(3, 2, -3); scene.add(rim);
}
let shadowTex;
function contactShadow(size = 1.9, opacity = 0.6) {
  if (!shadowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(0,0,0,0.85)'); grd.addColorStop(0.45, 'rgba(0,0,0,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.7), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.002;
  return m;
}
function fitCamera(camera, aspect, height = 1.3, margin = 1.5, width = height * 0.9) {
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const dV = (height * margin) / 2 / Math.tan(vfov / 2);
  const dH = (width * margin) / 2 / Math.tan(vfov / 2) / aspect;
  return Math.max(dV, dH);
}

/* Pipeline material: vertex color ↔ clay, mask tint, raw-reconstruction roughness */
function pipelineMaterial() {
  const U = {
    uColorMix: { value: 1 }, uMask: { value: 0 }, uRough: { value: 0 },
    uAccent: { value: ACCENT.clone() }, uClay: { value: new THREE.Color('#9fa59f') },
  };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0, side: THREE.DoubleSide, transparent: true });
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = 'uniform float uRough;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float nz = sin(position.x*31.0+position.y*17.0)*sin(position.y*29.0-position.z*23.0)*sin(position.z*37.0+position.x*13.0);
      float nz2 = sin(position.x*83.0-position.y*61.0)*sin(position.z*71.0+position.y*53.0);
      transformed += objectNormal * (nz*0.032 + nz2*0.012) * uRough;`);
    s.fragmentShader = 'uniform float uColorMix; uniform float uMask; uniform vec3 uAccent; uniform vec3 uClay;\n' + s.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = mix(uClay, diffuseColor.rgb, uColorMix);
        diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, uMask * 0.55);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uAccent * uMask * 0.22;`);
  };
  mat.userData.U = U;
  return mat;
}

/* ═══════════════════════════ HERO — logo shards as a point cloud ═══════════════════════════ */
const hero = (() => {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return null;
  let renderer;
  try { renderer = makeRenderer(canvas); } catch { canvas.remove(); return null; }
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  // The two parallelogram shards from the Sculpt icon, extruded.
  const S = 1 / 6.2;
  const shape = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2((x - 16) * S, -(y - 18) * S)));
  const extrude = { depth: 0.55, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3 };
  const shards = [
    { geo: new THREE.ExtrudeGeometry(shape([[28, 3], [12, 3], [3, 17], [18, 17]]), extrude), alpha: 1, n: 9000 },
    { geo: new THREE.ExtrudeGeometry(shape([[4, 33], [20, 33], [29, 19], [14, 19]]), extrude), alpha: 0.55, n: 9000 },
  ];
  const total = shards.reduce((a, s) => a + s.n, 0) + 1400;
  const position = new Float32Array(total * 3), scatter = new Float32Array(total * 3), rand = new Float32Array(total), alpha = new Float32Array(total);
  const p = new THREE.Vector3(), rnd = seeded(42);
  let k = 0;
  for (const s of shards) {
    s.geo.translate(0, 0, -0.275);
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(s.geo)).build();
    for (let i = 0; i < s.n; i++, k++) {
      sampler.sample(p);
      position.set([p.x, p.y, p.z], k * 3);
      alpha[k] = s.alpha; rand[k] = rnd();
    }
  }
  for (; k < total; k++) { // ambient dust
    const r = 3 + rnd() * 6, th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
    position.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.6, r * Math.sin(ph) * Math.sin(th) - 2], k * 3);
    alpha[k] = 0.35; rand[k] = rnd() * 0.6;
  }
  for (let i = 0; i < total; i++) {
    const r = 2 + rnd() * 7, th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
    scatter.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  const uniforms = {
    uTime: { value: 0 }, uAssemble: { value: reduced ? 1 : 0 }, uScatter: { value: 0 },
    uSize: { value: 26 * DPR }, uColor: { value: ACCENT.clone() }, uOpacity: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime, uAssemble, uScatter, uSize;
      attribute vec3 aScatter; attribute float aRand; attribute float aAlpha;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p += vec3(sin(uTime*.7 + aRand*40.), cos(uTime*.55 + aRand*70.), sin(uTime*.45 + aRand*90.)) * .018;
        float k = (1.0 - uAssemble) + uScatter;
        float e = k * (0.6 + aRand * 0.8);
        p += aScatter * e;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (0.35 + aRand * 0.9) / -mv.z;
        float tw = 0.65 + 0.35 * sin(uTime * 1.6 + aRand * 60.0);
        vAlpha = aAlpha * tw * (0.25 + 0.75 * aRand) * (1.0 - clamp(uScatter * 0.7, 0.0, 0.85));
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor, a * vAlpha * uOpacity * 0.7);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  const group = new THREE.Group(); group.add(points); scene.add(group);

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  if (finePointer) addEventListener('pointermove', (e) => { mouse.tx = e.clientX / innerWidth - 0.5; mouse.ty = e.clientY / innerHeight - 0.5; });

  let active = true;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect; camera.updateProjectionMatrix();
    camera.position.z = 9;
    // Size of the visible plane at the sculpture's depth.
    const visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const visW = visH * aspect;
    if (w <= 900 || aspect < 0.9) { // keep in sync with the 900px hero breakpoint in styles.css
      // Phones / portrait: sculpture sits in the upper half, copy below it.
      const s = Math.min(visW * 0.5, visH * 0.24) / 4.8;
      group.scale.setScalar(s);
      group.position.set(0, visH * 0.3, 0);
    } else {
      // Desktop: copy on the left, sculpture centred in the right half.
      const s = Math.min(visH * 0.8, visW * 0.42) / 4.8;
      group.scale.setScalar(s);
      group.position.set(visW * (aspect > 1.3 ? 0.23 : 0.27), 0, 0);
    }
  }
  resize(); addEventListener('resize', resize);

  return {
    uniforms, group,
    setActive(v) { active = v; },
    tick(t) {
      if (!active) return;
      uniforms.uTime.value = t;
      mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04;
      group.rotation.y = Math.sin(t * 0.22) * 0.42 + mouse.x * 0.6;
      group.rotation.x = Math.sin(t * 0.17) * 0.12 + mouse.y * 0.35;
      renderer.render(scene, camera);
    },
  };
})();

/* ═══════════════════════════ PIPELINE — photo → mask → points → mesh → textured ═══════════════════════════ */
const pipeline = (() => {
  const canvas = document.getElementById('pipeline');
  const viewport = document.getElementById('viewport');
  let renderer;
  try { renderer = makeRenderer(canvas); } catch { return null; }
  const scene = new THREE.Scene();
  studio(renderer, scene);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  const target = new THREE.Vector3(0, 0.64, 0);

  const geo = fitGeometry(buildVase(), 1.3);
  const mat = pipelineMaterial();
  const U = mat.userData.U;
  const mesh = new THREE.Mesh(geo, mat);
  const shadow = contactShadow(1.9, 0.65);

  // wireframe, from a lighter build of the same shape
  const wireGeo = new THREE.WireframeGeometry(fitGeometry(buildVase(44, 56), 1.3));
  const wireMat = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, depthWrite: false });
  const wire = new THREE.LineSegments(wireGeo, wireMat); wire.scale.setScalar(1.004);

  // points: start flattened into the photo plane, extrude into depth
  const pos = geo.attributes.position;
  const offs = new Float32Array(pos.count * 3), rnd = seeded(3);
  for (let i = 0; i < pos.count; i++) {
    offs.set([(rnd() - 0.5) * 0.02, (rnd() - 0.5) * 0.02, -pos.getZ(i) + (rnd() - 0.5) * 0.01], i * 3);
  }
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', pos.clone());
  pgeo.setAttribute('aOffset', new THREE.BufferAttribute(offs, 3));
  const pU = { uSpread: { value: 1 }, uOpacity: { value: 0 }, uSize: { value: 9 * DPR }, uColor: { value: ACCENT.clone() }, uTime: { value: 0 } };
  const pmat = new THREE.ShaderMaterial({
    uniforms: pU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uSpread, uSize, uTime; attribute vec3 aOffset; varying float vD;
      void main() {
        vec3 p = position + aOffset * uSpread;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize / -mv.z;
        vD = position.y;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity; uniform float uTime; varying float vD;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float scan = smoothstep(0.08, 0.0, abs(fract(vD * 0.8 - uTime * 0.35) - 0.5));
        gl_FragColor = vec4(uColor, (0.55 + scan * 0.6) * uOpacity);
      }`,
  });
  const cloud = new THREE.Points(pgeo, pmat);

  const obj = new THREE.Group();
  obj.add(mesh, wire, cloud);
  scene.add(obj, shadow);

  const photo = document.getElementById('photoLayer');
  const checker = document.getElementById('checkerLayer');
  let aspect = 1, baseDist = 4;
  function resize() {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    aspect = w / h; camera.aspect = aspect; camera.updateProjectionMatrix();
    baseDist = fitCamera(camera, aspect, 1.3, 1.45, 1.4);
  }
  new ResizeObserver(resize).observe(viewport);
  resize();

  let idle = 0, active = false;
  return {
    setActive(v) { active = v; },
    tick(t, dt, p) {
      if (!active) return;
      // stage 1–2: photo → mask
      photo.style.opacity = String(1 - sramp(p, 0.2, 0.27));
      checker.style.opacity = String(sramp(p, 0.21, 0.28) * (1 - sramp(p, 0.42, 0.5)));
      U.uMask.value = sramp(p, 0.21, 0.27) * (1 - sramp(p, 0.36, 0.42)) * (0.85 + 0.15 * Math.sin(t * 4));
      // stage 3: solid → flattened points → extruded points
      const solidOut = sramp(p, 0.4, 0.44), solidIn = sramp(p, 0.55, 0.62);
      mat.opacity = 1 - solidOut + solidIn;
      mat.depthWrite = mat.opacity > 0.98;
      mesh.visible = mat.opacity > 0.002;
      pU.uOpacity.value = sramp(p, 0.4, 0.44) * (1 - sramp(p, 0.57, 0.63));
      pU.uSpread.value = 1 - sramp(p, 0.44, 0.56);
      pU.uTime.value = t;
      cloud.visible = pU.uOpacity.value > 0.002;
      // stage 4: noisy raw mesh → refined, with wireframe
      U.uRough.value = sramp(p, 0.5, 0.55) * (1 - sramp(p, 0.63, 0.75));
      wireMat.opacity = 0.55 * sramp(p, 0.58, 0.64) * (1 - sramp(p, 0.76, 0.83));
      wire.visible = wireMat.opacity > 0.002;
      // stage 5: clay → baked color
      U.uColorMix.value = p < 0.5 ? 1 : sramp(p, 0.78, 0.86);
      shadow.material.opacity = 0.65 * (1 - 0.75 * pU.uOpacity.value);
      // motion
      if (!reduced) idle += dt * 0.35 * sramp(p, 0.8, 0.9);
      obj.rotation.y = sramp(p, 0.44, 0.64) * Math.PI * 1.25 + idle;
      const elev = sramp(p, 0.44, 0.62) * 0.3;
      const dist = baseDist * (1 - 0.05 * sramp(p, 0, 0.18) + 0.04 * sramp(p, 0.44, 0.6));
      camera.position.set(0, target.y + Math.sin(elev) * dist, Math.cos(elev) * dist);
      camera.lookAt(target);
      renderer.render(scene, camera);
    },
  };
})();

/* ═══════════════════════════ RESULTS — interactive cards ═══════════════════════════ */
const cards = [];
const clayMat = new THREE.MeshStandardMaterial({ color: '#a7aca6', roughness: 0.62, metalness: 0 });
const wireClay = new THREE.MeshStandardMaterial({ color: '#2a3030', roughness: 0.8, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const wireLine = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.4 });

function createCard(entry, index) {
  const el = document.createElement('article');
  el.className = 'card';
  const isSample = !entry.model;
  el.innerHTML = `
    <div class="card-stage">
      ${isSample ? '<span class="sample-tag" title="Built-in stand-in. Replace with a real Sculpt export in config.js">Sample</span>' : ''}
      <div class="views" role="group" aria-label="View mode">
        <button type="button" class="on" data-v="tex">Textured</button><button type="button" data-v="clay">Clay</button><button type="button" data-v="wire">Wire</button>
      </div>
      <div class="source"><b>Source</b><img alt="Source photo for ${entry.title}"></div>
      <span class="arrow" aria-hidden="true"></span>
      <canvas aria-label="3D model: ${entry.title}. Drag to rotate."></canvas>
    </div>
    <div class="card-foot"><h3></h3><p class="mono"></p></div>`;
  el.querySelector('h3').textContent = entry.title;
  el.querySelector('.card-foot p').textContent = entry.meta;
  document.getElementById('cards').appendChild(el);

  const stage = el.querySelector('.card-stage');
  const canvas = el.querySelector('canvas');
  const img = el.querySelector('.source img');
  if (entry.image) img.src = entry.image;

  let renderer;
  try { renderer = makeRenderer(canvas); } catch { stage.style.display = 'none'; return; }
  const scene = new THREE.Scene();
  studio(renderer, scene);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  const target = new THREE.Vector3(0, 0.62, 0);
  const holder = new THREE.Group();
  scene.add(holder, contactShadow(1.9, 0.55));

  const meshes = []; // { mesh, original, wire }
  const register = (root) => {
    root.traverse((o) => { if (o.isMesh) meshes.push({ mesh: o, original: o.material, wire: null }); });
  };
  let mode = 'tex';
  function setMode(m) {
    mode = m;
    for (const r of meshes) {
      r.mesh.material = m === 'tex' ? r.original : m === 'clay' ? clayMat : wireClay;
      if (m === 'wire' && !r.wire) {
        r.wire = new THREE.LineSegments(new THREE.WireframeGeometry(r.mesh.geometry), wireLine);
        r.mesh.add(r.wire);
      }
      if (r.wire) r.wire.visible = m === 'wire';
    }
    el.querySelectorAll('.views button').forEach((b) => b.classList.toggle('on', b.dataset.v === m));
  }
  el.querySelectorAll('.views button').forEach((b) => b.addEventListener('click', () => {
    setMode(b.dataset.v);
    gsap.fromTo(holder.scale, { x: 0.96, y: 0.96, z: 0.96 }, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
  }));

  let aspect = 1, dist = 4, extent = 1.2; // extent = widest horizontal span while turning
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    aspect = w / h; camera.aspect = aspect; camera.updateProjectionMatrix();
    dist = fitCamera(camera, aspect, 1.3, 1.45, extent);
  }
  const measure = (root) => {
    const v = new THREE.Vector3(); let r = 0;
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i += 7) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); r = Math.max(r, Math.hypot(v.x, v.z)); }
    });
    extent = Math.max(1.0, r * 2 * 0.92);
    resize();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  const state = { yaw: -0.5 + index * 0.4, vel: 0, pitch: 0.16, tPitch: 0.16, dragging: false, visible: false, ready: false };
  function place() {
    camera.position.set(0, target.y + Math.sin(state.pitch) * dist, Math.cos(state.pitch) * dist);
    camera.lookAt(target);
    holder.rotation.y = state.yaw;
  }

  function snapshotSource() {
    if (entry.image) return;
    const yaw = state.yaw, pitch = state.pitch;
    state.yaw = 0; state.pitch = 0.04; place();
    renderer.render(scene, camera);
    img.src = canvas.toDataURL('image/png');
    state.yaw = yaw; state.pitch = pitch;
  }

  if (entry.model) {
    new GLTFLoader().load(entry.model, (gltf) => {
      const root = gltf.scene;
      const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      const s = 1.3 / size.y;
      root.position.set(-c.x * s, -box.min.y * s, -c.z * s); root.scale.setScalar(s);
      holder.add(root); register(root); measure(holder); state.ready = true;
    }, undefined, (err) => console.warn('Sculpt: could not load', entry.model, err));
  } else {
    const geo = fitGeometry((BUILDERS[entry.sample] || buildVase)(), 1.3);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: entry.sample === 'vase' ? 0.36 : 0.55, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    holder.add(mesh); register(holder); measure(holder);
    state.ready = true;
    snapshotSource();
  }

  // drag to rotate, with inertia
  let lastX = 0, lastY = 0;
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.views')) return;
    state.dragging = true; lastX = e.clientX; lastY = e.clientY;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    state.vel = dx * 0.008; state.yaw += state.vel;
    state.tPitch = clamp(state.tPitch + dy * 0.004, -0.15, 0.7);
  });
  const end = () => { state.dragging = false; };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);

  new IntersectionObserver(([e]) => { state.visible = e.isIntersecting; }, { rootMargin: '100px' }).observe(stage);

  cards.push({
    tick(dt) {
      if (!state.visible || !state.ready) return;
      if (!state.dragging) {
        state.vel *= 0.94;
        state.yaw += state.vel + (reduced ? 0 : dt * 0.32);
        state.tPitch += (0.16 - state.tPitch) * 0.02;
      }
      state.pitch += (state.tPitch - state.pitch) * 0.12;
      place();
      renderer.render(scene, camera);
    },
  });
}
RESULTS.forEach(createCard);

/* ═══════════════════════════ GSAP ═══════════════════════════ */
const story = { p: 0, step: -1 };
const html = document.documentElement;

if (!gsap) {
  html.classList.add('ready');
  // Minimal fallback: drive the pipeline from native scroll.
  const el = document.querySelector('.story');
  let last = performance.now();
  (function loop(now) {
    const dt = (now - last) / 1000; last = now;
    const r = el.getBoundingClientRect();
    story.p = clamp(-r.top / (el.offsetHeight - innerHeight));
    pipeline?.setActive(true);
    hero?.tick(now / 1000);
    pipeline?.tick(now / 1000, dt, story.p);
    cards.forEach((c) => c.tick(dt));
    requestAnimationFrame(loop);
  })(last);
} else {
  gsap.registerPlugin(ScrollTrigger, SplitText);

  /* Smooth scroll */
  let lenis = null;
  if (window.Lenis && !reduced) {
    lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollTo = (y) => (lenis ? lenis.scrollTo(y, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) }) : scrollTo_(y));
  const scrollTo_ = (y) => window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const t = id === '#top' ? document.body : document.querySelector(id);
    if (!t) return;
    e.preventDefault();
    scrollTo(id === '#top' ? 0 : t.getBoundingClientRect().top + scrollY - (id === '#how' ? 0 : 40));
  }));

  /* Single render loop for every canvas */
  gsap.ticker.add((time, deltaMs) => {
    const dt = Math.min(deltaMs / 1000, 0.05);
    hero?.tick(time);
    pipeline?.tick(time, dt, story.p);
    cards.forEach((c) => c.tick(dt));
  });

  /* Nav state */
  ScrollTrigger.create({ start: 'top -40', end: 'max', toggleClass: { targets: '#nav', className: 'scrolled' } });

  /* Hero intro */
  document.fonts.ready.then(() => {
    const h1 = SplitText.create('.hero h1', { type: 'lines,words', mask: 'lines', linesClass: 'line-mask' });
    html.classList.add('ready');
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    if (hero && !reduced) tl.to(hero.uniforms.uAssemble, { value: 1, duration: 3.2, ease: 'expo.out' }, 0);
    tl.from('.nav', { y: -24, autoAlpha: 0, duration: 1.2 }, 0.2)
      .from(h1.words, { yPercent: 115, duration: 1.4, stagger: 0.045 }, 0.45)
      .from('.hero .lede', { y: 20, autoAlpha: 0, duration: 1.2 }, 0.9)
      .from('.hero .ctas > *', { y: 20, autoAlpha: 0, duration: 1.1, stagger: 0.08 }, 1.0)
      .from('.hero .meta', { autoAlpha: 0, duration: 1.2 }, 1.25)
      .from('.scroll-cue', { autoAlpha: 0, duration: 1 }, 1.5);
    if (reduced) tl.progress(1);
  });

  /* Hero leaves: particles scatter, text drifts up */
  if (hero) {
    gsap.to(hero.uniforms.uScatter, { value: 1.4, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 } });
    ScrollTrigger.create({ trigger: '.hero', start: 'top bottom', end: 'bottom top', onToggle: (s) => hero.setActive(s.isActive) });
  }
  gsap.to('.hero-inner', { yPercent: -18, autoAlpha: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: '75% top', scrub: true } });

  /* Pipeline: the app window rises into place, then the scroll drives the stages */
  const appWindow = document.querySelector('.app-window');
  gsap.set('.story-sticky', { perspective: 1400 });
  gsap.fromTo(appWindow, { rotateX: 16, y: 90, scale: 0.88, autoAlpha: 0.3 }, {
    rotateX: 0, y: 0, scale: 1, autoAlpha: 1, ease: 'none',
    scrollTrigger: { trigger: '.story', start: 'top 95%', end: 'top top', scrub: 0.8 },
  });
  gsap.from('.captions, .progress', { autoAlpha: 0, y: 30, ease: 'none', scrollTrigger: { trigger: '.story', start: 'top 40%', end: 'top top', scrub: true } });

  const stackItems = [...document.querySelectorAll('#stack li')];
  const caps = [...document.querySelectorAll('.cap')];
  const capSplits = caps.map((c) => SplitText.create(c.querySelector('h2'), { type: 'words', mask: 'words' }));
  const vpTag = document.getElementById('vpTag'), viewMode = document.getElementById('viewMode'), stepNum = document.getElementById('stepNum');
  const exportChips = document.querySelectorAll('#exports span');
  const TAGS = ['Source image', 'Foreground mask', 'Reconstruction', 'Refine · smoothing', 'Textured · baked color'];
  const MODES = ['View: Image', 'View: Mask', 'View: Points', 'View: Wireframe', 'View: Material'];
  let exportsShown = false;

  function setStep(i) {
    if (i === story.step) return;
    const prev = story.step;
    story.step = i;
    stackItems.forEach((li, k) => { li.classList.toggle('active', k === i); li.classList.toggle('done', k < i); });
    stepNum.textContent = String(i + 1).padStart(2, '0');
    viewMode.textContent = MODES[i];
    gsap.fromTo(vpTag, { autoAlpha: 0, y: -6 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'expo.out', onStart: () => (vpTag.textContent = TAGS[i]) });
    if (prev >= 0) gsap.to(caps[prev], { autoAlpha: 0, y: -16, duration: 0.35, ease: 'power2.in', overwrite: true });
    const cap = caps[i];
    gsap.set(cap, { autoAlpha: 1, y: 0 });
    gsap.fromTo(capSplits[i].words, { yPercent: 110 }, { yPercent: 0, duration: 0.9, stagger: 0.05, ease: 'expo.out', overwrite: true });
    gsap.fromTo([cap.querySelector('.eyebrow'), cap.querySelector('p:last-child')], { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08, ease: 'expo.out', delay: 0.1, overwrite: true });
    gsap.fromTo(stackItems[i].querySelector('.node'), { scale: 0.7 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.5)' });
  }
  setStep(0);

  const storyST = ScrollTrigger.create({
    trigger: '.story', start: 'top top', end: 'bottom bottom', scrub: 0.9,
    animation: gsap.to(story, { p: 1, ease: 'none' }),
    onUpdate: () => {
      setStep(Math.min(4, Math.floor(story.p * 5 + 0.0001)));
      gsap.set('#progressBar', { scaleX: story.p });
      const show = story.p > 0.86;
      if (show !== exportsShown) {
        exportsShown = show;
        gsap.to(exportChips, show
          ? { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.07, ease: 'back.out(2)', overwrite: true, startAt: { y: 10 } }
          : { autoAlpha: 0, y: 8, duration: 0.25, stagger: 0.03, overwrite: true });
      }
    },
  });
  ScrollTrigger.create({ trigger: '.story', start: 'top bottom', end: 'bottom top', onToggle: (s) => pipeline?.setActive(s.isActive) });

  stackItems.forEach((li, i) => li.addEventListener('click', () => {
    scrollTo(storyST.start + (storyST.end - storyST.start) * ((i + 0.55) / 5));
  }));

  /* Section reveals */
  document.querySelectorAll('.section-head h2, .specs h2').forEach((h) => {
    const s = SplitText.create(h, { type: 'words', mask: 'words' });
    gsap.from(s.words, { yPercent: 110, duration: 1.2, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 85%' } });
  });
  document.querySelectorAll('.section .reveal').forEach((el) => {
    gsap.from(el.querySelectorAll('.eyebrow, .sub, .spec-list > div, .note, .fit, h3, p, .num'), {
      y: 26, autoAlpha: 0, duration: 1.1, stagger: 0.06, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 82%' },
    });
  });
  gsap.from('.card', {
    y: 80, autoAlpha: 0, rotateX: 8, transformPerspective: 1000, duration: 1.4, stagger: 0.12, ease: 'expo.out',
    scrollTrigger: { trigger: '#cards', start: 'top 85%' },
  });

  /* Final: tagline lines rise letter by letter, glow breathes in */
  const tag = SplitText.create('.tagline > span', { type: 'chars', mask: 'lines' });
  gsap.from(tag.chars, {
    yPercent: 120, duration: 1.4, stagger: 0.018, ease: 'expo.out',
    scrollTrigger: { trigger: '.tagline', start: 'top 80%' },
  });
  gsap.from('.final .ctas > *', { y: 24, autoAlpha: 0, duration: 1.1, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: '.final .ctas', start: 'top 92%' } });
  gsap.fromTo('.final-glow', { scale: 0.6, autoAlpha: 0 }, { scale: 1.1, autoAlpha: 1, ease: 'none', scrollTrigger: { trigger: '.final', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  /* Magnetic buttons */
  if (finePointer && !reduced) {
    document.querySelectorAll('.btn-lg, .nav .btn').forEach((btn) => {
      const xTo = gsap.quickTo(btn, 'x', { duration: 0.6, ease: 'power3.out' });
      const yTo = gsap.quickTo(btn, 'y', { duration: 0.6, ease: 'power3.out' });
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.22);
        yTo((e.clientY - r.top - r.height / 2) * 0.3);
      });
      btn.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  addEventListener('load', () => ScrollTrigger.refresh());
}
