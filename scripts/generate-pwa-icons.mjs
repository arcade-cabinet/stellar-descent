/**
 * PWA Icon Generator Script
 *
 * Generates PNG icons for PWA from SVG source.
 * Run with: node scripts/generate-pwa-icons.mjs
 *
 * Requires: npm install sharp --save-dev
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');

// Icon sizes needed for PWA (placed in public/ root to match vite.config.ts manifest)
const sizes = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'pwa-maskable-192x192.png', size: 192, maskable: true },
  { name: 'pwa-maskable-512x512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-16x16.png', size: 16 },
];

/**
 * Generate SVG string for a given size
 */
function generateIconSVG(size) {
  const scale = size / 512;
  const strokeScale = Math.max(1, Math.round(4 * scale));
  const fontSize = Math.round(48 * scale);
  const smallFontSize = Math.round(36 * scale);
  const tinyFontSize = Math.round(28 * scale);

  // For very small sizes, use a simplified icon
  if (size <= 64) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="#0a0a0c"/>
      <rect x="${Math.round(size * 0.03)}" y="${Math.round(size * 0.03)}" width="${Math.round(size * 0.94)}" height="${Math.round(size * 0.94)}" fill="none" stroke="#4a5d23" stroke-width="${Math.max(1, strokeScale / 2)}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${Math.round(size * 0.3)}" fill="rgba(74,93,35,0.3)"/>
      <path d="M${size / 2} ${size * 0.35} L${size * 0.65} ${size * 0.55} L${size * 0.55} ${size * 0.55} L${size * 0.55} ${size * 0.75} L${size * 0.45} ${size * 0.75} L${size * 0.45} ${size * 0.55} L${size * 0.35} ${size * 0.55} Z" fill="#6b8e23"/>
    </svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
    <rect width="512" height="512" fill="#0a0a0c"/>
    <rect x="16" y="16" width="480" height="480" fill="none" stroke="#4a5d23" stroke-width="4"/>
    <path d="M16 80 L16 16 L80 16" fill="none" stroke="#b5a642" stroke-width="6"/>
    <path d="M432 16 L496 16 L496 80" fill="none" stroke="#b5a642" stroke-width="6"/>
    <path d="M496 432 L496 496 L432 496" fill="none" stroke="#b5a642" stroke-width="6"/>
    <path d="M80 496 L16 496 L16 432" fill="none" stroke="#b5a642" stroke-width="6"/>
    <circle cx="256" cy="220" r="120" fill="none" stroke="#4a5d23" stroke-width="4"/>
    <circle cx="256" cy="220" r="100" fill="rgba(74,93,35,0.15)"/>
    <text x="256" y="235" font-family="monospace" font-size="48" font-weight="bold" fill="#b5a642" text-anchor="middle">TEA</text>
    <path d="M256 280 L306 330 L286 330 L286 380 L226 380 L226 330 L206 330 Z" fill="#6b8e23"/>
    <text x="256" y="430" font-family="monospace" font-size="36" font-weight="bold" fill="#e8e8e8" text-anchor="middle" letter-spacing="4">STELLAR</text>
    <text x="256" y="470" font-family="monospace" font-size="28" fill="#b5a642" text-anchor="middle" letter-spacing="6">DESCENT</text>
    <line x1="128" y1="16" x2="128" y2="496" stroke="#1a1a1a" stroke-width="1"/>
    <line x1="384" y1="16" x2="384" y2="496" stroke="#1a1a1a" stroke-width="1"/>
    <line x1="16" y1="128" x2="496" y2="128" stroke="#1a1a1a" stroke-width="1"/>
  </svg>`;
}

/**
 * Generate maskable icon SVG (with safe zone padding)
 */
function generateMaskableIconSVG(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
    <rect width="512" height="512" fill="#0a0a0c"/>
    <g transform="translate(64, 64) scale(0.75)">
      <rect x="16" y="16" width="480" height="480" fill="none" stroke="#4a5d23" stroke-width="4"/>
      <circle cx="256" cy="220" r="120" fill="none" stroke="#4a5d23" stroke-width="4"/>
      <circle cx="256" cy="220" r="100" fill="rgba(74,93,35,0.15)"/>
      <text x="256" y="235" font-family="monospace" font-size="48" font-weight="bold" fill="#b5a642" text-anchor="middle">TEA</text>
      <path d="M256 280 L306 330 L286 330 L286 380 L226 380 L226 330 L206 330 Z" fill="#6b8e23"/>
      <text x="256" y="430" font-family="monospace" font-size="36" font-weight="bold" fill="#e8e8e8" text-anchor="middle" letter-spacing="4">STELLAR</text>
      <text x="256" y="470" font-family="monospace" font-size="28" fill="#b5a642" text-anchor="middle" letter-spacing="6">DESCENT</text>
    </g>
  </svg>`;
}

async function generateIcons() {
  try {
    // Try to use sharp if available
    const { default: sharp } = await import('sharp');

    console.log('Generating PWA icons with sharp...');

    for (const { name, size, maskable } of sizes) {
      const svg = maskable ? generateMaskableIconSVG(size) : generateIconSVG(size);
      const outputPath = join(publicDir, name);

      await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outputPath);

      console.log(`Generated: ${name} (${size}x${size})${maskable ? ' [maskable]' : ''}`);
    }

    // Generate screenshot placeholder
    const screenshotSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
      <rect width="1280" height="720" fill="#0a0a0c"/>
      <rect x="20" y="20" width="1240" height="680" fill="none" stroke="#4a5d23" stroke-width="2"/>
      <text x="640" y="320" font-family="monospace" font-size="64" font-weight="bold" fill="#b5a642" text-anchor="middle">STELLAR DESCENT</text>
      <text x="640" y="400" font-family="monospace" font-size="32" fill="#808080" text-anchor="middle">PROXIMA BREACH</text>
      <text x="640" y="500" font-family="monospace" font-size="24" fill="#4a5d23" text-anchor="middle">Tactical Combat Gameplay</text>
    </svg>`;

    await sharp(Buffer.from(screenshotSvg))
      .resize(1280, 720)
      .png()
      .toFile(join(publicDir, 'screenshot-wide.png'));

    console.log('Generated: screenshot-wide.png (1280x720)');
    console.log('\nAll PWA icons generated successfully!');
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      console.log('sharp not installed. Generating SVG icons only.');
      console.log('To generate PNG icons, run: pnpm add -D sharp');
      console.log('Then run this script again.');

      // Save SVG versions as fallback
      for (const { name, size, maskable } of sizes) {
        const svgName = name.replace('.png', '.svg');
        const svg = maskable ? generateMaskableIconSVG(size) : generateIconSVG(size);
        writeFileSync(join(publicDir, svgName), svg);
        console.log(`Generated SVG fallback: ${svgName}`);
      }
    } else {
      throw error;
    }
  }
}

generateIcons().catch(console.error);
