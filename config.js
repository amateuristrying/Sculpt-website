// ─────────────────────────────────────────────────────────────
// Sculpt landing page — everything you edit before launch lives here.
// ─────────────────────────────────────────────────────────────

export const CONFIG = {
  version: '0.1.0',
  // Point this at the versioned DMG once it is published
  // (e.g. https://github.com/amateuristrying/Sculpt/releases/download/v0.1.0/Sculpt_0.1.0_aarch64.dmg).
  macDownloadUrl: 'https://github.com/amateuristrying/Sculpt/releases/latest',
  repoUrl: 'https://github.com/amateuristrying/Sculpt',
  feedbackUrl: 'https://github.com/amateuristrying/Sculpt/issues/new',
  // Where "Windows — notify me" goes. Swap for a waitlist form when you have one.
  windowsNotifyUrl: 'https://github.com/amateuristrying/Sculpt/releases',
};

// Results gallery.
// Each card shows `model` (a GLB exported from Sculpt) and `image` (the source photo).
// Put files in /results and fill in the paths, e.g.:
//   { title: 'Wooden horse', meta: 'GLB · 2K texture · Balanced', image: 'results/horse.jpg', model: 'results/horse.glb' }
// Entries with `sample` and no `model` render a built-in stand-in and are labelled
// "Sample" on the page — replace all of them with real Sculpt exports before launch.
export const RESULTS = [
  { title: 'Glazed vase', meta: 'GLB · 2K texture', sample: 'vase', image: null, model: null },
  { title: 'Field mushroom', meta: 'GLB · 1K texture', sample: 'mushroom', image: null, model: null },
  { title: 'Bath duck', meta: 'STL · 80 mm', sample: 'duck', image: null, model: null },
];
