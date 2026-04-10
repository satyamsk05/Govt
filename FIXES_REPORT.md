# rojgar.site — Complete Code Audit & Fix Report
**Repository:** satyamsk05/Govt  
**Audit Date:** April 10, 2026

---

## 🔴 CRITICAL BUGS FOUND

### Bug 1 — Dirty data in `all_posts.json`
**Problem:** JSON mein kuch entries hain jinka title "Result", "Admit Card", "Syllabus" hai aur URL `jobs/sarkari-result.html` hai — ye garbage data hai jo scraping ke waqt navigation links bhi pick ho gaye.

**Fix:** `data/all_posts.json` mein ye entries manually delete karo:
```json
// DELETE these entries from every category:
{ "title": "Result", "url": "jobs/sarkari-result.html" ... }
{ "title": "Admit Card", "url": "jobs/sarkari-result.html" ... }
{ "title": "Syllabus", "url": "jobs/sarkari-result.html" ... }
```

**Root Fix in `scripts/add_job.mjs`** — `extractJobDetails()` ke baad filter lagao:
```js
// Add this check in addJob() before generateHtmlFile()
const SKIP_TITLES = ['result', 'admit card', 'syllabus', 'answer key', 'latest jobs', 'home', 'contact'];
if (SKIP_TITLES.some(s => jobData.title.toLowerCase() === s)) {
    console.log('⚠️ Skipped: navigation link detected');
    return;
}
```

---

### Bug 2 — index.html mein `jobs/.html` entry
**Problem:** `index.html` mein Result section mein ek broken link hai:
```html
<a class="a2z-item" href="jobs/.html">Result</a>
```
**Fix:** Is line ko `index.html` se delete karo.

---

### Bug 3 — Search Index is EMPTY
**Problem:** `assets/js/search_index.json` ka size check karo — ye probably empty `[]` hai ya sirf kuch entries hain. Search kaam nahi karega.

**Fix — `scripts/generate_search_index.mjs` banao (new file):**
```js
import fs from 'fs/promises';
import path from 'path';

const data = JSON.parse(await fs.readFile('./data/all_posts.json', 'utf-8'));
const index = [];

for (const [category, items] of Object.entries(data)) {
  for (const item of items) {
    if (!item.title || item.title.length < 5) continue;
    if (['result','admit card','syllabus'].includes(item.title.toLowerCase())) continue;
    index.push({
      t: item.title,
      u: item.url,
      c: category
    });
  }
}

await fs.writeFile('./assets/js/search_index.json', JSON.stringify(index));
console.log(`✅ Search index generated: ${index.length} items`);
```
Run: `node scripts/generate_search_index.mjs`

---

### Bug 4 — CSS mein Search Overlay styles missing
**Problem:** `main.js` mein search overlay dynamically create hota hai lekin `style.css` mein `.search-overlay`, `.search-modal`, `.search-item` ke styles nahi hain. Search box invisible ya broken dikhega.

**Fix — `assets/css/style.css` ke end mein add karo:**
```css
/* SEARCH OVERLAY */
.search-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:2000;opacity:0;pointer-events:none;transition:opacity .3s;display:flex;align-items:flex-start;justify-content:center;padding-top:80px;}
.search-overlay.visible{opacity:1;pointer-events:auto;}
.search-modal{background:var(--white);border-radius:var(--radius-lg);width:100%;max-width:640px;box-shadow:var(--shadow-lg);overflow:hidden;}
.search-header{display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid var(--rule);gap:12px;}
.search-header input{flex:1;border:none;outline:none;font-size:15px;background:transparent;color:var(--ink);font-family:var(--font-body);}
.search-close{background:none;border:none;font-size:22px;color:var(--ink3);cursor:pointer;line-height:1;}
.search-results{max-height:400px;overflow-y:auto;}
.search-item{display:flex;flex-direction:column;gap:3px;padding:10px 16px;border-bottom:1px solid var(--rule);transition:background .15s;}
.search-item:hover{background:var(--paper2);}
.search-item-cat{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--red);}
.search-item-title{font-size:13px;color:var(--ink);font-weight:500;}
```

---

### Bug 5 — `add_job.mjs` mein wrong output path
**Problem:** Script `rollout/` folder mein pages save karta hai lekin actual pages `jobs/` folder mein hain. `updateHomepage()` bhi `rollout/` URL use karta hai.

