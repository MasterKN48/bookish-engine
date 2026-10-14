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
const PREFIX = '${PATH_PREFIX}';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Intercept Next.js Image Optimization
  if (url.pathname.includes('/_next/image')) {
    const targetUrl = url.searchParams.get('url');
    if (targetUrl) {
      let cleanImg = decodeURIComponent(targetUrl);
      if (PREFIX && !cleanImg.startsWith(PREFIX) && cleanImg.startsWith('/')) {
        cleanImg = PREFIX + cleanImg;
      }
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
  if (url.pathname.includes('/api/')) {
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
  const spa404 = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>BookishEngine - Redirecting</title>
    <script>
      var l = window.location;
      var path = l.pathname;
      var prefix = '${PATH_PREFIX}';
      if (prefix && path.startsWith(prefix)) {
        path = path.slice(prefix.length);
      }
      path = path.replace(/^\\/+/, '').replace(/\\/$/, '');
      if (path) {
        window.location.replace(l.protocol + '//' + l.host + (prefix ? prefix + '/' : '/') + path + '/index.html' + l.search + l.hash);
      } else {
        window.location.replace(prefix ? prefix + '/' : '/');
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
  console.log(`   Exporting for GitHub Pages (Base: ${PATH_PREFIX || '/'})`);
  console.log('=====================================================');

  // 1. Clean and prepare dist
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // 2. Critical for GitHub Pages: .nojekyll
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

  // 3b. Patch Webpack public path if subpath is used (e.g. /bookish-engine)
  const webpackChunk = path.join(DIST_DIR, '_next', 'static', 'chunks', 'webpack-9433509379dd0fd2.js');
  if (fs.existsSync(webpackChunk) && PATH_PREFIX) {
    let wpContent = fs.readFileSync(webpackChunk, 'utf8');
    wpContent = wpContent.replaceAll('d.p="/_next/"', `d.p="${PATH_PREFIX}/_next/"`);
    fs.writeFileSync(webpackChunk, wpContent);
    console.log(`[✓] Patched Webpack chunk publicPath: d.p="${PATH_PREFIX}/_next/"`);
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

  // Inline client-side fetch & image shim
  const clientShim = `<script>
(function() {
  var prefix = '${PATH_PREFIX}';
  var origFetch = window.fetch;
  window.fetch = function(url, opts) {
    if (typeof url === 'string') {
      if (url.includes('/api/auth/refresh') || url.includes('/api/auth/sessions')) {
        return Promise.resolve(new Response(JSON.stringify({
          status: 200, authenticated: true,
          user: { id: 'usr_huntlax', name: 'Huntlax', username: 'Huntlax' },
          session: { id: 'sess_offline', active: true }
        }), { headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/api/')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true, offline: true }), {
          headers: { 'Content-Type': 'application/json' }
        }));
      }
      if (url.includes('/_next/image')) {
        var m = url.match(/[?&]url=([^&]+)/);
        var target = m ? decodeURIComponent(m[1]) : (prefix + '/chai-mascot-dark.png');
        if (prefix && !target.startsWith(prefix) && target.startsWith('/')) {
          target = prefix + target;
        }
        return origFetch.call(this, target, opts).catch(function() {
          return new Response(new Blob(), { headers: { 'Content-Type': 'image/png' } });
        });
      }
      if (prefix) {
        if (url.startsWith('/_next/')) url = prefix + url;
        else if (url.startsWith('/?') || url === '/' || (url.startsWith('/') && !url.startsWith(prefix + '/'))) {
          url = prefix + url;
        }
      }
    }
    return origFetch.call(this, url, opts);
  };
})();
</script>`;

  let exportedCount = 0;

  for (const filename of allHtmlFiles) {
    if (!filename.endsWith('.html')) continue;

    let html = fs.readFileSync(path.join(htmlDir, filename), 'utf8');

    // Rewrite root-relative URLs if subpath is active
    if (PATH_PREFIX) {
      // 1. Assets
      html = html
        .replaceAll('"/_next/', `"${PATH_PREFIX}/_next/`)
        .replaceAll("'/_next/", `'${PATH_PREFIX}/_next/`)
        .replaceAll('"/fonts/', `"${PATH_PREFIX}/fonts/`)
        .replaceAll("'/fonts/", `'${PATH_PREFIX}/fonts/`)
        .replaceAll('"/chai-mascot-dark.png', `"${PATH_PREFIX}/chai-mascot-dark.png`)
        .replaceAll("'/chai-mascot-dark.png", `'${PATH_PREFIX}/chai-mascot-dark.png`)
        .replaceAll('"/brand/', `"${PATH_PREFIX}/brand/`)
        .replaceAll("'/brand/", `'${PATH_PREFIX}/brand/`);

      // 2. Links (e.g. href="/two-pointers/..." -> href="/bookish-engine/two-pointers/...")
      html = html.replace(/href="(\/[a-zA-Z0-9\-\_\/]*)"/g, (match, p1) => {
        if (p1.startsWith(PATH_PREFIX)) return match;
        return `href="${PATH_PREFIX}${p1 === '/' ? '' : p1}"`;
      });
    }

    // Inject fonts, shim, and service worker
    if (!html.includes('/fonts/fonts.css')) {
      html = html.replace('</head>', `${fontLink}\n</head>`);
    }
    if (!html.includes('var origFetch = window.fetch')) {
      html = html.replace('<head>', `<head>\n${clientShim}`);
    }
    if (!html.includes('navigator.serviceWorker.register')) {
      html = html.replace('</body>', `${swScript}\n</body>`);
    }

    if (filename === 'index.html' || filename === 'root.html') {
      fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html);
      exportedCount++;
      continue;
    }

    const baseName = filename.replace(/\.html$/, '');
    const routeParts = baseName.split('__');
    const targetDir = path.join(DIST_DIR, ...routeParts);

    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'index.html'), html);
    fs.writeFileSync(path.join(DIST_DIR, ...routeParts.slice(0, -1), `${routeParts[routeParts.length - 1]}.html`), html);

    exportedCount++;
  }

  console.log(`[✓] Successfully exported ${exportedCount} static pages into ./dist/`);
  console.log('\n=====================================================');
  console.log('STATIC EXPORT READY IN ./dist/');
  console.log('=====================================================');
}

main();
