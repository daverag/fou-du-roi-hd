import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const sheetOne = path.join(ROOT, '06dc6f60-37ab-4932-bf08-288a7f7b2581 (1).png');
const sheetTwo = path.join(ROOT, 'bb49de24-5cd1-41bb-ac2b-a7a0f61dbc9c (1).png');

const alphaThreshold = 12;
const padding = 6;

const iconCuts = [
  { output: 'public/icons/hero.png', input: sheetOne, rect: { left: 8, top: 8, width: 286, height: 236 } },
  { output: 'public/icons/sword.png', input: sheetOne, rect: { left: 360, top: 0, width: 210, height: 272 } },
  { output: 'public/icons/magic-sword.png', input: sheetOne, rect: { left: 615, top: 0, width: 285, height: 252 } },
  { output: 'public/icons/apple.png', input: sheetOne, rect: { left: 18, top: 268, width: 230, height: 212 } },
  { output: 'public/icons/golden-apple.png', input: sheetOne, rect: { left: 318, top: 316, width: 258, height: 208 } },
  { output: 'public/icons/key.png', input: sheetOne, rect: { left: 700, top: 292, width: 190, height: 188 } },
  { output: 'public/icons/torch.png', input: sheetOne, rect: { left: 0, top: 540, width: 230, height: 280 } },
  { output: 'public/icons/golden-torch.png', input: sheetOne, rect: { left: 346, top: 585, width: 214, height: 220 } },
  { output: 'public/icons/skull.png', input: sheetOne, rect: { left: 690, top: 590, width: 205, height: 205 } },
  { output: 'public/icons/heart.png', input: sheetOne, rect: { left: 0, top: 885, width: 260, height: 220 } },
];

const virtueCuts = [
  { output: 'public/icons/virtues/virtue-shield.png', rect: { left: 0, top: 0, width: 341, height: 370 } },
  { output: 'public/icons/virtues/virtue-hourglass.png', rect: { left: 341, top: 0, width: 341, height: 370 } },
  { output: 'public/icons/virtues/virtue-book-feather.png', rect: { left: 682, top: 0, width: 342, height: 370 } },
  { output: 'public/icons/virtues/virtue-book-gems.png', rect: { left: 0, top: 370, width: 341, height: 370 } },
  { output: 'public/icons/virtues/virtue-scales-sword.png', rect: { left: 341, top: 370, width: 341, height: 370 } },
  { output: 'public/icons/virtues/virtue-hands-coins.png', rect: { left: 682, top: 370, width: 342, height: 370 } },
  { output: 'public/icons/virtues/virtue-lantern.png', rect: { left: 0, top: 740, width: 341, height: 369 } },
  { output: 'public/icons/virtues/virtue-winged-sword-dove.png', rect: { left: 341, top: 740, width: 341, height: 369 } },
  { output: 'public/icons/virtues/virtue-prayer.png', rect: { left: 682, top: 740, width: 342, height: 369 } },
].map((cut) => ({ ...cut, input: sheetTwo }));

const legacyAliases = [
  ['public/icons/virtue-hourglass.png', 'public/icons/virtues/virtue-hourglass.png'],
  ['public/icons/virtue-lantern.png', 'public/icons/virtues/virtue-lantern.png'],
  ['public/icons/virtue-scales.png', 'public/icons/virtues/virtue-scales-sword.png'],
  ['public/icons/virtue-dove.png', 'public/icons/virtues/virtue-winged-sword-dove.png'],
  ['public/icons/virtue-cauldron.png', 'public/icons/virtues/virtue-book-gems.png'],
];

function findOpaqueBounds(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (data[index + 3] <= alphaThreshold) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error('No opaque pixels found after background trim');
  }

  return {
    left: Math.max(0, minX - padding),
    top: Math.max(0, minY - padding),
    right: Math.min(width - 1, maxX + padding),
    bottom: Math.min(height - 1, maxY + padding),
  };
}

function cropRaw(data, width, height, bounds) {
  const outWidth = bounds.right - bounds.left + 1;
  const outHeight = bounds.bottom - bounds.top + 1;
  const out = Buffer.alloc(outWidth * outHeight * 4);

  for (let y = 0; y < outHeight; y += 1) {
    const sourceStart = ((bounds.top + y) * width + bounds.left) * 4;
    const sourceEnd = sourceStart + outWidth * 4;
    data.copy(out, y * outWidth * 4, sourceStart, sourceEnd);
  }

  return { data: out, width: outWidth, height: outHeight };
}

async function extractOne({ input, rect, output }) {
  const { data, info } = await sharp(input)
    .extract(rect)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bounds = findOpaqueBounds(data, info.width, info.height);
  const cropped = cropRaw(data, info.width, info.height, bounds);
  const target = path.join(ROOT, output);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await sharp(cropped.data, {
    raw: {
      width: cropped.width,
      height: cropped.height,
      channels: 4,
    },
  }).png().toFile(target);
  console.log(`wrote ${output} (${cropped.width}x${cropped.height})`);
}

async function copyAlias(targetPath, sourcePath) {
  await fs.copyFile(path.join(ROOT, sourcePath), path.join(ROOT, targetPath));
  console.log(`aliased ${targetPath} -> ${sourcePath}`);
}

async function main() {
  for (const cut of [...iconCuts, ...virtueCuts]) {
    await extractOne(cut);
  }
  for (const [targetPath, sourcePath] of legacyAliases) {
    await copyAlias(targetPath, sourcePath);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
