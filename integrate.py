import os
import json
from bs4 import BeautifulSoup
import re

# CONFIGURATION
MAPPING_FILE = "mapping.json"
DATA_FILE = "scraped_data.json"
INDEX_FILE = "index.html"
SEARCH_INDEX_FILE = "assets/js/search_index.json"

PAGES_TO_UPDATE = {
    "Latest Jobs": "latest-jobs.html",
    "Result": "results.html",
    "Admit Card": "admit-card.html",
    "Answer Key": "answer-key.html",
    "Syllabus": "syllabus.html"
}

def get_mapping():
    if not os.path.exists(MAPPING_FILE):
        return {}
    with open(MAPPING_FILE, 'r') as f:
        return json.load(f)

def get_master_data():
    if not os.path.exists(DATA_FILE):
        return {}
    with open(DATA_FILE, 'r') as f:
        return json.load(f)

def update_a2z_on_index(soup, mapping):
    tds = soup.find_all('div', class_="a2z-col")
    count = 0
    for div in tds:
        head = div.find('div', class_="a2z-head")
        if head:
            cat_name = head.get_text(strip=True)
            if cat_name in mapping:
                items = mapping[cat_name]
                links = div.find_all('a', class_="a2z-item")
                for link in links:
                    title = link.get_text(strip=True)
                    for item in items:
                        if title.lower() in item["original_title"].lower() or item["original_title"].lower() in title.lower():
                            link['href'] = item["local_path"]
                            count += 1
                            break
    print(f"  Updated {count} links in index.html A2Z grid.")

def update_list_page(filename, cat_name, mapping, master_data):
    if not os.path.exists(filename):
        print(f"  Warning: {filename} not found.")
        return

    with open(filename, 'r') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')

    items = master_data.get(cat_name, [])
    if not items:
        print(f"  No items for {cat_name}")
        return

    # Method 1: Grid structure (Latest Jobs, Results, Admit Card)
    grid = soup.find('div', class_=re.compile(r'(job|res|adm|admit|ans|syl)-grid'))
    if grid:
        grid.clear()
        card_class = "job-card"
        info_class = "job-info"
        btn_class = "apply-btn"
        btn_text = "Apply"
        
        if "results" in filename:
            card_class = "res-card"
            info_class = "res-info"
            btn_class = "download-btn"
            btn_text = "Result"
        elif "admit-card" in filename:
            card_class = "adm-card"
            info_class = "adm-info"
            btn_class = "download-btn"
            btn_text = "Download"

        for item in items:
            local_path = item["url"]
            for m in mapping.get(cat_name, []):
                if m["original_title"] == item["title"]:
                    local_path = m["local_path"]; break
            
            new_card = soup.new_tag("div", attrs={"class": card_class})
            info_div = soup.new_tag("div", attrs={"class": info_class})
            h3 = soup.new_tag("h3"); h3.string = item["title"]
            p = soup.new_tag("p"); p.string = "Check Local Link"
            info_div.append(h3); info_div.append(p)
            a = soup.new_tag("a", attrs={"class": btn_class, "href": local_path}); a.string = btn_text
            new_card.append(info_div); new_card.append(a)
            grid.append(new_card)
        print(f"  Updated GRID in {filename}")

    # Method 2: Card structure (Answer Key, Syllabus)
    else:
        card = soup.find('div', class_="card")
        if card:
            # Keep the header
            head = card.find('div', class_="card-head")
            card.clear()
            if head: card.append(head)
            
            for item in items:
                local_path = item["url"]
                for m in mapping.get(cat_name, []):
                    if m["original_title"] == item["title"]:
                        local_path = m["local_path"]; break
                
                item_div = soup.new_tag("div", attrs={"class": "job-item"})
                inner_div = soup.new_tag("div")
                a = soup.new_tag("a", attrs={"class": "job-title", "href": local_path})
                a.string = item["title"]
                inner_div.append(a)
                item_div.append(inner_div)
                card.append(item_div)
            print(f"  Updated CARD in {filename}")
        else:
            print(f"  Error: No recognizable container in {filename}")

    with open(filename, 'w') as f:
        f.write(soup.prettify())

def generate_search_index(mapping, master_data):
    search_index = []
    for cat, items in master_data.items():
        for item in items:
            local_path = item["url"]
            for m in mapping.get(cat, []):
                if m["original_title"] == item["title"]:
                    local_path = m["local_path"]; break
            search_index.append({"t": item["title"], "u": local_path, "c": cat})
    
    os.makedirs(os.path.dirname(SEARCH_INDEX_FILE), exist_ok=True)
    with open(SEARCH_INDEX_FILE, 'w') as f:
        json.dump(search_index, f)
    print(f"  Search index generated.")

def main():
    mapping = get_mapping()
    master_data = get_master_data()
    if not mapping or not master_data: return

    if os.path.exists(INDEX_FILE):
        with open(INDEX_FILE, 'r') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')
        update_a2z_on_index(soup, mapping)
        with open(INDEX_FILE, 'w') as f: f.write(soup.prettify())

    for cat, filename in PAGES_TO_UPDATE.items():
        update_list_page(filename, cat, mapping, master_data)

    generate_search_index(mapping, master_data)

if __name__ == "__main__":
    main()
