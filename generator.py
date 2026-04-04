import os
import json
import re

# CONFIGURATION
DATA_FILE = "scraped_data.json"
TEMPLATE_FILE = "_job-template.html"
OUTPUT_DIR = "rollout"

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text).strip('-')
    return f"{text}.html"

def get_tags(item):
    tags = {"qual": [], "state": []}
    text = (item.get("title", "") + " " + item.get("details", {}).get("org", "") + " " + \
            " ".join([v.get("eligibility", "") for v in item.get("details", {}).get("vacancy_table", [])])).lower()
    
    # Qualification Keywords
    if any(k in text for k in ["10th", "high school", "matric"]): tags["qual"].append("10th Pass")
    if any(k in text for k in ["12th", "intermediate", "inter "]): tags["qual"].append("12th Pass")
    if any(k in text for k in ["graduate", "degree", "bachelor", "ba ", "bsc", "bcom", "b.a", "b.sc", "b.com"]): tags["qual"].append("Graduate")
    if any(k in text for k in ["iti", "diploma", "polytechnic"]): tags["qual"].append("ITI/Diploma")
    
    # State Keywords
    if any(k in text for k in ["up ", "uttar pradesh", "upsssc", "uppsc"]): tags["state"].append("Uttar Pradesh")
    elif any(k in text for k in ["bihar", "bpsc", "bssc"]): tags["state"].append("Bihar")
    elif any(k in text for k in ["mp ", "madhya pradesh", "mppsc"]): tags["state"].append("Madhya Pradesh")
    elif any(k in text for k in ["rajasthan", "rpsc", "rsmssb"]): tags["state"].append("Rajasthan")
    elif any(k in text for k in ["haryana", "hssc", "hpsc"]): tags["state"].append("Haryana")
    elif any(k in text for k in ["delhi", "dsssb"]): tags["state"].append("Delhi")
    
    return tags

def generate_sitemap(all_pages):
    print("Generating sitemap.xml...")
    base_url = "https://rojgar.site/"
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    sitemap += f'  <url><loc>{base_url}</loc><priority>1.0</priority></url>\n'
    for page in all_pages:
        sitemap += f'  <url><loc>{base_url}{page}</loc><priority>0.8</priority></url>\n'
    sitemap += '</urlset>'
    with open("sitemap.xml", "w") as f:
        f.write(sitemap)

