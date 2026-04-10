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
        const data = await fs.readFile(path.join(__dirname, '../public/jobs.json'), 'utf-8');
        res.json(JSON.parse(data));
    } catch (e) {
        res.json([]);
    }
});

// API: Run Scraper
app.post('/api/sync', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.write('🌀 Starting Global Scraper...\n');
    
    // Step 1: Run Python Scraper
    const pScraper = exec('python3 scraper/fetcher.py');
    pScraper.stdout.on('data', (data) => res.write(data));
    pScraper.stderr.on('data', (data) => res.write(`⚠️ ERROR: ${data}`));
    
    pScraper.on('close', (code) => {
        if (code === 0) {
            res.write('\n✅ Scraper finished. Starting HTML Deep Sync...\n');
            const nSync = exec('node scripts/sync_categories.mjs');
            nSync.stdout.on('data', (data) => res.write(data));
            nSync.stderr.on('data', (data) => res.write(`⚠️ SYNC ERROR: ${data}`));
            nSync.on('close', () => {
                res.write('\n✨ ALL DONE! REFRESH TO SEE NEW JOBS.\n');
                res.end();
            });
        } else {
            res.write('\n❌ Scraper failed. Aborting sync.\n');
            res.end();
        }
    });
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Admin Panel running at http://localhost:${PORT}/admin`);
});
