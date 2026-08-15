// Host-side entry: this companion package has no server half (the preview
// panel, renderers, and turn-tail row are all browser-side).
// The loader rejects an empty default export, so the host half is a valid
// no-op Cordis plugin.
const name = "dsh-artifact-preview";
const inject = [];
function apply() {}
export { apply, inject, name };
