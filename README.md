# Rojgar.site — Govt Jobs Portal

Rojgar.site is a high-performance, SEO-optimized government jobs portal designed to provide real-time updates for Sarkari results, admit cards, and latest job notifications.

## 🚀 Technology Stack

- **Frontend**: Pure HTML5, CSS3 (Vanilla), and Vanilla JavaScript.
- **Backend/Scripts**: Node.js and Python for data management and scraping.
- **Data Storage**: JSON-based flat-file database (`data/all_posts.json`).
- **Scraper**: Python-based engine (`scraper/fetcher.py`).

## 📁 Project Structure

- `/assets`: CSS and JS files.
- `/data`: JSON data sources.
- `/jobs`: Generated HTML pages for job notifications.
- `/scripts`: Automation scripts (sync, sitemap, index generation).
- `/scraper`: Web scraping logic.
- `/templates`: HTML templates for generating job pages.

## 🛠️ Key Scripts

### 📋 Automation (Node.js/Python)

- **Sitemap Generation**:
  ```bash
  # Regenerates the sitemap.xml from all_posts.json
  python3 scripts/generate_sitemap.py
  ```
- **Search Index Generation**:
  ```bash
  # Updates the search index for the portal
  node scripts/generate_search_index.mjs
  ```
- **Sync Categories**:
  ```bash
  # Synchronizes job categories with the homepage
  node scripts/sync_categories.mjs
  ```

## 🛠️ Recent Improvements & Repairs

- ✅ **SEO Optimization**: Fixed `lang="hi"` mismatch, demoted logo `<h1>`, and removed broken `.html` links.
- ✅ **Data Integrity**: Cleaned up garbage/placeholder entries (`sarkari-result.html`) and handled duplicate entries.
- ✅ **Code Quality**: Moved inline CSS/JS to external files and introduced professional utility classes.
- ✅ **Git Hygiene**: Removed `node_modules` from version tracking.
- ✅ **Sitemap Automation**: Introduced a Python-based script to manage `sitemap.xml` automatically.

## 🛡️ Disclaimer

Rojgar.site is an informational portal. Candidates are advised to cross-verify all information with official government websites.
