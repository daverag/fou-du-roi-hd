import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const inputPath = path.join(root, 'public/icons/hero.png');
const outputPath = path.join(root, 'public/icons/hero-app-icon.png');
const targetSize = 1024;

async function main() {
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (!width || !height) {
    throw new Error('Unable to read hero.png dimensions');
  }

  const squareSize = Math.max(width, height);
  const left = Math.floor((squareSize - width) / 2);
  const right = squareSize - width - left;
  const top = Math.floor((squareSize - height) / 2);
  const bottom = squareSize - height - top;

  await image
    .extend({
      top,
      bottom,
      left,
      right,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(targetSize, targetSize)
    .png()
    .toFile(outputPath);

  console.log(`wrote ${path.relative(root, outputPath)} (${targetSize}x${targetSize})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
