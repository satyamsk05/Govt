import json
import os
import re
from datetime import datetime
from scrapling.fetchers import StealthyFetcher

def is_valid_year(text, url):
    """
    Checks if the content is from 2025 or newer.
    Strictly filters out anything containing 2000-2024.
    """
    valid_years = ["2025", "2026", "2027", "2028"]
    invalid_years = [str(y) for y in range(2000, 2025)]
    
    text_lower = text.lower()
    url_lower = url.lower()
    
    # Check for invalid years first to be strict
    if any(yr in text_lower or yr in url_lower for yr in invalid_years):
        return False
        
    # Check if a valid year is present
    if any(yr in text_lower or yr in url_lower for yr in valid_years):
        return True
        
    # Special case: If no year is found but the post is very recent (no year in title)
    # We might allow it if it's from 2026 specifically (future-proof)
    return False

def scrape_jobs():
    # Target official job sites
    sources = [
        {"name": "SarkariResult.com.cm", "url": "https://sarkariresult.com.cm/latest-jobs/", "base": "https://sarkariresult.com.cm"},
        {"name": "SarkariResult.com", "url": "https://www.sarkariresult.com/latestjob/", "base": "https://www.sarkariresult.com"},
        {"name": "RojgarResult", "url": "https://www.rojgarresult.com/", "base": "https://www.rojgarresult.com"}
    ]
    
    all_jobs = []
    output_file = "public/jobs.json"
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    try:
        # Initialize Scrapling StealthyFetcher
        fetcher = StealthyFetcher(headless=True, network_idle=True)
        
        for source in sources:
            print(f"🌀 Scraping {source['name']}...")
            try:
                page = fetcher.get(source['url'])
                # Using broad adaptive selector to capture all potential job anchors
                job_links = page.css('a', auto_save=True)
                
                keywords = ['job', 'recruitment', 'online', 'apply', 'form', 'bharti', 'exam', 'post', 'vacancy', 'admit', 'result']
                source_count = 0
                
                for anchor in job_links:
                    title = anchor.clean_text
                    link = anchor.attrib.get('href', '')
                    
                    if not link or link.startswith('#') or any(ex in link for ex in ['facebook', 'twitter', 'telegram', 'whatsapp']):
                        continue
                    
                    # Apply "2025 or newer" Rule
                    if not is_valid_year(title, link):
                        continue
                        
                    # Filter generic navigation
                    if any(nav in title.lower() for nav in ['home', 'contact', 'about', 'disclaimer', 'privacy', 'latest jobs', 'admit card', 'results']):
                        continue
                        
                    if not title or len(title) < 6:
                        continue
                        
                    title_lower = title.lower()
                    if not any(kw in title_lower for kw in keywords):
                        continue
                    
                    # Final standardization
                    if link.startswith('/'):
                        link = source['base'] + (link if link.startswith('/') else '/' + link)
                        
                    all_jobs.append({
                        "title": title,
                        "link": link,
                        "source": source['name'],
                        "scraped_at": datetime.now().isoformat()
                    })
                    source_count += 1
                
                print(f"✅ Found {source_count} valid jobs from {source['name']}")
                
            except Exception as e:
                print(f"❌ Failed to scrape {source['name']}: {e}")

        # Remove EXACT duplicates by link
        unique_jobs = {job['link']: job for job in all_jobs}.values()
        
        # Save to public/jobs.json
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(list(unique_jobs), f, indent=2, ensure_ascii=False)
            
        print(f"🎉 Total unique jobs saved: {len(unique_jobs)}")
        
    except Exception as e:
        print(f"⚠️ Global scraper error: {e}")
        if not os.path.exists(output_file):
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump([], f, indent=2)

if __name__ == "__main__":
    scrape_jobs()
