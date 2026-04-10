import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';

/**
 * Professional Job Automation Script
 * Scrapes SarkariResult.com and generates pages for Rojgar.site
 */

const CONFIG = {
    templatePath: './templates/_job-template.html',
    dataPath: './data/all_posts.json',
    outDir: './jobs',
    indexFile: './index.html'
};

async function addJob(url) {
    console.log(`\n🚀 Processing: ${url}`);

    try {
        let html;
        if (url.startsWith('http')) {
            const resp = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            html = resp.data;
        } else {
            html = await fs.readFile(url, 'utf-8');
        }
        const $ = cheerio.load(html);

        // 2. Extract Data (Optimized for SarkariResult Table Structure)
        const jobData = extractJobDetails($);
        jobData.url = url;
        jobData.slug = slugify(jobData.title);

        console.log(`✅ Extracted: ${jobData.title}`);

        // 3. Generate HTML Page
        await generateHtmlFile(jobData);

        // 4. Update JSON Database
        await updateDatabase(jobData);

        // 5. Update Homepage (index.html)
        await updateHomepage(jobData);

        console.log(`\n✨ DONE! Job added successfully.`);
        console.log(`🔗 Link: rollout/${jobData.slug}.html`);

    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

function extractJobDetails($) {
    let title = $('h1').first().text().trim() || 'Untitled Job';
    
    // Clean Title (Remove Junk)
    title = title.replace(/WWW\.SARKARIRESULT\.COM/gi, '')
                 .replace(/SarkariResult\.Com/gi, '')
                 .replace(/Sarkari Result/gi, '')
                 .replace(/: Short Details of Notification/gi, '')
                 .replace(/  +/g, ' ')
                 .trim();

    const org = title.split(' ')[0] || '';
    
    // Most data on SR is in a big table
    const mainTable = $('table').first();
    const rows = mainTable.find('tr');

    let shortInfo = '';
    let dates = {};
    let fees = [];
    let ageLimit = '';
    
    rows.each((i, row) => {
        const text = $(row).text().toLowerCase();
        if (text.includes('short information')) {
            shortInfo = $(row).next().text().trim();
        }
    });

    // Heuristics for Dates & Fees
    // Usually SR has specific text patterns
    $('li').each((i, el) => {
        const line = $(el).text().trim();
        if (line.includes('Application Begin :')) dates.begin = line.split(':')[1].trim();
        if (line.includes('Last Date for Apply :')) dates.last = line.split(':')[1].trim();
        
        if (line.includes('General / OBC / EWS :')) fees.push(`General / OBC / EWS: ${line.split(':')[1].trim()}`);
        if (line.includes('SC / ST / PH :')) fees.push(`SC / ST / PH: ${line.split(':')[1].trim()}`);
    });

    return {
        title,
        org,
        short_info: shortInfo,
        dates,
        fees,
        age_limit: 'As per rules', // Default fallback
        vacancy_total: 'Check Notification',
        vacancy_table: []
    };
}

async function generateHtmlFile(data) {
    let template = await fs.readFile(CONFIG.templatePath, 'utf-8');

    // Simple Template Engine
    const replacements = {
        '[Organization Name]': data.org,
        '[Exam Name/Post Name 2026]': data.title,
        '[Date]': new Date().toLocaleDateString('en-GB'),
        '[Brief Summary of Recruitment]': data.short_info,
        '[Job Title Here]': data.title,
        '#ApplyOnlineLink': data.url, // Placeholder for actual apply link
    };

    let result = template;
    for (const [key, val] of Object.entries(replacements)) {
        result = result.split(key).join(val);
    }

    const filePath = path.join(CONFIG.outDir, `${data.slug}.html`);
    await fs.mkdir(CONFIG.outDir, { recursive: true });
    await fs.writeFile(filePath, result);
}

async function updateDatabase(data) {
    const raw = await fs.readFile(CONFIG.dataPath, 'utf-8');
    const db = JSON.parse(raw);
    
    // Add to Latest Jobs category
    const entry = {
        title: data.title,
        url: `rollout/${data.slug}.html`,
        slug: data.slug,
        details: data
    };

    if (!db["Latest Jobs"]) db["Latest Jobs"] = [];
    db["Latest Jobs"].unshift(entry); // Add to top

    await fs.writeFile(CONFIG.dataPath, JSON.stringify(db, null, 2));
}

async function updateHomepage(data) {
    let indexHtml = await fs.readFile(CONFIG.indexFile, 'utf-8');
    
    // Robust injection: find "Latest Jobs" column and its "a2z-list" div
    const latestJobsBlock = indexHtml.match(/Latest Jobs[\s\S]*?class="a2z-list">/);
    
    if (latestJobsBlock) {
        const insertionPoint = indexHtml.indexOf(latestJobsBlock[0]) + latestJobsBlock[0].length;
        const newLink = `\n       <a class="a2z-item" href="rollout/${data.slug}.html">${data.title}</a>`;
        
        const updated = indexHtml.slice(0, insertionPoint) + newLink + indexHtml.slice(insertionPoint);
        await fs.writeFile(CONFIG.indexFile, updated);
        console.log(`✅ Homepage (index.html) updated.`);
    } else {
        console.warn(`⚠️ Could not find "Latest Jobs" section list in index.html for auto-update.`);
    }
}

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

// CLI Interaction
const argUrl = process.argv[2];
if (!argUrl) {
    console.error('❌ Please provide a URL. Example: node scripts/add_job.mjs "https://..."');
} else {
    addJob(argUrl);
}
