const fs = require('fs');
const path = require('path');

const SITE_DIR = path.join(__dirname, 'offline_site');
const DIST_DIR = path.join(__dirname, 'dist');

const BASE_PATH = (process.env.BASE_PATH || '').replace(/^\/+|\/+$/g, '');
const PATH_PREFIX = BASE_PATH ? `/${BASE_PATH}` : '';

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function routeToFilename(route) {
  const clean = route.replace(/^\/+|\/+$/g, '').replace(/[\/\?#]/g, '__');
  return clean || 'index';
}

function createServiceWorker() {
  const swCode = `// Offline Service Worker for BookishEngine Static Mirror
const CACHE_NAME = 'bookishengine-offline-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Intercept Next.js Image Optimization
  if (url.pathname === '/_next/image') {
    const targetUrl = url.searchParams.get('url');
    if (targetUrl) {
      const cleanImg = decodeURIComponent(targetUrl);
      event.respondWith(
        fetch(cleanImg).catch(() => {
          return new Response(
            Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), c => c.charCodeAt(0)),
            { headers: { 'Content-Type': 'image/png' } }
          );
        })
      );
      return;
    }
  }

  // 2. Intercept Auth & Analytics APIs
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname.includes('/auth/refresh') || url.pathname.includes('/auth/sessions')) {
      event.respondWith(
        new Response(
          JSON.stringify({
            status: 200,
            authenticated: true,
            user: { id: 'usr_huntlax', name: 'Huntlax', username: 'Huntlax' },
            session: { id: 'sess_offline', active: true }
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      );
      return;
    }

    // Default mock response for other /api/* (like error-report)
    event.respondWith(
      new Response(JSON.stringify({ success: true, offline: true }), {
        headers: { 'Content-Type': 'application/json' }
      })
    );
    return;
  }
});
`;
  fs.writeFileSync(path.join(DIST_DIR, 'sw.js'), swCode);
}

function createGitHubPagesSPA404() {
  // Standard GitHub Pages SPA redirect fallback
  const spa404 = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>BookishEngine - Redirecting</title>
    <script>
      // Single Page App redirect for GitHub Pages
      var pathSegmentsToKeep = 0;
      var l = window.location;
      var target = l.pathname.replace(/^\\/+/, '');
      if (target) {
        var cleanTarget = target.replace(/\\/$/, '') + '/index.html';
        window.location.replace(l.protocol + '//' + l.host + '/' + cleanTarget + l.search + l.hash);
      } else {
        window.location.replace('/');
      }
    </script>
  </head>
  <body>
    <p>Redirecting to lesson...</p>
  </body>
</html>`;
  fs.writeFileSync(path.join(DIST_DIR, '404.html'), spa404);
}

function main() {
  console.log('=====================================================');
  console.log('   Exporting for GitHub Pages & Static Hosting       ');
  console.log('=====================================================');

  // 1. Clean and prepare dist
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // 2. Critical for GitHub Pages: .nojekyll (tells GitHub Pages NOT to ignore _next directory!)
  fs.writeFileSync(path.join(DIST_DIR, '.nojekyll'), '');
  console.log('[✓] Created .nojekyll (enables _next/ assets on GitHub Pages)');

  // 3. Copy static asset directories
  console.log('Copying static assets (_next, fonts, images)...');
  copyDirRecursive(path.join(SITE_DIR, '_next'), path.join(DIST_DIR, '_next'));
  copyDirRecursive(path.join(SITE_DIR, 'fonts'), path.join(DIST_DIR, 'fonts'));
  if (fs.existsSync(path.join(SITE_DIR, 'brand'))) {
    copyDirRecursive(path.join(SITE_DIR, 'brand'), path.join(DIST_DIR, 'brand'));
  }
  if (fs.existsSync(path.join(SITE_DIR, 'chai-mascot-dark.png'))) {
    fs.copyFileSync(
      path.join(SITE_DIR, 'chai-mascot-dark.png'),
      path.join(DIST_DIR, 'chai-mascot-dark.png')
    );
  }

  // 4. Create Service Worker and SPA 404 handler
  createServiceWorker();
  createGitHubPagesSPA404();
  console.log('[✓] Generated sw.js and 404.html');

  // 5. Read routes manifest
  const routesFile = path.join(SITE_DIR, 'routes.json');
  let routes = [];
  if (fs.existsSync(routesFile)) {
    routes = JSON.parse(fs.readFileSync(routesFile, 'utf8'));
  }

  const htmlDir = path.join(SITE_DIR, 'html');
  const allHtmlFiles = fs.readdirSync(htmlDir);

  console.log(`Processing ${allHtmlFiles.length} HTML pages into directory index structure...`);

  const swScript = `<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('${PATH_PREFIX}/sw.js');});}</script>`;
  const fontLink = `<link rel="stylesheet" href="${PATH_PREFIX}/fonts/fonts.css">`;

  let exportedCount = 0;

  // Process all html files
  for (const filename of allHtmlFiles) {
    if (!filename.endsWith('.html')) continue;

    let html = fs.readFileSync(path.join(htmlDir, filename), 'utf8');

    // If a subpath is used (e.g. /bookish-engine), rewrite root-relative asset URLs
    if (PATH_PREFIX) {
      html = html
        .replaceAll('"/_next/', `"${PATH_PREFIX}/_next/`)
        .replaceAll("'/_next/", `'${PATH_PREFIX}/_next/`)
        .replaceAll('"/fonts/', `"${PATH_PREFIX}/fonts/`)
        .replaceAll("'/fonts/", `'${PATH_PREFIX}/fonts/`)
        .replaceAll('"/chai-mascot-dark.png', `"${PATH_PREFIX}/chai-mascot-dark.png`)
        .replaceAll("'/chai-mascot-dark.png", `'${PATH_PREFIX}/chai-mascot-dark.png`)
        .replaceAll('"/brand/', `"${PATH_PREFIX}/brand/`)
        .replaceAll("'/brand/", `'${PATH_PREFIX}/brand/`);
    }

    // Inject fonts and service worker
    if (!html.includes('/fonts/fonts.css')) {
      html = html.replace('</head>', `${fontLink}\n</head>`);
    }
    if (!html.includes('navigator.serviceWorker.register')) {
      html = html.replace('</body>', `${swScript}\n</body>`);
    }

    if (filename === 'index.html' || filename === 'root.html') {
      fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html);
      exportedCount++;
      continue;
    }

    // Convert filename back to route path
    // e.g. two-pointers__two-sum-ii.html -> two-pointers/two-sum-ii/index.html
    const baseName = filename.replace(/\.html$/, '');
    const routeParts = baseName.split('__');
    const targetDir = path.join(DIST_DIR, ...routeParts);

    fs.mkdirSync(targetDir, { recursive: true });
    // Save as index.html inside the route folder for clean URLs
    fs.writeFileSync(path.join(targetDir, 'index.html'), html);

    // Also save as routeParts.join('/') + '.html' for hosts supporting cleanUrls
    fs.writeFileSync(path.join(DIST_DIR, ...routeParts.slice(0, -1), `${routeParts[routeParts.length - 1]}.html`), html);

    exportedCount++;
  }

  console.log(`[✓] Successfully exported ${exportedCount} static pages into ./dist/`);
  console.log('\n=====================================================');
  console.log('STATIC EXPORT READY IN ./dist/');
  console.log('=====================================================');
  console.log('To test your static export locally:');
  console.log('   npx serve dist');
  console.log('\nTo deploy to GitHub Pages:');
  console.log('   See README.md for 1-step GitHub Pages deployment');
  console.log('=====================================================\n');
}

main();