def generate_pages():
    if not os.path.exists(DATA_FILE):
        print(f"Error: {DATA_FILE} not found.")
        return

    with open(DATA_FILE, 'r') as f:
        master_data = json.load(f)

    with open(TEMPLATE_FILE, 'r') as f:
        template_content = f.read()

    mapping_log = {}
    all_generated_files = []
    
    # For index enrichment
    qual_buckets = {"10th Pass": [], "12th Pass": [], "Graduate": [], "ITI/Diploma": []}
    state_buckets = {"Uttar Pradesh": [], "Bihar": [], "Delhi": [], "Madhya Pradesh": [], "Rajasthan": [], "Haryana": []}

    for cat, items in master_data.items():
        mapping_log[cat] = []
        for item in items:
            details = item.get("details")
            if not details: continue

            print(f"Generating page for: {item['title']}")
            
            # Prepare Data for Template
            title = details.get("title", item["title"])
            org = details.get("org", "Government Organization")
            short_info = details.get("short_info", "Detailed Recruitment Information")
            
            # Get Tags for Categorization
            tags = get_tags(item)

            # Construct Dates HTML
            dates_html = ""
            for k, v in details.get("dates", {}).items():
                dates_html += f'<div class="info-item"><span>{k}</span> <b>{v}</b></div>\n'
            if not dates_html: dates_html = '<div class="info-item"><span>Status</span> <b>Active</b></div>'

            # Construct Fees HTML
            fees_html = ""
            for fee in details.get("fees", []):
                if ":" in fee:
                    k, v = fee.split(":", 1)
                    fees_html += f'<div class="info-item"><span>{k.strip()}</span> <b>{v.strip()}</b></div>\n'
                else:
                    fees_html += f'<div class="info-item"><span>Fee</span> <b>{fee.strip()}</b></div>\n'
            if not fees_html: fees_html = '<div class="info-item"><span>Fee</span> <b>As per Notification</b></div>'

            # Construct Vacancy Rows
            v_rows = ""
            for v in details.get("vacancy_table", []):
                v_rows += f'<tr><td><b>{v["name"]}</b></td><td>{v["total"]}</td><td>{v["eligibility"]}</td></tr>\n'
            if not v_rows:
                v_rows = '<tr><td colspan="3" style="text-align:center;">Refer to the Notification for Detailed Vacancies</td></tr>'

            # Construct Links Rows
            l_rows = ""
            for link in details.get("links", []):
                l_rows += f'<tr><td class="action-label">{link["text"]}</td><td><a href="{link["href"]}" class="action-link-btn" target="_blank">Click Here</a></td></tr>\n'
            if not l_rows:
                l_rows = '<tr><td colspan="2" style="text-align:center;">Check Official Notification for Detailed Links</td></tr>'

            # Construct Age Limit
            age_limit = details.get("age_limit", "As per Recruitment Rules")

            # Perform Replacements
            page_content = template_content
            page_content = page_content.replace("[Organization Name]", org)
            page_content = page_content.replace("[Exam Name/Post Name 2026]", title)
            page_content = page_content.replace("[Job Title Here]", title)
            page_content = (page_content.replace("<span>Post Date: <b>[Date]</b></span>", f"<span>Post Date: <b>Latest Update</b></span>")
                            .replace("<span>Short Info: <b>[Brief Summary of Recruitment]</b></span>", f"<span>Short Info: <b>{short_info}</b></span>"))
            
            # Simple list replacement for Dates
            dates_placeholder = '<div class="info-list">\n          <div class="info-item"><span>Application Begin</span> <b>[Date]</b></div>\n          <div class="info-item"><span>Last Date for Apply</span> <b>[Date]</b></div>\n          <div class="info-item"><span>Pay Exam Fee Last Date</span> <b>[Date]</b></div>\n          <div class="info-item"><span>Exam Date</span> <b>[Date/Month]</b></div>\n          <div class="info-item"><span>Admit Card Available</span> <b>[Before Exam]</b></div>\n        </div>'
            if dates_placeholder in page_content:
                page_content = page_content.replace(dates_placeholder, f'<div class="info-list">{dates_html}</div>')
            else:
                # Fallback if indent varies
                page_content = re.sub(r'<div class="info-list">.*?<div class="info-item"><span>Application Begin</span>.*?</div>.*?</div>', f'<div class="info-list">{dates_html}</div>', page_content, flags=re.DOTALL)

            fees_placeholder = '<div class="info-list">\n          <div class="info-item"><span>General / OBC / EWS</span> <b>₹ [Amount]</b></div>\n          <div class="info-item"><span>SC / ST / PH</span> <b>₹ [Amount]</b></div>\n          <div class="info-item"><span>All Category Female</span> <b>₹ [Amount]</b></div>'
            page_content = page_content.replace(fees_placeholder, f'<div class="info-list">{fees_html}')

            v_placeholder = '<tr>\n              <td><b>[Post Category 1]</b></td>\n              <td>[Count]</td>\n              <td>[Requirements/Degree]</td>\n            </tr>'
            page_content = page_content.replace(v_placeholder, v_rows)

            l_placeholder = '<tr>\n            <td class="action-label">Apply Online</td>\n            <td><a href="#" class="action-link-btn">Click Here</a></td>\n          </tr>\n          <tr>\n            <td class="action-label">Download Notification</td>\n            <td><a href="#" class="action-link-btn">Click Here</a></td>\n          </tr>\n          <tr>\n            <td class="action-label">Official Website</td>\n            <td><a href="#" class="action-link-btn">Click Here</a></td>\n          </tr>'
            page_content = page_content.replace(l_placeholder, l_rows)
            
            # Age limit
            page_content = page_content.replace('Min Age: <b>[Years]</b>', f'Age Detail:').replace('Max Age: <b>[Years]</b>', f'<b>{age_limit}</b>')

            filename = slugify(item["title"])
            filepath = os.path.join(OUTPUT_DIR, filename)
            
            with open(filepath, 'w') as f:
                f.write(page_content)
            
            all_generated_files.append(f"{OUTPUT_DIR}/{filename}")
            
            item_entry = {
                "title": item["title"],
                "path": f"{OUTPUT_DIR}/{filename}",
                "tags": tags
            }
            mapping_log[cat].append(item_entry)
            
            # Add to buckets for index
            for q in tags["qual"]:
                if q in qual_buckets: qual_buckets[q].append(item_entry)
            for s in tags["state"]:
                if s in state_buckets: state_buckets[s].append(item_entry)

    # Save mapping
    with open("mapping.json", 'w') as f:
        json.dump(mapping_log, f, indent=2)
    
    # Generate Sitemap
    generate_sitemap(all_generated_files)
    
    # Enrichment: Update Index categorization links (Optional: can be done via another script or here)
    # For now, let's just finish the major logic.

    print(f"Generation complete. {len(all_generated_files)} pages created.")

if __name__ == "__main__":
    generate_pages()
