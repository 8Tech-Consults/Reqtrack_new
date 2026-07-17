// Converts HTML string to a PDF Buffer using Puppeteer.
// Dependency: puppeteer (install via `npm i puppeteer`)

export default async function htmlToPdf(html) {
  let puppeteer;
  try {
    // Lazy-load dependency to avoid breaking server startup if not installed yet
    const mod = await import("puppeteer");
    puppeteer = mod.default || mod;
  } catch (e) {
    throw new Error(
      "PDF generation requires 'puppeteer'. Please install it with: npm i puppeteer"
    );
  }

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: "new",
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buffer = await page.pdf({ format: "A4", printBackground: true });
    return buffer;
  } finally {
    await browser.close();
  }
}

