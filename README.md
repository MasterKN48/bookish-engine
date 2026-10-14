# BookishEngine - Interactive DSA & Engineering Visualizer

Run the complete **BookishEngine DSA Visual**, **LLD Visual**, **Networking**, and **Operating Systems** tracks offline with 100% working animations, step player, and interactive navigation — perfect for flights, commuting, or travelling with no internet connection, and ready for static hosting on GitHub Pages.

---

## 🚀 How to Clone (Step-by-Step)

### Step 1: Run the Cloner
In your terminal, navigate to this project folder:
```bash
cd /Users/nitinkumar/Work/dsaCloner
npm run clone
```

### Step 2: Sign In in the Chrome Window
1. A Chrome window will automatically launch and open the course site.
2. Sign in to your account.
3. The script will automatically detect your login (or you can press **Enter** in the terminal).
4. The cloner will:
   - Extract your authenticated session.
   - Scan all ~300 lessons across DSA, LLD, Networking, and OS.
   - Download the full HTML, Next.js React Server Component (RSC) flight payloads, and static JS/CSS/media bundles.
   - Download Google Fonts for offline typography.
   - Automatically apply BookishEngine branding.

---

## ✈️ How to Use Offline While Travelling

Whenever you are offline (no Wi-Fi needed):
```bash
npm start
```
Then open your browser at:
👉 **[http://localhost:3000](http://localhost:3000)**

### What works offline:
- ✅ **Interactive visualizer & step player**: step forward/backward, play/pause, adjust animation speed.
- ✅ **Code & pseudocode viewers**: line highlighting and state tracker.
- ✅ **All track navigations**: sidebar menu, topic switches, and track selector (DSA, LLD, Networking, OS).
- ✅ **Dark theme & typography**: complete styles and fonts bundled locally.

---

## 🌐 Static Hosting on GitHub Pages

You can host this cloned site directly on **GitHub Pages** (or Cloudflare Pages, Netlify, Vercel) without any backend server.

### Option A: Automatic via GitHub Actions (Recommended)
1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "Add static export and GitHub Actions deployment"
   git push origin main
   ```
2. In your GitHub repository:
   - Go to **Settings** → **Pages**.
   - Under **Build and deployment** → **Source**, select **GitHub Actions**.
3. Every time you push to `main`, GitHub Actions will automatically export and deploy your site!

### Option B: Local Export & Manual Deploy
1. Export static files:
   ```bash
   # If deploying to username.github.io/repo-name:
   npm run export:gh-pages

   # Or if deploying to custom domain / root:
   npm run export
   ```
2. Deploy the `dist/` folder using `gh-pages`:
   ```bash
   npx gh-pages -d dist
   ```

### 🛠️ What makes static hosting work:
- **`.nojekyll`**: Tells GitHub Pages not to ignore `_next/` static directories.
- **`sw.js` (Service Worker)**: Automatically mocks the Next.js image optimizer (`/_next/image`) and authentication endpoints directly in the browser with zero backend required.
- **Directory Index Structure**: All 316 routes are converted into `path/index.html` folders for clean URLs.
- **`404.html` fallback**: Preserves client-side routing on GitHub Pages.

