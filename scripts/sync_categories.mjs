import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';

/**
 * Deep Category Synchronizer for Rojgar.site
 * Automates scraping of job lists, detail pages, and category indexes.
 */

const CONFIG = {
    templatePath: './templates/_job-template.html',
    catTemplatePath: './templates/_category-template.html',
    dataPath: './data/all_posts.json',
    catPath: './data/categories.json',
    outDir: './jobs',
    indexFile: './index.html'
};

const BATCH_SIZE = 5; // Scrape 5 detail pages in parallel

async function syncAll() {
    console.log(`\n🌀 Starting Deep Sync Process...`);

    try {
        // 1. Load Categories
        const catRaw = await fs.readFile(CONFIG.catPath, 'utf-8');
        const categories = JSON.parse(catRaw);

        // 2. Load DB
        let db = {};
        try {
            const dbRaw = await fs.readFile(CONFIG.dataPath, 'utf-8');
            db = JSON.parse(dbRaw);
        } catch (e) { db = {}; }

        // 3. Process each category
        for (const cat of categories) {
            console.log(`\n📂 Category: ${cat.name.toUpperCase()}`);
            console.log(`🌐 Fetching: ${cat.url}`);
            
            const listResp = await axios.get(cat.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const $list = cheerio.load(listResp.data);

            const links = [];
            const validDomains = ['sarkariresult.com.cm', 'sarkariresult.com', 'rojgarresult.com'];
            const blacklistYrs = [2021, 2022, 2023, 2024];

            const SKIP_TITLES = ['result', 'admit card', 'syllabus', 'answer key', 'latest jobs', 'home', 'contact'];

            $list('.entry-content li a, .entry-content h2 a, article h2 a, .home-display a, .gb-grid-column a').each((i, el) => {
                const title = $list(el).text().trim();
                const url = $list(el).attr('href');
                
                if (title && url && !url.includes('/category/')) {
                    const hasValidDomain = validDomains.some(d => url.includes(d));
                    const isNewEnough = !blacklistYrs.some(y => title.includes(y.toString()) || url.includes(y.toString()));
                    const isNotNav = !SKIP_TITLES.some(s => title.toLowerCase() === s);
                    
                    if (hasValidDomain && isNewEnough && isNotNav) {
                        links.push({ title, url });
                    }
                }
            });

            // Expand limit for Results, keep 12 for others on homepage injection, but archive all
            const limit = (cat.name.toLowerCase() === 'result') ? 200 : 25;
            const targetLinks = links.slice(0, limit);
            
            console.log(`👉 Found ${links.length} links. Deep scraping top ${targetLinks.length}...`);
            
            db[cat.name] = []; // Clear current cat in DB

            // Process in Batches
            for (let i = 0; i < targetLinks.length; i += BATCH_SIZE) {
                const batch = targetLinks.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(async (item) => {
                    try {
                        const slug = slugify(item.title);
                        console.log(`   🔸 Scraping: ${item.title.substring(0, 40)}...`);
                        
                        const detailResp = await axios.get(item.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
                        const $detail = cheerio.load(detailResp.data);
                        
                        const jobData = extractJobDetails($detail, item.title);
                        jobData.slug = slug;
                        jobData.source_url = item.url;

                        await generateHtmlFile(jobData);

                        db[cat.name].push({
                            title: jobData.title,
                            url: `jobs/${slug}.html`,
                            slug: slug,
                            date: new Date().toLocaleDateString('en-GB')
                        });
                    } catch (e) {
                        console.error(`   ⚠️ Failed: ${item.title.substring(0, 20)} - ${e.message}`);
                    }
                }));
            }

            // Generate the "View More" category page
            await generateCategoryPage(cat.name, cat.slug, db[cat.name]);
        }

        // 4. Save Database
        await fs.writeFile(CONFIG.dataPath, JSON.stringify(db, null, 2));
        
        // 5. Update Homepage
        await updateHomepage(db, categories);

        // 6. Generate Sitemap
        await generateSitemap(db, categories);

        console.log(`\n✅ Deep Sync Completed Successfully.`);

    } catch (error) {
        console.error(`❌ Critical Sync Error: ${error.message}`);
    }
}

async function generateSitemap(db, categories) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    xml += `  <url><loc>https://rojgar.site/</loc><priority>1.0</priority></url>\n`;

    // Add category pages
    for (const cat of categories) {
        xml += `  <url><loc>https://rojgar.site/jobs/${cat.slug}.html</loc><priority>0.8</priority></url>\n`;
    }

    // Add all job pages
    const seen = new Set();
    Object.values(db).flat().forEach(item => {
        if (!seen.has(item.slug)) {
            xml += `  <url><loc>https://rojgar.site/${item.url}</loc><priority>0.6</priority></url>\n`;
            seen.add(item.slug);
        }
    });

    xml += `</urlset>`;
    await fs.writeFile('sitemap.xml', xml);
    console.log(`🗺️ Sitemap.xml updated with ${seen.size} links.`);
}

