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

                        await generateHtmlFile(jobData, cat.name, cat.slug);

                        db[cat.name].push({
                            title: jobData.title,
                            url: `jobs/${cat.slug}/${slug}.html`,
                            slug: slug,
                            date: new Date().toLocaleDateString('en-GB'),
                            scraped_at: new Date().toISOString(),
                            source: 'SarkariResult'
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

        // 7. Generate Search Index
        await generateSearchIndex(db);

        console.log(`\n✅ Deep Sync Completed Successfully.`);

    } catch (error) {
        console.error(`❌ Critical Sync Error: ${error.message}`);
    }
}

async function generateSitemap(db, categories) {
    console.log('🗺️ Generating Sitemap...');
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    
    const today = new Date().toISOString().split('T')[0];
    
    // Core Pages
    xml += `  <url><loc>https://rojgar.site/index.html</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>\n`;
    xml += `  <url><loc>https://rojgar.site/disclaimer.html</loc><lastmod>${today}</lastmod><priority>0.5</priority></url>\n`;

    // Category pages
    for (const cat of categories) {
        xml += `  <url><loc>https://rojgar.site/jobs/${cat.slug}/</loc><lastmod>${today}</lastmod><priority>0.8</priority></url>\n`;
    }

    // All job pages
    const seen = new Set();
    Object.values(db).flat().forEach(item => {
        if (item.url && !seen.has(item.url)) {
            xml += `  <url><loc>https://rojgar.site/${item.url}</loc><lastmod>${today}</lastmod><priority>0.6</priority></url>\n`;
            seen.add(item.url);
        }
    });

    xml += `</urlset>`;
    await fs.writeFile('sitemap.xml', xml);
    console.log(`🗺️ Sitemap.xml updated with ${seen.size + categories.length + 2} links.`);
}

