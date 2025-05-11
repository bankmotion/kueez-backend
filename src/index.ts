import express from "express";
import type { RequestHandler } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { chromium } from "playwright";
import type { DataType } from "./types";
import { delay } from "./utils";
const app = express();
app.use(cors());
app.use(bodyParser.json());

let accumulatedLinks: { amazonURL: string; id: number }[] = [];
let latestTimestamp: number = 0;

const runPlaywright = async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const result: { id: number; pageCount: number }[] = [];

  for (let i = 0; i < accumulatedLinks.length; i++) {
    const { amazonURL, id } = accumulatedLinks[i];
    try {
      await delay(0.2);
      await page.goto(amazonURL, { waitUntil: "domcontentloaded" });

      const maxPage = await page.$$eval(
        ".s-pagination-item:not(.s-pagination-previous):not(.s-pagination-next)",
        (items) => {
          const numbers = items
            .map((el) => parseInt(el.textContent?.trim() || "0"))
            .filter((n) => !isNaN(n));

          return numbers.length ? Math.max(...numbers) : 1;
        }
      );

      console.log("maxPage", maxPage, amazonURL);
      result.push({ id, pageCount: maxPage });
    } catch (error) {
      console.error("Error scraping:", error);
      await delay(0.5);
      i--;
    }
  }

  await browser.close();
  return result;
};

const scrapeHandler: RequestHandler = async (req, res) => {
  const { amazonURLs, isFinal, currentTimestamp } = req.body as {
    amazonURLs: {
      amazonURL: string;
      id: number;
    }[];
    isFinal: boolean;
    currentTimestamp: number;
  };
  console.log({ amazonURLs, isFinal, currentTimestamp });

  if (currentTimestamp > latestTimestamp) {
    latestTimestamp = currentTimestamp;
    accumulatedLinks = [];
  }

  accumulatedLinks.push(...amazonURLs);
  console.log(`Accumulated links: ${accumulatedLinks.length}`);

  if (!isFinal) {
    res.json({});
    return;
  }

  try {
    const result = await runPlaywright();

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
