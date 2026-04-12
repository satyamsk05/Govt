import json
import os
from datetime import datetime

def generate_sitemap():
    try:
        with open('./data/all_posts.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        base_url = 'https://rojgar.site/'
        today = datetime.now().strftime('%Y-%m-%d')
        
        xml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        ]
        
        # Static pages
        main_pages = [
            '',
            'jobs/latest-jobs.html',
            'jobs/results.html',
            'jobs/admit-card.html',
            'jobs/answer-key.html',
            'jobs/syllabus.html',
            'jobs/admission.html',
            'disclaimer.html'
        ]
        
        for page in main_pages:
            xml.append('  <url>')
            xml.append(f'    <loc>{base_url}{page}</loc>')
            xml.append(f'    <lastmod>{today}</lastmod>')
            xml.append('    <changefreq>daily</changefreq>')
            xml.append(f'    <priority>{"1.0" if page == "" else "0.8"}</priority>')
            xml.append('  </url>')
            
        # Dynamic job pages
        seen_urls = set()
        count = 0
        for category, items in data.items():
            for item in items:
                url = item.get('url', '').replace('../', '')
                title = item.get('title', '')
                
                if not url or url == 'jobs/.html' or url == '.html':
                    continue
                if url in seen_urls:
                    continue
                if not title or len(title) < 5:
                    continue
                if title.lower() in ['result', 'admit card']:
                    continue
                
                seen_urls.add(url)
                count += 1
                
                xml.append('  <url>')
                xml.append(f'    <loc>{base_url}{url}</loc>')
                xml.append(f'    <lastmod>{today}</lastmod>')
                xml.append('    <changefreq>monthly</changefreq>')
                xml.append('    <priority>0.6</priority>')
                xml.append('  </url>')
                
        xml.append('</urlset>')
        
        with open('./sitemap.xml', 'w', encoding='utf-8') as f:
            f.write('\n'.join(xml))
            
        print(f"✅ Sitemap generated: {len(seen_urls) + len(main_pages)} URLs")
        
    except Exception as e:
        print(f"❌ Failed to generate sitemap: {e}")

if __name__ == "__main__":
    generate_sitemap()