function extractJobDetails($, rawTitle) {
    let title = $('h1').first().text().trim() || rawTitle;
    title = title.replace(/WWW\.SARKARIRESULT\.COM/gi, '').replace(/SarkariResult\.Com/gi, '').replace(/Sarkari Result/gi, '').replace(/: Short Details of Notification/gi, '').replace(/  +/g, ' ').trim();

    let shortInfo = "Check Notification";
    $('table tr').each((i, tr) => {
        const text = $(tr).text();
        if (text.includes(': Short Details') || text.includes(': Short Information')) {
            shortInfo = $(tr).text().split('Details')[1]?.trim() || $(tr).text().split('Information')[1]?.trim() || shortInfo;
        }
    });
    if (shortInfo === "Check Notification") {
        $('.gb-container').each((i, el) => {
            const text = $(el).text();
            if (text.toLowerCase().includes('short information')) {
                shortInfo = $(el).find('div.gb-headline-text').text().trim() || text.split('Information')[1]?.split('\n')[0]?.trim() || shortInfo;
            }
        });
    }
    shortInfo = shortInfo.replace(/^[:\s-]+/, '').trim();

    const dates = {};
    const fees = [];
    let ageLimit = "As per rules";
    let vacancyTotal = "Check Notification";
    const vacancyTable = [];
    const importantLinks = [];

    $('.gb-container').each((i, container) => {
        const h4 = $(container).find('h4').text().trim().toLowerCase();
        const h6 = $(container).find('h6').text().trim().toLowerCase();
        
        if (h4.includes('important dates') || h4.includes('application fee')) {
            $(container).find('tr').each((j, tr) => {
                const tds = $(tr).find('td');
                if (tds.length >= 2) {
                    // Dates in first column
                    const dateText = $(tds[0]).text().trim();
                    if (dateText.includes(':')) {
                        const parts = dateText.split(':');
                        const key = parts[0].toLowerCase();
                        const val = parts[1].trim();
                        if (key.includes('begin') || key.includes('start')) dates.begin = val;
                        else if (key.includes('last')) dates.last = val;
                        else if (key.includes('exam')) dates.exam = val;
                        else if (key.includes('admit')) dates.admit = val;
                        else dates.other = (dates.other ? dates.other + ', ' : '') + val;
                    }
                    // Fees in second column
                    $(tds[1]).find('li, p, div').each((k, el) => {
                        const fee = $(el).text().trim();
                        const fl = fee.toLowerCase();
                        const hasFeeKeyword = ['general', 'obc', 'ews', 'sc', 'st', 'female', 'rs', '₹', 'payment', 'nil', 'free', 'fee', '/-'].some(kw => fl.includes(kw));
                        const hasJunkKeyword = ['admit card', 'result', 'answer key', 'exam date', 'sarkari result', 'online form', 'height', 'chest', 'weight', 'running', 'ditch'].some(kw => fl.includes(kw));
                        
                        if (fee && hasFeeKeyword && !hasJunkKeyword) {
                            fees.push(fee);
                        }
                    });
                }
            });
            // Fallback for list-based if table extraction failed
            if (Object.keys(dates).length === 0) {
                $(container).find('li').each((j, li) => {
                    const line = $(li).text().trim();
                    if (line.includes(':')) {
                        const [k, v] = line.split(':');
                        const kl = k.toLowerCase();
                        if (kl.includes('begin') || kl.includes('start')) dates.begin = v.trim();
                        else if (kl.includes('last')) dates.last = v.trim();
                    }
                });
            }
        }
        if (h4.includes('age limit')) ageLimit = $(container).find('div.gb-headline-text').first().text().trim() || ageLimit;
        if (h4.includes('vacancy details') || h4.includes('total post')) {
            const vText = $(container).text();
            const match = vText.match(/(?:Total|Vacancy)\s*(?:Post|Vacancy|Details)?\s*[:\s-]*(\d+)/i);
            vacancyTotal = match ? match[1] + " Post" : vacancyTotal;
        }
        
        // Target Link Section
        if (h6.includes('important links') || $(container).find('.importaint_links').length > 0) {
           $(container).find('tr').each((j, tr) => {
               const tds = $(tr).find('td');
               if (tds.length === 2) {
                   const label = $(tds[0]).text().trim();
                   const links = [];
                   $(tds[1]).find('a').each((k, a) => {
                       const lText = $(a).text().trim();
                       const lHref = $(a).attr('href');
                       if (lHref && !lHref.includes('sarkariresult')) {
                           links.push({ text: lText, url: lHref });
                       }
                   });
                   if (links.length > 0) importantLinks.push({ label, links });
               }
           });
        }
    });

    /* CSS Safety for Scraped Tables */
    const cssSafety = `
    <style>
    :root {
      --red: #ff0000;
      --white: #ffffff;
      --yellow-bg: #ffffcc;
    }
    #extra-content table, .detail-table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin-bottom: 20px !important;
      background: white !important;
      border: 1px solid var(--rule) !important;
    }
    #extra-content td, #extra-content th, .detail-table td, .detail-table th {
      padding: 12px !important;
      border: 1px solid var(--rule) !important;
      font-size: 14px !important;
      color: var(--ink) !important;
      text-align: left !important;
    }
    #extra-content th, .detail-table th {
      background: var(--paper) !important;
      font-weight: 700 !important;
    }
    </style>`;

    // Final fallback for links (only if empty to avoid duplication)
    if (importantLinks.length === 0) {
        $('.importaint_links table tr, table tr').each((i, tr) => {
             const tds = $(tr).find('td');
             if (tds.length === 2) {
                 const label = $(tds[0]).text().trim();
                 const labelLower = label.toLowerCase();
                 if (labelLower.includes('whatsapp') || labelLower.includes('telegram') || labelLower.includes('instagram')) return;

                 if (labelLower.includes('apply') || labelLower.includes('notification') || labelLower.includes('website')) {
                     const links = [];
                     $(tds[1]).find('a').each((k, a) => {
                         const lHref = $(a).attr('href');
                         if (lHref && !lHref.includes('sarkariresult')) {
                             links.push({ text: $(a).text().trim(), url: lHref });
                         }
                     });
                     if (links.length > 0) importantLinks.push({ label, links });
                 }
             }
        });
    }

    // Filter and Deduplicate Links
    const seenLabels = new Set();
    const filteredLinks = importantLinks.filter(item => {
        const l = item.label.toLowerCase();
        if (seenLabels.has(l)) return false;
        seenLabels.add(l);
        return !l.includes('whatsapp') && !l.includes('telegram') && !l.includes('instagram');
    });

    if (fees.length === 0) {
        $('table tr').each((i, tr) => {
            if ($(tr).text().toLowerCase().includes('fee')) {
                const fText = $(tr).text().trim();
                if (!fText.toLowerCase().includes('date')) fees.push(fText);
            }
        });
    }

    const extraContent = [];
    $('table').each((i, table) => {
        const text = $(table).text().toLowerCase();
        // Skip if already processed for Links or Dates
        if (text.includes('important links') || text.includes('important dates')) return;
        
        if (text.includes('post name')) {
            $(table).find('tr').each((j, tr) => {
                const tds = $(tr).find('td');
                if (tds.length >= 2) vacancyTable.push({ post: $(tds[0]).text().trim(), total: $(tds[1]).text().trim(), eligibility: $(tds[2]).text().trim() || "" });
            });
        } else if ($(table).attr('border') == '1' || $(table).find('th').length > 0) {
            // Greedy capture of any other structured table (Physical Eligibility, selection process tables, etc.)
            const styledTable = $(table).addClass('detail-table').prop('outerHTML');
            extraContent.push(`<div class="detail-section"><div class="detail-table-wrap">${styledTable}</div></div>`);
        }
    });

    // Capture "Mode of Selection" or "How to Fill" if they are in headers
    $('h2, h3, h4').each((i, h) => {
        const hText = $(h).text().toLowerCase();
        if (hText.includes('mode of selection') || hText.includes('how to fill') || hText.includes('eligibility')) {
            let content = "";
            let next = $(h).next();
            while (next.length && !['h2', 'h3', 'h4'].includes(next[0].name)) {
                content += $(next).prop('outerHTML') || "";
                next = next.next();
            }
            if (content) extraContent.push(`<div class="extra-section"><h4>${$(h).text()}</h4>${content}</div>`);
        }
    });

    const orgName = title.split(' ')[0] || "Organization";
    return { 
        title, 
        org: orgName, 
        postName: title.replace(orgName, '').trim(), 
        short_info: shortInfo, 
        dates, 
        fees: fees.slice(0, 8), 
        age_limit: ageLimit, 
        vacancy_total: vacancyTotal, 
        vacancy_table: vacancyTable.slice(1), 
        links: filteredLinks.slice(0, 10),
        extra_content: extraContent.join('\n')
    };
}

