import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

// 🌐 Website URL
const URL = "https://www.sarkariresult.com/";

async function scrapeWebsite(url) {
  console.log(`⏳ Scraping: ${url}`);
  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });
    const $ = cheerio.load(data);

    let structuredContent = {
      hero: [],
      updates: [],
      categories: {},
      ticker: ""
    };

    // 1. Ticker
    const ticker = $(".ticker-bar, marquee").text().trim();
    if (ticker) structuredContent.ticker = ticker;

    // 2. Updates (Grid links)
    $("a").each((i, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr("href");
      if (text.length > 15 && text.length < 50 && href && href.includes(".php")) {
        structuredContent.updates.push({ text, href });
      }
    });

    // 3. Categories (Result, Admit Card, Latest Jobs)
    const categoryNames = ["Result", "Admit Card", "Latest Jobs", "Answer Key", "Syllabus"];
    
    $("div[id^='box']").each((i, el) => {
        const header = $(el).find("#font").text().trim();
        let matchedCat = null;
        for (const cat of categoryNames) {
            if (header.toLowerCase().includes(cat.toLowerCase())) {
                matchedCat = cat;
                break;
            }
        }

        if (matchedCat) {
            structuredContent.categories[matchedCat] = [];
            $(el).find("li a").each((j, a) => {
                const text = $(a).text().trim();
                const href = $(a).attr("href");
                if (text && href) {
                    structuredContent.categories[matchedCat].push({ text, href });
                }
            });
        }
    });

    return structuredContent;
  } catch (err) {
    console.error(`Error scraping: ${err.message}`);
    return null;
  }
}

async function main() {
  const rawData = await scrapeWebsite(URL);
  if (rawData) {
    fs.writeFileSync("raw_data.json", JSON.stringify(rawData, null, 2));
    console.log("✅ Scrape complete! Data saved to raw_data.json");
    console.log("🔥 JUGAD: Now I will analyze this data personally to provide your refined design.");
  }
}

main();