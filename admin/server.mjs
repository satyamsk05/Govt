import express from 'express';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, '../')));
app.use(express.json());

// API: Get current jobs from JSON
app.get('/api/jobs', async (req, res) => {
    try {
        const dataRaw = await fs.readFile(path.join(__dirname, '../data/all_posts.json'), 'utf-8');
        const db = JSON.parse(dataRaw);
        // Flatten the category-based object into a single array
        const allJobs = Object.values(db).flat();
        res.json(allJobs);
    } catch (e) {
        console.error('API Error:', e);
        res.json([]);
    }
});

// API: Run Scraper
app.post('/api/sync', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.write('🌀 Starting Deep Synchronization...\n');
    
    // Run the consolidated sync script
    const nSync = exec('/opt/homebrew/bin/node scripts/sync_categories.mjs');
    nSync.stdout.on('data', (data) => res.write(data));
    nSync.stderr.on('data', (data) => res.write(`⚠️ SYNC ERROR: ${data}`));
    nSync.on('close', (code) => {
        if (code === 0) {
            res.write('\n✨ ALL DONE! REFRESH TO SEE NEW JOBS.\n');
        } else {
            res.write(`\n❌ Sync failed with code ${code}.\n`);
        }
        res.end();
    });
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Admin Panel running at http://localhost:${PORT}/admin`);
});
