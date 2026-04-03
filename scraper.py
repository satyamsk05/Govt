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
MAX_PAGES_PER_CAT = 40  # Support mass rollout of 100+ pages

# Create output directories
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text).strip('-')
    return text

def scrape_homepage():
    print(f"Scraping homepage: {BASE_URL}")
    try:
        response = requests.get(BASE_URL, timeout=15)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        categories = {}
        # The categories are in boxes (box1, box2, box3, etc.)
        # Each category header is inside a div with id="font"
        target_cats = ["Result", "Admit Card", "Latest Jobs", "Answer Key", "Syllabus", "Admission", "Important", "Certificate Verification"]
        
        # Find all boxes
        boxes = soup.find_all('div', id=re.compile(r'box\d+'))
        
        for box in boxes:
            header_div = box.find('div', id="font")
            if header_div:
                cat_name = header_div.get_text(strip=True)
                # Match against our targets
                matched_cat = None
                for tc in target_cats:
                    if tc.lower() in cat_name.lower():
                        matched_cat = tc
                        break
                
                if matched_cat:
                    print(f"  Scraping Category: {matched_cat}")
                    categories[matched_cat] = []
                    # Find all links in LI tags within this box
                    li_links = box.find_all('li')
                    for li in li_links:
                        link = li.find('a')
                        if link:
                            href = link.get('href')
                            title = link.get_text(strip=True)
                            if href and title and len(title) > 10:
                                if not href.startswith('http'): href = urljoin(BASE_URL, href)
                                
                                # Avoid duplicates
                                if not any(item["url"] == href for item in categories[matched_cat]):
                                    categories[matched_cat].append({
                                        "title": title,
                                        "url": href,
                                        "slug": slugify(title)
                                    })
                                    if len(categories[matched_cat]) >= MAX_PAGES_PER_CAT:
                                        break
        
        return categories
    except Exception as e:
        print(f"Error scraping homepage: {e}")
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
        
        # 1. Title/Header
        header = soup.find('h1')
        if header: data["title"] = header.get_text(strip=True)
        
        # 2. Main Table (contains almost everything)
        main_table = soup.find('table', border="1") or soup.find('table', cellpadding="10")
        if main_table:
            rows = main_table.find_all('tr')
            for row in rows:
                text = row.get_text().lower()
                
                # Org Name (usually first row)
                if not data["org"] and ("commission" in text or "board" in text or "department" in text):
                    data["org"] = row.get_text(strip=True)
                
                # Dates & Fees (often side-by-side in one row with two sub-cells)
                if "important dates" in text or "application fee" in text:
                    cells = row.find_all('td')
                    for cell in cells:
                        cell_text = cell.get_text(strip=True)
                        if "dates" in cell_text.lower():
                            # Extract dates
                            lines = cell.get_text("\n").split("\n")
                            for line in lines:
                                if ":" in line:
                                    k, v = line.split(":", 1)
                                    data["dates"][k.strip()] = v.strip()
                        elif "fee" in cell_text.lower():
                            # Extract fees
                            lines = cell.get_text("\n").split("\n")
                            data["fees"] = [l.strip() for l in lines if l.strip() and ":" in l]

                # Age Limit
                if "age limit" in text:
                    data["age_limit"] = row.get_text(strip=True)

                # Short Info
                if "short information" in text:
                    data["short_info"] = row.get_text(strip=True).replace("Short Information :", "")

            # Vacancy Details (usually another header in the table)
            # This is harder to parse generically, but we'll try to find a table with 'Post Name'
            vacancy_sec = soup.find(string=re.compile(r'Vacancy Details', re.I))
            if vacancy_sec:
                v_table = vacancy_sec.find_parent('table')
                if v_table:
                    v_rows = v_table.find_all('tr')
                    for vr in v_rows[1:]: # Skip header
                        v_tds = vr.find_all('td')
                        if len(v_tds) >= 3:
                            data["vacancy_table"].append({
                                "name": v_tds[0].get_text(strip=True),
                                "total": v_tds[1].get_text(strip=True),
                                "eligibility": v_tds[2].get_text(strip=True)
                            })

        # 3. Links Table (bottom)
        links_table = soup.find('table', align="center") or soup.find(string=re.compile(r'Useful Important Links', re.I))
        if links_table:
            if not hasattr(links_table, 'find_all'): # if it's a string
                links_table = links_table.find_parent('table')
            
            if links_table:
                l_rows = links_table.find_all('tr')
                for lr in l_rows:
                    a = lr.find('a')
                    if a and a.get('href'):
                        label = lr.find('td')
                        if label:
                            data["links"].append({
                                "text": label.get_text(strip=True),
                                "href": a.get('href')
                            })

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
