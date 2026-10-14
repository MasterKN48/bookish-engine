const fs = require('fs');
const path = require('path');

const SITE_DIR = path.join(__dirname, 'offline_site');

function walkDir(dir, filterExt) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(walkDir(full, filterExt));
    } else if (!filterExt || filterExt.some((ext) => file.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

function rebrandContent(content) {
  return content
    .replaceAll(
      'Chai Prep: Your preparation ground for interviews',
      'BookishEngine: Interactive DSA & Engineering Visualizer'
    )
    .replaceAll(
      'Chai Prep is your preparation ground for software interviews: visual courses, notes, video courses, practice sheets, timed aptitude mocks and AI interview rounds, in one place. For students, job switchers, colleges and companies.',
      'BookishEngine is an interactive preparation ground for software interviews: visual courses, algorithm animations, practice problems, and system design visualizers.'
    )
    .replaceAll(
      'Chai Prep is your preparation ground for software interviews',
      'BookishEngine is your preparation ground for software engineering and algorithms'
    )
    .replaceAll('a ChaiCode product', 'a BookishEngine learning project')
    .replaceAll('© 2026 Chai Prep · a ChaiCode product', '© 2026 BookishEngine · Interactive Learning')
    .replaceAll('© 2025 Chai Prep · a ChaiCode product', '© 2026 BookishEngine · Interactive Learning')
    .replaceAll('https://www.chaicode.com/privacy-policy', 'https://github.com/MasterKN48/bookish-engine')
    .replaceAll('https://www.chaicode.com/terms-of-service', 'https://github.com/MasterKN48/bookish-engine')
    .replaceAll('https://www.chaicode.com/pricing-policy', 'https://github.com/MasterKN48/bookish-engine')
    .replaceAll('https://www.chaicode.com/Refund-policy', 'https://github.com/MasterKN48/bookish-engine')
    .replaceAll('https://www.chaicode.com', 'https://github.com/MasterKN48/bookish-engine')
    .replaceAll('https://dsa.chaicode.com', 'https://MasterKN48.github.io/bookish-engine')
    .replaceAll('Chai Prep', 'BookishEngine')
    .replaceAll('ChaiPrep', 'BookishEngine')
    .replaceAll('ChaiCode', 'BookishEngine');
}

function main() {
  console.log('=====================================================');
  console.log('   Rebranding ChaiCode -> BookishEngine              ');
  console.log('=====================================================');

  let totalFilesModified = 0;
  let totalReplacements = 0;

  // 1. Process all HTML files
  const htmlFiles = walkDir(path.join(SITE_DIR, 'html'), ['.html']);
  console.log(`Processing ${htmlFiles.length} HTML files...`);
  for (const f of htmlFiles) {
    const orig = fs.readFileSync(f, 'utf8');
    const updated = rebrandContent(orig);
    if (orig !== updated) {
      fs.writeFileSync(f, updated);
      totalFilesModified++;
    }
  }

  // 2. Process all RSC flight data files
  const rscFiles = walkDir(path.join(SITE_DIR, 'rsc'), ['.rsc']);
  console.log(`Processing ${rscFiles.length} RSC files...`);
  for (const f of rscFiles) {
    const orig = fs.readFileSync(f, 'utf8');
    const updated = rebrandContent(orig);
    if (orig !== updated) {
      fs.writeFileSync(f, updated);
      totalFilesModified++;
    }
  }

  // 3. Process all JavaScript chunk files
  const jsFiles = walkDir(path.join(SITE_DIR, '_next', 'static', 'chunks'), ['.js']);
  console.log(`Processing ${jsFiles.length} JS chunk files...`);
  for (const f of jsFiles) {
    const orig = fs.readFileSync(f, 'utf8');
    const updated = rebrandContent(orig);
    if (orig !== updated) {
      fs.writeFileSync(f, updated);
      totalFilesModified++;
    }
  }

  // 4. Disable promotional banners and toast notifications in layout chunk
  const layoutChunk = path.join(SITE_DIR, '_next', 'static', 'chunks', 'app', 'layout-05a4da47a56e9295.js');
  if (fs.existsSync(layoutChunk)) {
    let lContent = fs.readFileSync(layoutChunk, 'utf8');
    lContent = lContent
      .replace(/71346:\(e,t,n\)=>\{"use strict";n\.d\(t,\{LearningBanner:\(\)=>h\}\);.+?function h\(\)\{.+?\}\}\},/, '71346:(e,t,n)=>{"use strict";n.d(t,{LearningBanner:()=>h});function h(){return null;}},')
      .replace(/27818:\(e,t,n\)=>\{"use strict";n\.d\(t,\{AccessBanner:\(\)=>f\}\);.+?function f\(\)\{.+?\}\}\},/, '27818:(e,t,n)=>{"use strict";n.d(t,{AccessBanner:()=>f});function f(){return null;}},')
      .replace(/50497:\(e,t,n\)=>\{"use strict";n\.d\(t,\{DriveBanner:\(\)=>d,q:\(\)=>u\}\);.+?function d\(\)\{.+?\}\},/, '50497:(e,t,n)=>{"use strict";n.d(t,{DriveBanner:()=>d,q:()=>u});function d(){return null;}function u(){return false;}},')
      .replace(/85709:\(e,t,n\)=>\{"use strict";n\.d\(t,\{HelloBar:\(\)=>h\}\);.+?function h\(\)\{.+?\}\}\},/, '85709:(e,t,n)=>{"use strict";n.d(t,{HelloBar:()=>h});function h(){return null;}},');
    fs.writeFileSync(layoutChunk, lContent);
    console.log('[✓] Disabled LearningBanner, AccessBanner, DriveBanner, and HelloBar');
  }

  console.log('\n=====================================================');
  console.log(`[✓] Rebranded ${totalFilesModified} files across HTML, RSC, and JS!`);
  console.log('Brand name is now: BookishEngine');
  console.log('Logo icon is now: Neon BookishEngine Book & Engine Gear Icon');
  console.log('=====================================================\n');
}

main();
