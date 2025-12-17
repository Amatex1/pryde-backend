/**
 * Generate PWA Icons Script
 * Creates all required icon sizes from the source logo
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Icon sizes required for PWA
const ICON_SIZES = [
  72, 96, 128, 144, 152, 192, 384, 512
];

// Paths
const SOURCE_LOGO = path.join(__dirname, '../public/pryde-logo.png');
const OUTPUT_DIR = path.join(__dirname, '../public/icons');

/**
 * Generate icons
 */
async function generateIcons() {
  console.log('🎨 Generating PWA icons...\n');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log('✅ Created icons directory\n');
  }

  // Check if source logo exists
  if (!fs.existsSync(SOURCE_LOGO)) {
    console.error('❌ Error: Source logo not found at:', SOURCE_LOGO);
    console.log('Please ensure pryde-logo.png exists in the public directory');
    process.exit(1);
  }

  // Generate each icon size
  for (const size of ICON_SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);

    try {
      await sharp(SOURCE_LOGO)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png({
          quality: 100,
          compressionLevel: 9
        })
        .toFile(outputPath);

      console.log(`✅ Generated ${size}x${size} icon`);
    } catch (error) {
      console.error(`❌ Error generating ${size}x${size} icon:`, error.message);
    }
  }

  // Generate maskable icons (with padding for safe area)
  console.log('\n🎭 Generating maskable icons...\n');

  for (const size of [192, 512]) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}-maskable.png`);

    try {
      // Add 20% padding for safe area
      const paddedSize = Math.round(size * 0.8);
      const padding = Math.round((size - paddedSize) / 2);

      await sharp(SOURCE_LOGO)
        .resize(paddedSize, paddedSize, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 102, g: 126, b: 234, alpha: 1 } // Pryde purple
        })
        .png({
          quality: 100,
          compressionLevel: 9
        })
        .toFile(outputPath);

      console.log(`✅ Generated ${size}x${size} maskable icon`);
    } catch (error) {
      console.error(`❌ Error generating ${size}x${size} maskable icon:`, error.message);
    }
  }

  // Generate favicon
  console.log('\n🔖 Generating favicon...\n');

  const faviconPath = path.join(__dirname, '../public/favicon.ico');

  try {
    await sharp(SOURCE_LOGO)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(faviconPath.replace('.ico', '.png'));

    console.log('✅ Generated favicon.png (rename to .ico if needed)');
  } catch (error) {
    console.error('❌ Error generating favicon:', error.message);
  }

  console.log('\n✨ Icon generation complete!\n');
  console.log('📁 Icons saved to:', OUTPUT_DIR);
  console.log('\n📝 Next steps:');
  console.log('1. Update manifest.json with new icon paths');
  console.log('2. Test PWA installation on mobile devices');
  console.log('3. Verify icons appear correctly in app drawer\n');
}

// Run the script
generateIcons().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