async function generateSearchIndex(db) {
    console.log('🔍 Generating Search Index...');
    const index = [];
    Object.keys(db).forEach(catName => {
        db[catName].forEach(item => {
            index.push({
                t: item.title,
                u: item.url,
                c: catName
            });
        });
    });
    // Sort by latest first for default suggestions
    index.reverse();
    await fs.writeFile('search_index.json', JSON.stringify(index));
    console.log(`🔍 Search index generated with ${index.length} entries.`);
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
    const extraContent = [];

    $('.gb-container').each((i, container) => {
        const h4 = $(container).find('h4').text().trim().toLowerCase();
        const h6 = $(container).find('h6').text().trim().toLowerCase();
        
        // 1. Process Metadata (Dates, Fees, etc.)
        if (h4.includes('important dates') || h4.includes('application fee')) {
            const isDateField = h4.includes('important dates');
            const isFeeField = h4.includes('application fee');

            $(container).find('tr, li, .gb-headline-text').each((j, el) => {
                const text = $(el).text().trim();
                const textLower = text.toLowerCase();
                
                if (isDateField) {
                    const parts = text.split(':');
                    if (parts.length >= 2) {
                        const key = parts[0].toLowerCase();
                        const val = parts.slice(1).join(':').trim();
                        if (key.includes('begin') || key.includes('start')) dates.begin = val;
                        else if (key.includes('last')) dates.last = val;
                        else if (key.includes('exam')) dates.exam = val;
                        else if (key.includes('admit')) dates.admit = val;
                    } else if (/(begin|start|last|exam|admit)/i.test(textLower)) {
                        const dateMatch = text.match(/\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/);
                        if (dateMatch) {
                            if (textLower.includes('begin') || textLower.includes('start')) dates.begin = dateMatch[0];
                            else if (textLower.includes('last')) dates.last = dateMatch[0];
                        }
                    }
                }
                
                if (isFeeField) {
                    const feesInLine = text.split(/\n|,/);
                    feesInLine.forEach(feeLine => {
                        const feeTrim = feeLine.trim();
                        if (feeTrim && /(general|obc|ews|sc|st|female|nil|free|fee|rs\.?|₹|\d+\/-)/i.test(feeTrim.toLowerCase())) {
                            // Extra check: Ensure Fee doesn't look like a date
                            if (feeTrim.length < 50 && !fees.includes(feeTrim) && !/\d{1,2}[\/-]\d{1,2}/.test(feeTrim)) {
                                fees.push(feeTrim);
                            }
                        }
                    });
                }
            });
        }
        
        // 2. Process Age Limit
        if (h4.includes('age limit')) ageLimit = $(container).find('.gb-headline-text, div').first().text().trim().replace(/  +/g, ' ') || ageLimit;
        
        // 3. Process Vacancy Total
        if (h4.includes('vacancy details') || h4.includes('total post')) {
            const vText = $(container).text().replace(/\n/g, ' ');
            const match = vText.match(/(?:Total|Vacancy)\s*(?:Post|Vacancy|Details)?\s*[:\s-]*(\d+)/i);
            vacancyTotal = match ? match[1] + " Post" : "Check Notification";
        }
        
        // 4. Collect Supplemental Content (Physical Eligibility, Category Vacancies, etc.)
        const isMetadata = ['important dates', 'application fee', 'vacancy details', 'how to fill', 'important links', 'age limit', 'short information'].some(term => h4.includes(term) || h6.includes(term));
        if (!isMetadata && $(container).find('table').length > 0) {
            let tableHtml = $(container).html();
            // Clean watermarks
            tableHtml = tableHtml.replace(/WWW\.SARKARIRESULT\.COM/gi, '').replace(/SarkariResult\.Com/gi, '').replace(/Sarkari Result/gi, '').trim();
            if (tableHtml.length > 50) extraContent.push(`<div class="extra-section">${tableHtml}</div>`);
        }
        
        // 5. Process Important Links
        if (h6.includes('important links') || $(container).find('.importaint_links').length > 0) {
           $(container).find('tr').each((j, tr) => {
               const tds = $(tr).find('td');
               if (tds.length === 2) {
                   const label = $(tds[0]).text().trim();
                   
                   // Filter out social channels duplication
                   if (/(whatsapp|telegram|instagram|join channel|follow our)/i.test(label.toLowerCase())) return;

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

    // Collect supplemental tables and headers

    $('table').each((i, table) => {
        const text = $(table).text().toLowerCase();
        // Skip if already processed for Links or Dates
        if (text.includes('important links') || text.includes('important dates')) return;
        
        if (text.includes('post name')) {
            $(table).find('tr').each((j, tr) => {
                const tds = $(tr).find('td');
                if (tds.length === 2) {
                    vacancyTable.push({ post: $(tds[0]).text().trim(), total: $(tds[1]).text().trim(), eligibility: "" });
                } else if (tds.length >= 3) {
                    vacancyTable.push({ post: $(tds[0]).text().trim(), total: $(tds[1]).text().trim(), eligibility: $(tds[2]).text().trim() || "" });
                }
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
        extra_content: extraContent.join('\n'),
        slug: slugify(title)
    };
}

const ORG_DESCRIPTIONS = {
    "SSC": "Staff Selection Commission (SSC) is a leading recruitment organization under the Government of India. It conducts examinations for various posts in ministries, departments, and subordinate offices. Known for its periodic recruitment cycles like CGL, CHSL, and GD Constable, SSC is a primary choice for millions of aspirants looking for stable government careers in the central administration.",
    "UPSC": "Union Public Service Commission (UPSC) is India's premier central recruiting agency responsible for appointments to and examinations for all-India services and group A & B of central services. It conducts the prestigious Civil Services Examination, NDA, CDS, and Engineering Services, maintaining the highest standards of integrity and excellence in public service recruitment.",
    "BPSC": "Bihar Public Service Commission (BPSC) is the constitutional body that conducts recruitment exams for civil service jobs in the State of Bihar. It is responsible for selecting candidates for administrative, police, and educational roles within the state government, ensuring a merit-based selection process for Bihar's public administration.",
    "UPSSSC": "Uttar Pradesh Subordinate Services Selection Board (UPSSSC) is the state organization authorized to conduct various examinations for appointments to the posts of Group 'C'. It manages large-scale recruitment for लेखपाल (Lekhpal), VDO, and various technical and non-technical assistants across Uttar Pradesh departments.",
    "RRB": "Railway Recruitment Board (RRB) manages the recruitment of various technical and non-technical categories in Group 'C' and Group 'D' posts in the Indian Railways. With numerous zones across India, RRB is the gateway for candidates seeking a future in the world's largest railway network.",
    "DEFAULT": "This recruitment is conduct by a major government organization dedicated to providing career opportunities to eligible Indian citizens. The board ensures a transparent and merit-based selection process through competitive examinations, interviews, and physical tests where applicable. Candidates are recruited to serve in various administrative, technical, or supportive roles within the department."
};

async function generateHtmlFile(data, catName, catSlug) {
    let template = await fs.readFile(CONFIG.templatePath, 'utf-8');

    // THEME MAPPING
    let themeClass = 'theme-other';
    const context = (catName + ' ' + data.title).toUpperCase();
    
    if (context.includes('RESULT')) themeClass = 'theme-result';
    else if (context.includes('ADMIT')) themeClass = 'theme-admit';
    else if (context.includes('JOBS') || context.includes('RECRUITMENT') || context.includes('VACANCY') || context.includes('ONLINE FORM')) themeClass = 'theme-jobs';
    else if (context.includes('ANSWER')) themeClass = 'theme-answer';
    else if (context.includes('SYLLABUS')) themeClass = 'theme-other';
    else if (context.includes('ADMISSION')) themeClass = 'theme-other';

    const canonicalUrl = `https://rojgar.site/jobs/${catSlug}/${data.slug}.html`;
    const ogTitle = `${data.title} — Rojgar.site`;
    const ogDescription = `${data.org} ${data.postName} Recruitment 2026 — Total ${data.vacancy_total} Posts. Apply Online, check Admit Card and Result status.`;

    // Content Depth: Gather Org Description
    let orgDesc = ORG_DESCRIPTIONS.DEFAULT;
    for (const [key, desc] of Object.entries(ORG_DESCRIPTIONS)) {
        if (data.org.toUpperCase().includes(key)) { orgDesc = desc; break; }
    }

    const replacements = {
        '[Organization Name]': data.org,
        '[Organization]': data.org,
        '[THEME_CLASS]': themeClass,
        '[Recruitment]': 'Recruitment',
        '[Exam Name/Post Name 2026]': data.title,
        '[Post Name]': data.postName,
        '[Date]': new Date().toLocaleDateString('en-GB'),
        '[Job Title Here]': data.title,
        '[Brief Summary of Recruitment]': data.short_info,
        '[Age Detail]': data.age_limit,
        '[Total]': data.vacancy_total,
        '[CATEGORY_NAME]': catName,
        '[Age Date]': data.dates.age_as_on || "Notification Date",
        '[Last Date Value]': data.dates.last || "Check Link",
        '[Start Date]': data.dates.begin || "Check Notification",
        '[End Date]': data.dates.last || "Check Notification",
        '[CANONICAL_URL]': canonicalUrl,
        '[OG_TITLE]': ogTitle,
        '[OG_DESCRIPTION]': ogDescription,
        '[ORG_LONG_DESCRIPTION]': orgDesc,
        '[DATES_LIST]': Object.entries(data.dates).map(([k, v]) => `<div class="info-item"><span>${k}</span> <b>${v}</b></div>`).join('\n'),
        '[FEES_LIST]': data.fees.length > 0 ? data.fees.map(f => `<div class="info-item"><span>${f}</span></div>`).join('\n') : '<div class="info-item"><span>Check Notification</span></div>',
        '[VACANCY_ROWS]': data.vacancy_table.length > 0 ? data.vacancy_table.map(v => `<tr><td><b>${v.post}</b></td><td>${v.total}</td><td>${v.eligibility}</td></tr>`).join('\n') : '<tr><td colspan="3" style="text-align:center;">Check Notification</td></tr>',
        '[LINKS_ROWS]': generateLinksTable(data.links),
        '[EXTRA_CONTENT]': data.extra_content,
        '[TOC_HTML]': generateTOC(data),
        '[FAQ_HTML]': generateFAQHtml(data),
        '[JSON_LD_JOB]': JSON.stringify(generateJobSchema(data, canonicalUrl), null, 2),
        '[JSON_LD_FAQ]': JSON.stringify(generateFAQSchema(data), null, 2),
        '[JSON_LD_BREADCRUMB]': JSON.stringify(generateBreadcrumbSchema(data, canonicalUrl, catName, catSlug), null, 2),
        '#ApplyOnlineLink': data.source_url
    };

    for (const [key, val] of Object.entries(replacements)) template = template.split(key).join(val);
    
    const dir = path.join(CONFIG.outDir, catSlug);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${data.slug}.html`), template);
}

function generateTOC(data) {
    return `<ul style="list-style:none; padding:0; display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
        <li><a href="#about-board"><i class="fas fa-university"></i> About the Board</a></li>
        <li><a href="#age-limit"><i class="fas fa-user-clock"></i> Age Limit Details</a></li>
        <li><a href="#prep-tips"><i class="fas fa-lightbulb"></i> Prep Strategy</a></li>
        <li><a href="#vacancy"><i class="fas fa-users"></i> Vacancy Details</a></li>
        <li><a href="#how-to-fill"><i class="fas fa-edit"></i> Guided How-to-Fill</a></li>
        <li><a href="#important-links"><i class="fas fa-link"></i> Direct Links</a></li>
        <li><a href="#faqs"><i class="fas fa-question-circle"></i> Common Questions</a></li>
    </ul>`;
}

function generateFAQHtml(data) {
    const faqs = generateFAQList(data);
    return faqs.map(item => `
        <div class="faq-row" style="margin-bottom: 20px; border-bottom: 1px dashed var(--rule); padding-bottom: 15px;">
            <p style="font-weight: 700; color: var(--ink2); margin-bottom: 5px;">Q: ${item.q}</p>
            <p style="color: var(--ink3); font-size: 14px;">A: ${item.a}</p>
        </div>
    `).join('');
}

function generateFAQList(data) {
    return [
        { q: `What is the last date to apply for ${data.title}?`, a: `The last date for online application submission for ${data.title} is ${data.dates.last || "to be announced soon"}.` },
        { q: `How many total vacancies are available for ${data.postName}?`, a: `The ${data.org} has released a total of ${data.vacancy_total} posts for this recruitment cycle.` },
        { q: `What are the documents required for [Organization Name] online form?`, a: `You will primarily need a Passport sized photograph, scanned signature, and ID proof like Aadhar or PAN card. Specific qualification certificates must also be ready for data entry.` },
        { q: `Can I apply for ${data.postName} if I am in the final year of my degree?`, a: `Generally, candidates in their final year are eligible to apply, but they must produce their final marksheets at the time of document verification.` },
        { q: `Is there any age relaxation for category candidates?`, a: `Yes, age relaxation is provided to SC, ST, OBC, and PH candidates according to the prevailing government rules of [Organization Name].` },
        { q: `What to do if my fee payment fails in ${data.org} form?`, a: `If the money is deducted from your bank but not updated on the portal, please wait for 24-48 hours. If it remains 'unpaid', contact the board's helpline immediately.` },
        { q: `Where can I download the official notification?`, a: `The official notification PDF can be downloaded from the "Important Links" section at the bottom of this page or from the official site of ${data.org}.` },
        { q: `How many stages are there in the selection process?`, a: `Typically, the process involves a Written Examination (Prelims/Mains), followed by a Physical Test or Interview, depending on the post specific requirements.` }
    ];
}

function generateJobSchema(data, url) {
    return {
        "@context": "https://schema.org/",
        "@type": "JobPosting",
        "title": data.title,
        "description": data.short_info,
        "datePosted": new Date().toISOString().split('T')[0],
        "validThrough": "2026-12-31",
        "employmentType": "FULL_TIME",
        "hiringOrganization": {
            "@type": "Organization",
            "name": data.org,
            "sameAs": "https://rojgar.site"
        },
        "jobLocation": {
            "@type": "Place",
            "address": {
                "@type": "PostalAddress",
                "addressCountry": "IN"
            }
        }
    };
}

function generateFAQSchema(data) {
    const questions = generateFAQList(data);
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": questions.map(item => ({
            "@type": "Question",
            "name": item.q,
            "acceptedAnswer": { "@type": "Answer", "text": item.a }
        }))
    };
}

function generateBreadcrumbSchema(data, url, catName, catSlug) {
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "https://rojgar.site/index.html"
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": catName,
                "item": `https://rojgar.site/jobs/${catSlug}/`
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": data.title,
                "item": url
            }
        ]
    };
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
                       
    const dir = path.join(CONFIG.outDir, catSlug);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'index.html'), template);
    console.log(`   📄 Generated Category Page: ${catSlug}/index.html`);
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
    if (!text) return 'job-' + Date.now();
    const slug = text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
    return slug || 'job-' + Math.random().toString(36).substring(7);
}

syncAll();
