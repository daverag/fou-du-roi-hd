import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const root = process.cwd();
const sourcePath = path.join(root, 'public/icons/hero-app-icon.png');
const buildDir = path.join(root, 'build');
const iconsetDir = path.join(buildDir, 'icon.iconset');
const outputPath = path.join(buildDir, 'icon.icns');

const iconsetEntries = [
  { name: 'icon_16x16.png', size: 16 },
  { name: 'icon_16x16@2x.png', size: 32 },
  { name: 'icon_32x32.png', size: 32 },
  { name: 'icon_32x32@2x.png', size: 64 },
  { name: 'icon_128x128.png', size: 128 },
  { name: 'icon_128x128@2x.png', size: 256 },
  { name: 'icon_256x256.png', size: 256 },
  { name: 'icon_256x256@2x.png', size: 512 },
  { name: 'icon_512x512.png', size: 512 },
  { name: 'icon_512x512@2x.png', size: 1024 },
];

async function main() {
  await fs.mkdir(buildDir, { recursive: true });
  await fs.rm(iconsetDir, { recursive: true, force: true });
  await fs.mkdir(iconsetDir, { recursive: true });

  for (const { name, size } of iconsetEntries) {
    await sharp(sourcePath)
      .resize(size, size)
      .png()
      .toFile(path.join(iconsetDir, name));
  }

  if (os.platform() !== 'darwin') {
    console.log('Skipping icon.icns generation outside macOS');
    return;
  }

  execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', outputPath], { stdio: 'inherit' });
  console.log(`wrote ${path.relative(root, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
