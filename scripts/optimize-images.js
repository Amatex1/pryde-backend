import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '../public');
const inputImage = path.join(publicDir, 'pryde-logo.png');

// Sizes we need for PWA and navbar
const sizes = [
  { width: 192, name: 'icon-192.png' },
  { width: 512, name: 'icon-512.png' },
  { width: 180, name: 'apple-touch-icon.png' }, // iOS
  { width: 48, name: 'pryde-logo-small.png' }, // Navbar logo (36x36 display, 48x48 for retina)
];

async function optimizeImages() {
  console.log('🎨 Optimizing images...\n');

  // Check if input exists
  if (!fs.existsSync(inputImage)) {
    console.error('❌ Error: pryde-logo.png not found in public folder');
    process.exit(1);
  }

  // Create optimized versions
  for (const size of sizes) {
    const outputPath = path.join(publicDir, size.name);
    
    try {
      // Create PNG version
      await sharp(inputImage)
        .resize(size.width, size.width, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png({ quality: 90, compressionLevel: 9 })
        .toFile(outputPath);
      
      const stats = fs.statSync(outputPath);
      console.log(`✅ Created ${size.name} (${Math.round(stats.size / 1024)}KB)`);

      // Create WebP version
      const webpPath = outputPath.replace('.png', '.webp');
      await sharp(inputImage)
        .resize(size.width, size.width, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({ quality: 90 })
        .toFile(webpPath);
      
      const webpStats = fs.statSync(webpPath);
      console.log(`✅ Created ${path.basename(webpPath)} (${Math.round(webpStats.size / 1024)}KB)`);
    } catch (error) {
      console.error(`❌ Error creating ${size.name}:`, error.message);
    }
  }

  // Optimize the original logo
  const optimizedLogo = path.join(publicDir, 'pryde-logo-optimized.png');
  await sharp(inputImage)
    .resize(870, 870, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png({ quality: 90, compressionLevel: 9 })
    .toFile(optimizedLogo);
  
  const originalSize = fs.statSync(inputImage).size;
  const optimizedSize = fs.statSync(optimizedLogo).size;
  const savings = Math.round((1 - optimizedSize / originalSize) * 100);
  
  console.log(`\n✅ Optimized pryde-logo.png: ${Math.round(originalSize / 1024)}KB → ${Math.round(optimizedSize / 1024)}KB (${savings}% smaller)`);
  
  // Create WebP version of logo
  const logoWebp = path.join(publicDir, 'pryde-logo.webp');
  await sharp(inputImage)
    .resize(870, 870, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .webp({ quality: 90 })
    .toFile(logoWebp);
  
  const webpSize = fs.statSync(logoWebp).size;
  console.log(`✅ Created pryde-logo.webp: ${Math.round(webpSize / 1024)}KB\n`);
  
  console.log('🎉 Image optimization complete!');
  console.log('\n📝 Next steps:');
  console.log('1. Replace pryde-logo.png with pryde-logo-optimized.png');
  console.log('2. Update manifest.json to use the new icon files');
  console.log('3. Rebuild and deploy');
}

optimizeImages().catch(console.error);

