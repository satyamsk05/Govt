import fs from 'fs/promises';
import path from 'path';

async function generateSitemap() {
  try {
    const data = JSON.parse(await fs.readFile('./data/all_posts.json', 'utf-8'));
    const baseUrl = 'https://rojgar.site/';
    const today = new Date().toISOString().split('T')[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Static pages
    const mainPages = [
      '',
      'jobs/latest-jobs.html',
      'jobs/results.html',
      'jobs/admit-card.html',
      'jobs/answer-key.html',
      'jobs/syllabus.html',
      'jobs/admission.html',
      'disclaimer.html'
    ];

    for (const page of mainPages) {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${page}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>${page === '' ? '1.0' : '0.8'}</priority>\n`;
      xml += `  </url>\n`;
    }

    // Dynamic job pages
    const seenUrls = new Set();
    for (const [category, items] of Object.entries(data)) {
      for (const item of items) {
        // Clean URL: remove ../ if present
        let cleanUrl = item.url.replace('../', '');
        
        // Skip entry if:
        // 1. Broken URL (.html without filename)
        // 2. Already processed
        // 3. title is too short (likely placeholder)
        if (cleanUrl === 'jobs/.html' || cleanUrl === '.html' || !cleanUrl) continue;
        if (seenUrls.has(cleanUrl)) continue;
        if (!item.title || item.title.length < 5) continue;
        if (item.title.toLowerCase() === 'result' || item.title.toLowerCase() === 'admit card') continue;

        seenUrls.add(cleanUrl);

        xml += `  <url>\n`;
        xml += `    <loc>${baseUrl}${cleanUrl}</loc>\n`;
        xml += `    <lastmod>${today}</lastmod>\n`;
        xml += `    <changefreq>monthly</changefreq>\n`;
        xml += `    <priority>0.6</priority>\n`;
        xml += `  </url>\n`;
      }
    }

    xml += `</urlset>`;

    await fs.writeFile('./sitemap.xml', xml);
    console.log(`✅ Sitemap generated: ${seenUrls.size + mainPages.length} URLs`);
  } catch (err) {
    console.error('❌ Failed to generate sitemap:', err);
  }
}

generateSitemap();