async function generateHtmlFile(data) {
    let template = await fs.readFile(CONFIG.templatePath, 'utf-8');
    const replacements = {
        '[Organization Name]': data.org,
        '[Organization]': data.org,
        '[Recruitment]': 'Recruitment',
        '[Exam Name/Post Name 2026]': data.title,
        '[Post Name]': data.postName,
        '[Date]': new Date().toLocaleDateString('en-GB'),
        '[Job Title Here]': data.title,
        '[Brief Summary of Recruitment]': data.short_info,
        '[Age Detail]': data.age_limit,
        '[Total]': data.vacancy_total,
        '[Start Date]': data.dates.begin || "Check Notification",
        '[End Date]': data.dates.last || "Check Notification",
        '<!-- [DATES_PLACEHOLDER] -->': Object.entries(data.dates).map(([k, v]) => `<div class="info-item"><span>${k}</span> <b>${v}</b></div>`).join('\n'),
        '<!-- [FEES_PLACEHOLDER] -->': data.fees.length > 0 ? data.fees.map(f => `<div class="info-item"><span>${f}</span></div>`).join('\n') : '<div class="info-item"><span>Check Notification</span></div>',
        '<!-- [VACANCY_ROWS] -->': data.vacancy_table.length > 0 ? data.vacancy_table.map(v => `<tr><td><b>${v.post}</b></td><td>${v.total}</td><td>${v.eligibility}</td></tr>`).join('\n') : '<tr><td colspan="3" style="text-align:center;">Check Notification</td></tr>',
        '<!-- [LINKS_ROWS] -->': generateLinksTable(data.links),
        '<!-- [EXTRA_CONTENT] -->': data.extra_content,
        '#ApplyOnlineLink': data.source_url
    };
    for (const [key, val] of Object.entries(replacements)) template = template.split(key).join(val);
    await fs.writeFile(path.join(CONFIG.outDir, `${data.slug}.html`), template);
}

