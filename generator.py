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

def generate_pages():
    if not os.path.exists(DATA_FILE):
        print(f"Error: {DATA_FILE} not found.")
        return

    with open(DATA_FILE, 'r') as f:
        master_data = json.load(f)

    with open(TEMPLATE_FILE, 'r') as f:
        template_content = f.read()

    mapping_log = {}

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
            
            page_content = page_content.replace('<!-- DATES -->', dates_html) # Placeholder if I add comment
            # Or use more robust replacements based on existing items
            
            # Since my template had specific strings, I'll use those:
            # Important Dates section
            start_date_str = '<div class="info-item"><span>Application Begin</span> <b>[Date]</b></div>'
            if start_date_str in page_content:
                # Find the parent container or replace the whole list
                # For simplicity, we'll replace the predefined placeholders in our template
                page_content = page_content.replace(
                    '<div class="info-list">\n          <div class="info-item"><span>Application Begin</span> <b>[Date]</b></div>\n          <div class="info-item"><span>Last Date for Apply</span> <b>[Date]</b></div>\n          <div class="info-item"><span>Pay Exam Fee Last Date</span> <b>[Date]</b></div>\n          <div class="info-item"><span>Exam Date</span> <b>[Date/Month]</b></div>\n          <div class="info-item"><span>Admit Card Available</span> <b>[Before Exam]</b></div>\n        </div>',
                    f'<div class="info-list">{dates_html}</div>'
                )

                page_content = page_content.replace(
                    '<div class="info-list">\n          <div class="info-item"><span>General / OBC / EWS</span> <b>₹ [Amount]</b></div>\n          <div class="info-item"><span>SC / ST / PH</span> <b>₹ [Amount]</b></div>\n          <div class="info-item"><span>All Category Female</span> <b>₹ [Amount]</b></div>',
                    f'<div class="info-list">{fees_html}'
                )

                page_content = page_content.replace(
                    '<tr>\n              <td><b>[Post Category 1]</b></td>\n              <td>[Count]</td>\n              <td>[Requirements/Degree]</td>\n            </tr>',
                    v_rows
                )

                page_content = page_content.replace(
                    '<tr>\n            <td class="action-label">Apply Online</td>\n            <td><a href="#" class="action-link-btn">Click Here</a></td>\n          </tr>\n          <tr>\n            <td class="action-label">Download Notification</td>\n            <td><a href="#" class="action-link-btn">Click Here</a></td>\n          </tr>\n          <tr>\n            <td class="action-label">Official Website</td>\n            <td><a href="#" class="action-link-btn">Click Here</a></td>\n          </tr>',
                    l_rows
                )
            
            # Age limit
            page_content = page_content.replace('Min Age: <b>[Years]</b>', f'Age Detail:').replace('Max Age: <b>[Years]</b>', f'<b>{age_limit}</b>')

            filename = slugify(item["title"])
            filepath = os.path.join(OUTPUT_DIR, filename)
            
            with open(filepath, 'w') as f:
                f.write(page_content)
            
            mapping_log[cat].append({
                "original_title": item["title"],
                "local_path": f"{OUTPUT_DIR}/{filename}"
            })

    # Save mapping for integration
    with open("mapping.json", 'w') as f:
        json.dump(mapping_log, f, indent=2)
    
    print(f"Generation complete. Mapping saved to mapping.json")

if __name__ == "__main__":
    generate_pages()
