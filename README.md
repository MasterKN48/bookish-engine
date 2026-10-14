# ChaiCode Offline DSA & Course Cloner

Clone and run the complete **ChaiCode DSA Visual**, **LLD Visual**, **Networking**, and **Operating Systems** tracks offline with 100% working animations, step player, and interactive navigation — perfect for flights, commuting, or travelling with no internet connection.

---

## 🚀 How to Clone (Step-by-Step)

### Step 1: Run the Cloner
In your terminal, navigate to this project folder:
```bash
cd /Users/nitinkumar/Work/dsaCloner
npm run clone
```

### Step 2: Sign In in the Chrome Window
1. A Chrome window will automatically launch and open `https://dsa.chaicode.com`.
2. Sign in to your ChaiCode account (with your username, e.g. **Huntlax**).
3. The script will automatically detect your login (or you can press **Enter** in the terminal).
4. The cloner will:
   - Extract your authenticated session.
   - Scan all ~300 lessons across DSA, LLD, Networking, and OS.
   - Download the full HTML, Next.js React Server Component (RSC) flight payloads, and static JS/CSS/media bundles.
   - Download Google Fonts for offline typography.

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