function generateLinksTable(links) {
    let html = `
          <tr>
            <td class="action-label-pink">Join Our WhatsApp Channel</td>
            <td style="text-align:center;"><a href="https://whatsapp.com/channel/0029VbBqIvuICVfg8OC1rI1U" class="action-link-blue" target="_blank">Follow Now</a></td>
          </tr>
          <tr>
            <td class="action-label-pink">Follow Our Instagram Channel</td>
            <td style="text-align:center;"><a href="https://www.instagram.com/rojgar_site/" class="action-link-blue" target="_blank">Follow Now</a></td>
          </tr>
          <tr>
            <td colspan="2"><span class="action-title-red">SOME USEFUL IMPORTANT LINKS</span></td>
          </tr>`;

    links.forEach(group => {
        const isActionRow = group.label.toLowerCase().includes('apply') || 
                            group.label.toLowerCase().includes('registration') || 
                            group.label.toLowerCase().includes('login') ||
                            group.label.toLowerCase().includes('result') ||
                            group.label.toLowerCase().includes('merit') ||
                            group.label.toLowerCase().includes('download');

        const rowClass = isActionRow ? 'action-row-highlight' : '';
        
        html += `
          <tr class="${rowClass}">
            <td class="action-label" style="color:inherit;">${group.label}</td>
            <td style="text-align:center;">`;

        if (group.links.length > 1) {
            html += `<div class="dual-links">`;
            group.links.forEach((link, idx) => {
                html += `<a href="${link.url}" class="action-link-blue" target="_blank">${link.text}</a>`;
                if (idx < group.links.length - 1) html += `<span>|</span>`;
            });
            html += `</div>`;
        } else {
            html += `<a href="${group.links[0].url}" class="action-link-blue" target="_blank">${group.links[0].text || 'Click Here'}</a>`;
        }

        html += `</td>
          </tr>`;
    });

    return html;
}

async function generateCategoryPage(catName, catSlug, items) {
    let template = await fs.readFile(CONFIG.catTemplatePath, 'utf-8');
    const rows = items.map(item => `
        <tr>
            <td><a href="${item.slug}.html" class="post-link">${item.title}</a></td>
            <td style="text-align: center;"><a href="${item.slug}.html" class="action-btn">View Details</a></td>
        </tr>
    `).join('');
    
    template = template.replace(/\[Category Name\]/g, catName)
                       .replace('<!-- [LIST_ROWS] -->', rows);
                       
    const fileName = catSlug + '.html';
    await fs.writeFile(path.join(CONFIG.outDir, fileName), template);
    console.log(`   📄 Generated Category Page: ${fileName}`);
}

async function updateHomepage(db, categories) {
    let index = await fs.readFile(CONFIG.indexFile, 'utf-8');
    const $ = cheerio.load(index);

    for (const cat of categories) {
        const catId = `list-${cat.name.toLowerCase().replace(/\s+/g, '-')}`;
        const container = $(`#${catId}`);
        if (container.length) {
            const items = db[cat.name].slice(0, 12); // Show top 12 on home
            const listHtml = items.map(item => `<a class="a2z-item" href="${item.url}">${item.title}</a>`).join('\n');
            container.html(listHtml);
        }
    }

    await fs.writeFile(CONFIG.indexFile, $.html());
    console.log(`🏠 Homepage updated with latest links.`);
}

function slugify(text) {
    return text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

syncAll();
