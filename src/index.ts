import express from "express";
import type { RequestHandler } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import puppeteer from "puppeteer-extra";
import { Page } from "puppeteer";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

import type { DataType } from "./types";
import { delay } from "./utils";
const app = express();
app.use(cors());
app.use(bodyParser.json());

let latestTimestamp: number = 0;

puppeteer.use(StealthPlugin());

const getPageNumber = async (page: Page, tryCount: number = 1) => {
  try {
    await page.waitForSelector(".s-pagination-item", { timeout: 2000 });

    const maxPage = await page.$$eval(
      ".s-pagination-item:not(.s-pagination-previous):not(.s-pagination-next)",
      (items) => {
        const numbers = items
          .map((el) => parseInt(el.textContent?.trim() || "0"))
          .filter((n) => !isNaN(n));

        return numbers.length ? Math.max(...numbers) : 1;
      }
    );

    return maxPage;
  } catch (err) {
    console.log("failed", tryCount);
    // if (tryCount >= 3) {
    return 1;
    // }
    // return getPageNumber(page, tryCount + 1);
  }
};

const runPuppeteer = async (
  amazonURLs: { amazonURL: string; id: number }[]
) => {
  const browser = await puppeteer.launch({
    headless: true, // Set false for debugging
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
  );

  await page.setViewport({ width: 1280, height: 800 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

  await page.setRequestInterception(true);

  page.on("request", (request) => {
    if (["image", "stylesheet", "font"].includes(request.resourceType())) {
      request.abort();
    } else {
      request.continue();
    }
  });

  const result: { id: number; pageCount: number }[] = [];
  const mytimestamp = latestTimestamp;

  for (let i = 0; i < amazonURLs.length; i++) {
    if (mytimestamp !== latestTimestamp) {
      break;
    }
    const { amazonURL, id } = amazonURLs[i];
    await page.goto(amazonURL, { waitUntil: "networkidle2" });
    await delay(Math.random() * 2);
    const pageNum = await getPageNumber(page);
    console.log(i, id, pageNum, amazonURL);
    result.push({ id, pageCount: pageNum });
  }

  await browser.close();
  return result;
};

const scrapeHandler: RequestHandler = async (req, res) => {
  const { amazonURLs, currentTimestamp } = req.body as {
    amazonURLs: {
      amazonURL: string;
      id: number;
    }[];
    currentTimestamp: number;
  };
  console.log({ amazonURLs, currentTimestamp });

  if (currentTimestamp > latestTimestamp) {
    latestTimestamp = currentTimestamp;
    res.json([]);
    return;
  }

  console.log(`amazonURLs links: ${amazonURLs.length}`);

  try {
    const result = await runPuppeteer(amazonURLs);

    res.json(result);
  } catch (error) {
    console.error("Error scraping:", error);
    res.status(500).json({ error: "Failed to scrape" });
  }
};

app.post("/api/scrape", scrapeHandler);

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
