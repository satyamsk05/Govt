import os
import json
import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import urljoin

# CONFIGURATION
BASE_URL = "https://www.sarkariresult.com/"
OUTPUT_DIR = "rollout"
DATA_FILE = "scraped_data.json"
MAX_PAGES_PER_CAT = 50

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text).strip('-')
    return text

def scrape_homepage():
    print(f"Scraping homepage: {BASE_URL}")
    categories = {}
    try:
        response = requests.get(BASE_URL, timeout=15)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # 🎯 STRATEGY: Find every <ul> and its parent. 
        # If the parent or its siblings contain category names, it's a target.
        target_cats = ["Result", "Admit Card", "Latest Jobs", "Answer Key", "Syllabus"]
        
        all_uls = soup.find_all('ul')
        print(f"Found {len(all_uls)} lists on homepage.")
        
        for ul in all_uls:
            # Look up for a header
            parent = ul.find_parent('div')
            if not parent: continue
            
            # Check for header in this div or its previous siblings
            header_text = ""
            # Some boxes have <div id="font">
            font_div = parent.find('div', id="font")
            if font_div:
                header_text = font_div.get_text(strip=True)
            else:
                # Try finding any link that looks like a header (red/blue/green boxes)
                header_text = parent.get_text(strip=True).split('\n')[0]

            matched_cat = None
            for tc in target_cats:
                if tc.lower() in header_text.lower():
                    matched_cat = tc
                    break
            
            if matched_cat:
                if matched_cat not in categories: categories[matched_cat] = []
                print(f"  Scraping Category: {matched_cat}")
                
                links = ul.find_all('a')
                for link in links:
                    href = link.get('href')
                    title = link.get_text(strip=True)
                    if href and title and len(title) > 10:
                        if not href.startswith('http'): href = urljoin(BASE_URL, href)
                        
                        if not any(item["url"] == href for item in categories[matched_cat]):
                            categories[matched_cat].append({
                                "title": title,
                                "url": href,
                                "slug": slugify(title)
                            })
                            if len(categories[matched_cat]) >= MAX_PAGES_PER_CAT: break

        return categories
    except Exception as e:
        print(f"Error scraping: {e}")
        return {}

def scrape_detail_page(url):
    print(f"  Scraping detail: {url}")
    try:
        response = requests.get(url, timeout=15)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        data = {
            "title": "",
            "org": "",
            "short_info": "",
            "dates": {},
            "fees": [],
            "age_limit": "",
            "vacancy_total": "",
            "vacancy_table": [],
            "links": []
        }
        
        header = soup.find('h1')
        if header: data["title"] = header.get_text(strip=True)
        
        # Main Table Extraction
        main_table = soup.find('table', border="1") or soup.find('table', cellpadding="10")
        if main_table:
            rows = main_table.find_all('tr')
            for row in rows:
                text = row.get_text().lower()
                if not data["org"] and ("commission" in text or "board" in text or "department" in text):
                    data["org"] = row.get_text(strip=True)
                
                # Dates & Fees
                if "dates" in text or "application fee" in text:
                    cells = row.find_all('td')
                    for cell in cells:
                        if "dates" in cell.get_text().lower():
                            for line in cell.get_text("\n").split("\n"):
                                if ":" in line:
                                    k, v = line.split(":", 1)
                                    data["dates"][k.strip()] = v.strip()
                        elif "fee" in cell.get_text().lower():
                            data["fees"] = [l.strip() for l in cell.get_text("\n").split("\n") if ":" in l]

                if "age limit" in text: data["age_limit"] = row.get_text(strip=True)
                if "short information" in text: data["short_info"] = row.get_text(strip=True).replace("Short Information :", "")

            # Vacancy
            v_sec = soup.find(string=re.compile(r'Vacancy Details', re.I))
            if v_sec:
                v_table = v_sec.find_parent('table')
                if v_table:
                    for vr in v_table.find_all('tr')[1:]:
                        v_tds = vr.find_all('td')
                        if len(v_tds) >= 3:
                            data["vacancy_table"].append({
                                "name": v_tds[0].get_text(strip=True),
                                "total": v_tds[1].get_text(strip=True),
                                "eligibility": v_tds[2].get_text(strip=True)
                            })

        # Links
        links_table = soup.find('table', align="center") or soup.find(string=re.compile(r'Important Links', re.I))
        if links_table:
            if not hasattr(links_table, 'find_all'): links_table = links_table.find_parent('table')
            if links_table:
                for lr in links_table.find_all('tr'):
                    a = lr.find('a')
                    if a and a.get('href'):
                        label = lr.find('td')
                        if label: data["links"].append({"text": label.get_text(strip=True), "href": a.get('href')})

        return data
    except Exception as e:
        print(f"Error scraping detail: {e}")
        return None

def main():
    categories = scrape_homepage()
    master_data = {}
    for cat, items in categories.items():
        print(f"Processing Category: {cat}")
        master_data[cat] = []
        for item in items:
            detail_data = scrape_detail_page(item["url"])
            if detail_data:
                item["details"] = detail_data
                master_data[cat].append(item)
    
    with open(DATA_FILE, 'w') as f:
        json.dump(master_data, f, indent=2)
    
    print(f"Scraping complete. Data saved to {DATA_FILE}")

if __name__ == "__main__":
    main()
