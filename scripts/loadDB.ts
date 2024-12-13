import { DataAPIClient } from '@datastax/astra-db-ts';
/* Cannot find module 'langchain/document_loaders/web/puppeteer' or its corresponding type declarations */
// import { PuppeteerWebBaseLoader } from 'langchain/document_loaders/web/puppeteer'; 
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import OpenAI from 'openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import 'dotenv/config'
import { Page, Browser } from 'puppeteer';

const { 
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  OPEN_AI_KEY
} = process.env;

// Similarity between two vectors
type SimilarityMetric = 'dot_product' | 'cosine' | 'euclidean';

// Connect to OpenAI
const openai = new OpenAI({ apiKey: OPEN_AI_KEY, });

// Define websites to scrape data from
const f1Data = [
  'https://www.formula1.com/',
  'https://en.wikipedia.org/wiki/Formula_One',
  'https://www.skysports.com/f1',
  'https://en.wikipedia.org/wiki/Formula_One#Racing_and_strategy',
  'https://en.wikipedia.org/wiki/Formula_One#History',
  'https://en.wikipedia.org/wiki/Formula_One#Drivers',
  'https://en.wikipedia.org/wiki/Formula_One#Revenue_and_profits',
  'http://news.bbc.co.uk/sport2/hi/motorsport/formula_one/6511907.stm',
  'https://www.telegraph.co.uk/business/2020/04/20/formula-onebudget-cuts-expected-tocrash-1600-jobs/',
  'https://www.bbc.co.uk/sport/formula1/38723001',
  'https://www.motorsport.com/f1/news/first-f1-race-silverstone-1950/4791619/'
];

// Connect to the db
const astraDB = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = astraDB.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE });

// Split data into chunks
const text_splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512, // no of chars in each chunk
  chunkOverlap: 100 // overlapping chars between chunks
});

// Create collection in DB
const createCollection = async (similarityMetric: SimilarityMetric = 'dot_product') => {
  const response = await db.createCollection(ASTRA_DB_COLLECTION, {
    vector: {
      dimension: 1536,
      metric: similarityMetric,
    },
    // checkExists: false,
  });
  console.log("response from db", response);
}

// Get all URLS, scrape data, chunk them and create vector embeddings and store them into vector database
const loadData = async () => {
  const collection = await db.collection(ASTRA_DB_COLLECTION);
  for await (const url of f1Data) {
    // scrape data for each url
    const pageContent = await scrapePage(url); 
    // split the content into chunks
    const chunks = await text_splitter.splitText(pageContent);
    for await (const chunk of chunks) {
      // create embedding for each chunk
      const embedding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunk,
        encoding_format: "float",
      });
      console.log("embedding ==>", embedding);

      const vectorEmbedding = embedding.data[0].embedding;

      // Store the vector into DB
      const result = await collection.insertOne({
        text: chunk,
        $vector: vectorEmbedding,
      });
      console.log("embedding that inserted into db", result);
    }
  }
};

const scrapePage = async (url: string) => {
  // puppeteer to scrape the page as it executes JavaScript code on the page
  const loader = new PuppeteerWebBaseLoader(url, {
    launchOptions: {
      headless: true,
    },
    gotoOptions: {
      waitUntil: 'domcontentloaded'
    },
    // Useful for extracting the data and interactin with page elements
    evaluate: async (page: Page, browser: Browser) => {
      const result = await page.evaluate(() => document.body.innerHTML);
      await browser.close();
      return result;
    },
  });

  return (await loader.scrape())?.replace(/<[^]>]*>?/gm, '')
};

createCollection().then(() => loadData());
