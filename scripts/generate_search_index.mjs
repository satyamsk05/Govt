import fs from 'fs/promises';
import path from 'path';

async function generateIndex() {
  try {
    const data = JSON.parse(await fs.readFile('./data/all_posts.json', 'utf-8'));
    const index = [];
    const SKIP_TITLES = ['result', 'admit card', 'syllabus', 'answer key', 'latest jobs', 'home', 'contact'];

    for (const [category, items] of Object.entries(data)) {
      for (const item of items) {
        if (!item.title || item.title.length < 5) continue;
        if (SKIP_TITLES.includes(item.title.toLowerCase())) continue;
        
        index.push({
          t: item.title,
          u: item.url,
          c: category
        });
      }
    }

    // Ensure directory exists
    await fs.mkdir('./assets/js', { recursive: true });
    await fs.writeFile('./assets/js/search_index.json', JSON.stringify(index));
    console.log(`✅ Search index generated: ${index.length} items`);
  } catch (err) {
    console.error('❌ Failed to generate search index:', err);
  }
}

generateIndex();
