import { chromium, Browser } from "playwright";

let browser: Browser | null = null;

export async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: false,
      slowMo: 100,
    });
  }

  return browser;
}