import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('file:///Users/satyamkumar/Desktop/Govt/jobs/aai-junior-executive-atc-final-result-2026-out.html');
  await page.screenshot({path: 'page_test.png', fullPage: true});
  await browser.close();
  console.log("Screenshot saved!");
})();
