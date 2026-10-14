const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const SITE_DIR = path.join(__dirname, 'offline_site');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.rsc': 'text/x-component; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

function routeToFilename(route) {
  const clean = route.replace(/^\/+|\/+$/g, '').replace(/[\/\?#]/g, '__');
  return clean || 'index';
}

function tryFindFile(relPath) {
  const p1 = path.join(SITE_DIR, relPath);
  if (fs.existsSync(p1) && fs.statSync(p1).isFile()) return p1;

  try {
    const decoded = decodeURIComponent(relPath);
    const p2 = path.join(SITE_DIR, decoded);
    if (fs.existsSync(p2) && fs.statSync(p2).isFile()) return p2;
  } catch (e) {}

  return null;
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const rawPathname = parsed.pathname || '/';

  // Root pathname normalized
  const isRoot = rawPathname === '/' || rawPathname === '';

  // Next.js Image Optimization Proxy Mock
  if (rawPathname === '/_next/image') {
    const targetUrl = parsed.query.url;
    if (targetUrl) {
      const cleanImgPath = decodeURIComponent(targetUrl).replace(/^\//, '');
      const foundImg = tryFindFile(cleanImgPath) || tryFindFile(path.join('public', cleanImgPath));
      if (foundImg) {
        const ext = path.extname(foundImg);
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
        });
        fs.createReadStream(foundImg).pipe(res);
        return;
      }
    }
    // Return empty 1x1 transparent png if image not found
    const transparentPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64'
    );
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(transparentPng);
    return;
  }

  // Mock API routes (Offline Auth & telemetry)
  if (rawPathname.startsWith('/api/')) {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    });

    if (rawPathname === '/api/auth/refresh' || rawPathname.startsWith('/api/auth/sessions')) {
      res.end(
        JSON.stringify({
          status: 200,
          authenticated: true,
          user: { id: 'usr_huntlax', name: 'Huntlax', username: 'Huntlax' },
          session: { id: 'sess_offline', active: true },
        })
      );
      return;
    }

    if (rawPathname === '/api/auth/profiles/current') {
      res.end(
        JSON.stringify({
          id: 'usr_huntlax',
          name: 'Huntlax',
          username: 'Huntlax',
          streak: 1,
        })
      );
      return;
    }

    // Default mock response for any other /api/* (like error-report, telemetry)
    res.end(JSON.stringify({ success: true, offline: true }));
    return;
  }

  // Next.js RSC requests (React Server Components flight streams)
  const isRsc = req.headers['rsc'] === '1' || parsed.query._rsc;
  if (isRsc) {
    const fileKey = routeToFilename(rawPathname);
    const rscFile = path.join(SITE_DIR, 'rsc', `${fileKey}.rsc`);
    if (fs.existsSync(rscFile)) {
      res.writeHead(200, {
        'Content-Type': 'text/x-component; charset=utf-8',
        'Vary': 'RSC, Next-Router-State-Tree, Next-Router-Prefetch',
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(rscFile).pipe(res);
      return;
    }
  }

  // Handle local fonts
  if (rawPathname.startsWith('/fonts/')) {
    const fontFile = path.join(SITE_DIR, rawPathname);
    if (fs.existsSync(fontFile)) {
      const ext = path.extname(fontFile);
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000',
      });
      fs.createReadStream(fontFile).pipe(res);
      return;
    }
  }

  // Handle static assets (_next/static/...)
  const relAsset = rawPathname.replace(/^\//, '');
  const assetFile = tryFindFile(relAsset);
  if (assetFile) {
    const ext = path.extname(assetFile);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    fs.createReadStream(assetFile).pipe(res);
    return;
  }

  // Handle Page Routes (HTML)
  const fileKey = routeToFilename(rawPathname);
  const htmlFile = path.join(SITE_DIR, 'html', `${fileKey}.html`);
  if (fs.existsSync(htmlFile)) {
    let htmlContent = fs.readFileSync(htmlFile, 'utf8');

    // Inject offline font stylesheet if available
    if (fs.existsSync(path.join(SITE_DIR, 'fonts', 'fonts.css'))) {
      if (!htmlContent.includes('/fonts/fonts.css')) {
        htmlContent = htmlContent.replace(
          '</head>',
          '<link rel="stylesheet" href="/fonts/fonts.css">\n</head>'
        );
      }
    }

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(htmlContent);
    return;
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>404 - Lesson Not Found</title>
        <style>
          body { font-family: -apple-system, sans-serif; background: #0f1117; color: #fff; padding: 40px; text-align: center; }
          a { color: #60a5fa; text-decoration: none; font-size: 18px; }
          .card { max-width: 500px; margin: 40px auto; background: #1c1f2b; padding: 24px; border-radius: 12px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Page Not Found</h2>
          <p>The path <code>${rawPathname}</code> is not in the offline mirror.</p>
          <p><a href="/two-pointers/intro">← Back to Two Pointers Intro</a></p>
        </div>
      </body>
    </html>
  `);
});

server.listen(PORT, () => {
  console.log('=====================================================');
  console.log(`🚀 BookishEngine Offline App running at: http://localhost:${PORT}`);
  console.log('=====================================================');
  console.log('All DSA Visual, LLD, Networking & OS lessons are available 100% offline.');
  console.log('Press Ctrl + C to stop the server.');
});
