import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const source = path.join(ROOT, 'ChatGPT Image Mar 11, 2026, 02_13_17 AM.png');

const crops = [
  ['wall-square', { left: 95, top: 118, width: 335, height: 265 }],
  ['wall-horizontal', { left: 78, top: 606, width: 890, height: 185 }],
  ['wall-vertical', { left: 1115, top: 118, width: 250, height: 640 }],
];

async function main() {
  const outDir = path.join(ROOT, 'public', 'walls');
  await fs.mkdir(outDir, { recursive: true });

  for (const [name, rect] of crops) {
    const out = path.join(outDir, `${name}.png`);
    await sharp(source).extract(rect).png().toFile(out);
    console.log(`wrote ${path.relative(ROOT, out)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