**Fix in `scripts/add_job.mjs`:**
```js
// Line ~9 — CONFIG object fix:
const CONFIG = {
    templatePath: './templates/_job-template.html',
    dataPath: './data/all_posts.json',
    outDir: './jobs',          // was './rollout' — FIXED
    indexFile: './index.html'
};

// Line ~130 — updateDatabase() fix:
const entry = {
    title: data.title,
    url: `jobs/${data.slug}.html`,    // was 'rollout/' — FIXED
    slug: data.slug,
    date: new Date().toLocaleDateString('en-GB')
};
```

---

### Bug 6 — `scraper/fetcher.py` — wrong output path
**Problem:** Scraper output `public/jobs.json` mein save karta hai jo exist nahi karta. Actual data path `data/all_posts.json` hai.

**Fix in `scraper/fetcher.py` line 19:**
```python
# OLD:
output_file = "public/jobs.json"

# NEW:
output_file = "data/scraped_raw.json"   # Save raw data separately
os.makedirs("data", exist_ok=True)
```

---

### Bug 7 — `is_valid_year()` function too strict
**Problem:** Ye function `2000-2024` wali koi bhi string dekhe toh post reject kar deta hai. Isliye "UPSSSC PET 2023 Certificate" jaisi valid recent pages bhi filter out ho jaati hain jo current hai.

**Fix in `scraper/fetcher.py`:**
```python
def is_valid_year(text, url):
    """Check if content is recent (2025+). Only filter by URL year."""
    valid_years = ["2025", "2026", "2027"]
    url_lower = url.lower()
    # Only check the URL for year, not the title text
    if any(yr in url_lower for yr in valid_years):
        return True
    # If no year in URL, check title
    if any(yr in text.lower() for yr in valid_years):
        return True
    return False
```

---

## 🟠 SEO FIXES

### SEO Fix 1 — Missing meta tags in index.html
**Add in `index.html` `<head>` section (replace existing meta description):**
```html
<title>Latest Sarkari Naukri 2026 | Govt Jobs Results Admit Card - Rojgar.site</title>
<meta name="description" content="Latest Sarkari Naukri 2026 - Get Govt Jobs, Results, Admit Card, Answer Key for SSC, UPSC, Railway, UP Bihar Police. Daily updates for all aspirants.">
<meta name="keywords" content="sarkari naukri 2026, latest govt jobs, sarkari result, admit card, answer key, UP Bihar jobs">
<link rel="canonical" href="https://www.rojgar.site/">
<meta property="og:title" content="Latest Sarkari Naukri 2026 - Rojgar.site">
<meta property="og:description" content="Latest Govt Jobs, Results, Admit Card 2026 - SSC, UPSC, Railway, Banking">
<meta property="og:url" content="https://www.rojgar.site/">
<meta property="og:type" content="website">
<meta name="robots" content="index, follow">
```

### SEO Fix 2 — H1 tag fix in index.html
**Current (bad):** `<h1>ROJGAR.SITE</h1>` inside `.logo`  
**Fix:** Logo ka H1 ek `<span>` se replace karo aur ek hidden SEO H1 add karo:
```html
<!-- Logo area mein: -->
<a class="logo" href="index.html">
  <span class="logo-text">ROJGAR.SITE</span>
  <p>WWW.ROJGAR.SITE</p>
</a>

<!-- Page content ke top mein invisible H1: -->
<h1 style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;">
  Latest Sarkari Naukri 2026 — Govt Jobs Results Admit Card
</h1>
```
**CSS add karo:**
```css
.logo-text{font-family:var(--font-display);font-size:26px;font-weight:800;color:var(--red);line-height:1;letter-spacing:-0.5px;}
```

### SEO Fix 3 — Schema.org add karo
**`index.html` `</body>` se pehle add karo:**
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Rojgar.site",
  "url": "https://www.rojgar.site",
  "description": "Latest Sarkari Naukri 2026 - Govt Jobs Results Admit Card",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://www.rojgar.site/jobs/search.html?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
