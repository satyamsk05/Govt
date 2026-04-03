import os
import json
from bs4 import BeautifulSoup

# CONFIGURATION
MAPPING_FILE = "mapping.json"
INDEX_FILE = "index.html"

def update_index():
    if not os.path.exists(MAPPING_FILE):
        print(f"Error: {MAPPING_FILE} not found.")
        return

    with open(MAPPING_FILE, 'r') as f:
        mapping = json.load(f)

    with open(INDEX_FILE, 'r') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')

    # Find the A2Z columns
    tds = soup.find_all('div', class_="a2z-col")
    
    for div in tds:
        head = div.find('div', class_="a2z-head")
        if head:
            cat_name = head.get_text(strip=True)
            if cat_name in mapping:
                items = mapping[cat_name]
                links = div.find_all('a', class_="a2z-item")
                # Map based on title comparison
                for link in links:
                    title = link.get_text(strip=True)
                    for item in items:
                        if title.lower() in item["original_title"].lower() or item["original_title"].lower() in title.lower():
                            link['href'] = item["local_path"]
                            print(f"Updated link: {title} -> {item['local_path']}")
                            break

    with open(INDEX_FILE, 'w') as f:
        f.write(str(soup))
    
    print(f"Integration complete. {INDEX_FILE} updated.")

if __name__ == "__main__":
    update_index()
