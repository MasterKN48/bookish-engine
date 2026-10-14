const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");
const readline = require("readline");

const BASE_URL = "https://example.com";
const CHROME_PATH =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT_DIR = path.join(__dirname, "offline_site");
const PROFILE_DIR = path.join(__dirname, ".chrome_profile");

// Ensure output directories exist
function ensureDirs() {
  fs.mkdirSync(path.join(OUT_DIR, "html"), { recursive: true });
  fs.mkdirSync(path.join(OUT_DIR, "rsc"), { recursive: true });
  fs.mkdirSync(path.join(OUT_DIR, "static"), { recursive: true });
  fs.mkdirSync(path.join(OUT_DIR, "fonts"), { recursive: true });
  fs.mkdirSync(path.join(OUT_DIR, "public"), { recursive: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
}

function promptEnter(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, () => {
      rl.close();
      resolve();
    }),
  );
}

// Convert route (e.g. /two-pointers/two-sum-ii) to a safe filename
function routeToFilename(route) {
  const clean = route.replace(/^\/+|\/+$/g, "").replace(/[\/\?#]/g, "__");
  return clean || "index";
}

async function main() {
  ensureDirs();
  console.log("=====================================================");
  console.log("   BookishEngine DSA Offline Cloner                  ");
  console.log("=====================================================");
  console.log("Launching Chrome to authenticate session...");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: null,
    userDataDir: PROFILE_DIR,
    args: [
      "--start-maximized",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();

  console.log("\nNavigating to https://example.com ...");
  await page.goto(BASE_URL + "/two-pointers/intro", {
    waitUntil: "domcontentloaded",
  });

  console.log("\n-----------------------------------------------------");
  console.log("PLEASE LOG IN TO YOUR ACCOUNT IN THE OPENED CHROME WINDOW");
  console.log("(If you are already logged in, continue below)");
  console.log("-----------------------------------------------------");

  // Monitor for login status or wait for user confirmation
  let isLoggedIn = false;
  const checkLoginInterval = setInterval(async () => {
    try {
      const content = await page.content();
      // Check for user indicator (like Huntlax or Sign In absent or profile menu)
      if (
        content.includes("Huntlax") ||
        (!content.includes("Sign in") && content.includes("day streak"))
      ) {
        isLoggedIn = true;
      }
    } catch (e) {}
  }, 2000);

  // Allow manual bypass / confirmation anytime
  await Promise.race([
    promptEnter(
      "\nPress [ENTER] here once you are logged in in the browser... ",
    ),
    new Promise((resolve) => {
      const waitTimer = setInterval(() => {
        if (isLoggedIn) {
          clearInterval(waitTimer);
          console.log("\n[✓] Login detected automatically!");
          resolve();
        }
      }, 1000);
    }),
  ]);

  clearInterval(checkLoginInterval);

  console.log("\nExtracting session cookies and credentials...");
  const cookies = await page.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  console.log(`[✓] Captured ${cookies.length} session cookies.`);

  // Save session info
  fs.writeFileSync(
    path.join(OUT_DIR, "session.json"),
    JSON.stringify(
      { cookies, cookieHeader, savedAt: new Date().toISOString() },
      null,
      2,
    ),
  );

  console.log("\n=====================================================");
  console.log("Step 1: Mapping all routes across all tracks...");
  console.log("=====================================================");

  const seedUrls = [
    "/two-pointers/intro",
    "/dsa",
    "/lld",
    "/lld/lld-intro/overview",
    "/computer-network",
    "/operating-system",
  ];

  const allRoutes = new Set();
  const staticAssets = new Set();

  for (const seed of seedUrls) {
    try {
      console.log(`Scanning track seed: ${seed} ...`);
      await page.goto(BASE_URL + seed, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      const currentUrl = page.url();
      const relativeCurrent = currentUrl
        .replace(BASE_URL, "")
        .split("?")[0]
        .split("#")[0];
      if (relativeCurrent && relativeCurrent !== "/")
        allRoutes.add(relativeCurrent);

      // Extract all internal links from the page
      const hrefs = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a[href]"));
        return links.map((a) => a.getAttribute("href")).filter(Boolean);
      });

      for (const href of hrefs) {
        const clean = href.split("?")[0].split("#")[0];
        if (
          clean.startsWith("/") &&
          !clean.startsWith("/_next") &&
          !clean.startsWith("/api") &&
          !clean.includes(".") &&
          clean !== "/"
        ) {
          allRoutes.add(clean);
        }
      }
    } catch (e) {
      console.warn(`Warning checking seed ${seed}:`, e.message);
    }
  }

  // Also query the intro page for any hidden problem routes in client json
  try {
    const rawContent = await page.content();
    const patternMatches = [
      ...rawContent.matchAll(/href="(\/[a-zA-Z0-9\-\_\/]+)"/g),
    ].map((m) => m[1]);
    for (const p of patternMatches) {
      if (
        !p.startsWith("/_next") &&
        !p.startsWith("/api") &&
        !p.includes(".") &&
        p !== "/"
      ) {
        allRoutes.add(p);
      }
    }
  } catch (e) {}

  const sortedRoutes = Array.from(allRoutes).sort();
  console.log(`\n[✓] Total lesson routes discovered: ${sortedRoutes.length}`);

  // Save the manifest of routes
  fs.writeFileSync(
    path.join(OUT_DIR, "routes.json"),
    JSON.stringify(sortedRoutes, null, 2),
  );

  console.log("\n=====================================================");
  console.log("Step 2: Downloading all lesson pages & RSC flight data...");
  console.log("=====================================================");

  const fetchWithAuth = async (urlPath, isRsc = false) => {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
      Cookie: cookieHeader,
      Accept: isRsc
        ? "text/x-component"
        : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };
    if (isRsc) {
      headers["RSC"] = "1";
    }

    const res = await fetch(BASE_URL + urlPath, { headers });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${urlPath}`);
    }
    return await res.text();
  };

  // Helper to extract assets from HTML/RSC
  function extractAssetUrls(text) {
    const found = [];
    // JS and CSS chunks (including percent-encoded and bracketed routes)
    const matches = text.matchAll(
      /(?:\/_next\/static\/[a-zA-Z0-9\-\_\/\.%\(\)\[\]]+\.(?:js|css|woff2|png|jpg|svg))/g,
    );
    for (const m of matches) found.push(m[0]);

    // Public images / icons
    const imgMatches = text.matchAll(
      /[\"'](\/[a-zA-Z0-9\-\_\/\.%\(\)\[\]]+\.(?:png|jpg|jpeg|svg|ico|webp))[\"']/g,
    );
    for (const m of imgMatches) {
      if (!m[1].startsWith("/_next")) found.push(m[1]);
    }
    return found;
  }

  let completedRoutes = 0;
  const routeBatchSize = 6;

  for (let i = 0; i < sortedRoutes.length; i += routeBatchSize) {
    const batch = sortedRoutes.slice(i, i + routeBatchSize);
    await Promise.all(
      batch.map(async (route) => {
        const fileKey = routeToFilename(route);
        try {
          // 1. Fetch HTML
          const html = await fetchWithAuth(route, false);
          fs.writeFileSync(path.join(OUT_DIR, "html", `${fileKey}.html`), html);

          // Find assets
          extractAssetUrls(html).forEach((a) => staticAssets.add(a));

          // 2. Fetch RSC flight payload
          try {
            const rsc = await fetchWithAuth(route, true);
            fs.writeFileSync(path.join(OUT_DIR, "rsc", `${fileKey}.rsc`), rsc);
            extractAssetUrls(rsc).forEach((a) => staticAssets.add(a));
          } catch (rscErr) {
            // Some routes might not have separate RSC or redirect
          }

          completedRoutes++;
          process.stdout.write(
            `\r[${completedRoutes}/${sortedRoutes.length}] (${Math.round((completedRoutes / sortedRoutes.length) * 100)}%) Downloaded: ${route.slice(0, 45)}...`,
          );
        } catch (err) {
          console.error(`\nFailed to fetch ${route}:`, err.message);
        }
      }),
    );
  }

  console.log("\n\n=====================================================");
  console.log("Step 3: Downloading static bundles, JS, CSS, fonts...");
  console.log("=====================================================");

  const assetList = Array.from(staticAssets);
  console.log(`Found ${assetList.length} static assets to download.`);

  let completedAssets = 0;
  const assetBatchSize = 10;

  for (let i = 0; i < assetList.length; i += assetBatchSize) {
    const batch = assetList.slice(i, i + assetBatchSize);
    await Promise.all(
      batch.map(async (assetPath) => {
        try {
          const cleanPath = assetPath.split("?")[0];
          const localFilePath = path.join(
            OUT_DIR,
            cleanPath.replace(/^\//, ""),
          );
          fs.mkdirSync(path.dirname(localFilePath), { recursive: true });

          const res = await fetch(BASE_URL + assetPath);
          if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer());
            fs.writeFileSync(localFilePath, buffer);
          }
        } catch (e) {
          // ignore individual asset failure
        } finally {
          completedAssets++;
          process.stdout.write(
            `\rDownloading assets: [${completedAssets}/${assetList.length}]`,
          );
        }
      }),
    );
  }

  console.log("\n\n=====================================================");
  console.log(
    "Step 4: Downloading Google Fonts for complete offline styling...",
  );
  console.log("=====================================================");

  try {
    const fontsCssUrl =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@300..800&family=Montserrat:wght@400..800&family=Onest:wght@400..700&display=swap";
    const fontRes = await fetch(fontsCssUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
      },
    });

    if (fontRes.ok) {
      let fontCss = await fontRes.text();
      const fontUrls = [
        ...fontCss.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^\)]+)\)/g),
      ].map((m) => m[1]);
      console.log(`Downloading ${fontUrls.length} web font files...`);

      let fontIdx = 0;
      for (const fUrl of fontUrls) {
        try {
          const fontFilename = `font_${fontIdx}_${path.basename(fUrl)}`;
          fontIdx++;
          const fRes = await fetch(fUrl);
          if (fRes.ok) {
            const fBuf = Buffer.from(await fRes.arrayBuffer());
            fs.writeFileSync(path.join(OUT_DIR, "fonts", fontFilename), fBuf);
            fontCss = fontCss.replace(fUrl, `/fonts/${fontFilename}`);
          }
        } catch (e) {}
      }
      fs.writeFileSync(path.join(OUT_DIR, "fonts", "fonts.css"), fontCss);
      console.log("[✓] Offline Google Fonts bundle saved!");
    }
  } catch (e) {
    console.warn("Note: Fonts fetch skipped:", e.message);
  }

  await browser.close();

  console.log("\n=====================================================");
  console.log("CLONING COMPLETE! 🚀");
  console.log("=====================================================");
  console.log(
    `Saved ${completedRoutes} lesson pages and ${completedAssets} assets to ./offline_site/`,
  );
  console.log("\nTo launch your offline website anytime:");
  console.log("   npm start");
  console.log("   Then open http://localhost:3000 in your browser.");
  console.log("=====================================================\n");
}

main().catch((err) => {
  console.error("\nFatal error during clone:", err);
  process.exit(1);
});