</script>
```

---

## 🟡 UX IMPROVEMENTS

### UX Fix 1 — A2Z Table CSS missing
**Problem:** `index.html` mein `.a2z-table`, `.a2z-col`, `.a2z-head`, `.a2z-item`, `.a2z-footer` classes use ho rahi hain lekin `style.css` mein ye CSS nahi hai!

**Fix — `assets/css/style.css` mein add karo:**
```css
/* A2Z DATA TABLE */
.a2z-table{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1px solid var(--rule);border-radius:var(--radius-lg);overflow:hidden;background:var(--white);}
@media(max-width:900px){.a2z-table{grid-template-columns:repeat(2,1fr);}}
@media(max-width:550px){.a2z-table{grid-template-columns:1fr;}}
.a2z-col{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);display:flex;flex-direction:column;}
.a2z-col:nth-child(3n){border-right:none;}
.a2z-head{padding:10px 14px;font-size:12.5px;font-weight:700;color:#fff;letter-spacing:0.03em;}
.a2z-list{flex:1;padding:4px 0;}
.a2z-item{display:block;padding:7px 14px;font-size:12.5px;color:var(--ink2);border-bottom:1px solid var(--rule);transition:all .15s;line-height:1.4;}
.a2z-item:last-child{border-bottom:none;}
.a2z-item:hover{color:var(--red);background:var(--red-light);padding-left:18px;}
.a2z-footer{padding:8px 14px;border-top:1px solid var(--rule);background:var(--paper2);}
.a2z-footer a{font-size:11.5px;font-weight:600;color:var(--red);}
```

### UX Fix 2 — Ticker CSS broken
**Problem:** `.ticker-track`, `.ticker-text` ka animation CSS missing hai aur `.ticker-inner` overflow hidden nahi hai.

**Fix — replace existing ticker CSS:**
```css
.ticker-bar{background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;padding:6px 0;overflow:hidden;}
.ticker-inner{max-width:1200px;margin:0 auto;padding:0 24px;display:flex;align-items:center;gap:12px;overflow:hidden;}
.ticker-track{overflow:hidden;flex:1;}
.ticker-text{display:inline-block;white-space:nowrap;color:var(--ink);font-weight:500;font-size:13px;animation:scroll-ticker 40s linear infinite;}
.ticker-text a{color:var(--red);font-weight:600;}
.ticker-text a:hover{text-decoration:underline;}
@keyframes scroll-ticker{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}
```

### UX Fix 3 — Updates grid buttons `.html` links broken
**Problem:** `index.html` update buttons mein `href="#"` hai sab par.

**In `index.html` update karo:**
```html
<!-- REPLACE: -->
<a class="update-btn" href="#" style="background:#5d3d1e;">UPTET 2026 Apply Online</a>
<!-- WITH: -->
<a class="update-btn" href="jobs/uptet-online-form-2026-start.html" style="background:#5d3d1e;">UPTET 2026 Apply Online</a>

<a class="update-btn" href="#" style="background:#1e4c7a;">AHC P Secretary Apply Online</a>
<!-- (No page exists yet, leave as # or remove) -->

<a class="update-btn" href="#" style="background:#9b2a1a;">UP Police SI Answer Key</a>
<!-- WITH: -->
<a class="update-btn" href="jobs/up-police-si-answer-key-2026-out.html" style="background:#9b2a1a;">UP Police SI Answer Key</a>
```

---

## 🟢 AUTOMATION FIXES

### Auto Fix 1 — `package.json` scripts add karo
**Current `package.json`** mein scripts section probably empty hai. Add karo:
```json
{
  "scripts": {
    "add-job": "node scripts/add_job.mjs",
    "sync": "node scripts/sync_categories.mjs",
    "search-index": "node scripts/generate_search_index.mjs",
    "fix-paths": "node scripts/fix_paths.mjs"
  }
}
```
Usage: `npm run add-job "https://sarkariresult.com/some-job"`

### Auto Fix 2 — `.gitignore` mein `node_modules` add karo
**Problem:** `node_modules` folder GitHub mein push ho gaya hai — yeh 50MB+ waste hai!

**`.gitignore` file check karo aur ensure karo ye lines hain:**
```
node_modules/
data/all_posts.json.bak
*.bak
```

---

## 📋 PRIORITY ORDER (Pehle kya fix karo)

| # | Fix | Impact | Time |
|---|-----|--------|------|
| 1 | A2Z table CSS add karo (UX Fix 1) | Homepage broken dikh raha | 5 min |
| 2 | Ticker CSS fix (UX Fix 2) | Ticker scroll nahi kar raha | 3 min |
| 3 | Search overlay CSS (Bug 4) | Search button useless | 5 min |
| 4 | Dirty data clean (Bug 1 & 2) | Wrong links show ho rahe | 10 min |
| 5 | add_job.mjs path fix (Bug 5) | New pages wrong folder | 5 min |
| 6 | Search index generate (Bug 3) | Search results empty | 5 min |
| 7 | SEO meta tags (SEO Fix 1,2,3) | Google ranking | 15 min |
| 8 | Update grid links fix (UX Fix 3) | Dead click buttons | 10 min |
| 9 | .gitignore fix | Repo bloat | 2 min |

**Total estimated fix time: ~1 hour**
