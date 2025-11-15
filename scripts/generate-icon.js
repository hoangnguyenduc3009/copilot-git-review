// Generates a minimal PNG icon at images/icon.png so vsce can package the extension without errors.
// This writes a 1x1 transparent PNG as a placeholder. Replace later with a proper 128x128 icon if desired.

const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'images');
const outFile = path.join(outDir, 'icon.png');

// 1x1 transparent PNG base64
const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeIcon() {
  ensureDir(outDir);
  const buf = Buffer.from(base64, 'base64');
  fs.writeFileSync(outFile, buf);
  // eslint-disable-next-line no-console
  console.log(`Generated icon: ${path.relative(path.join(__dirname, '..'), outFile)}`);
}

try {
  writeIcon();
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('Failed to generate icon.png:', err);
  process.exit(1);
}
