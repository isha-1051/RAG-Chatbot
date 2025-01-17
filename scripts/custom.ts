import { DataAPIClient } from "@datastax/astra-db-ts";
/* Cannot find module 'langchain/document_loaders/web/puppeteer' or its corresponding type declarations */
// import { PuppeteerWebBaseLoader } from 'langchain/document_loaders/web/puppeteer';
// import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import OpenAI from "openai";
// import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import "dotenv/config";
// import { Page, Browser } from 'puppeteer';
import rawData from "./Product.json";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  OPEN_AI_KEY,
} = process.env;

// console.log("chec this data ===>", rawData);

// Similarity between two vectors
type SimilarityMetric = "dot_product" | "cosine" | "euclidean";

// Connect to OpenAI
const openai = new OpenAI({ apiKey: OPEN_AI_KEY });

// Connect to the db
const astraDB = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = astraDB.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE });

const createCollection = async (
  similarityMetric: SimilarityMetric = "dot_product"
) => {
  const response = await db.createCollection(ASTRA_DB_COLLECTION, {
    vector: {
      dimension: 1536,
      metric: similarityMetric,
    },
    // checkExists: false,
  });
  console.log("response from db", response);
};

async function loadData() {
  const collection = db.collection(ASTRA_DB_COLLECTION);

  const productDescriptions = rawData.map(
    (row) =>
      `${row.name}, with category ${row.category}, $${row.price} price, ${row.rating} stars rating, Brand: ${row.brand}, SKU: ${row.sku}`
  );

  for (const description of productDescriptions) {
    // console.log("Check this chanks====>", description);

    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: description,
      encoding_format: "float",
    });

    const vectorEmbedding = embedding.data[0].embedding;

    // Store the vector into DB
    const result = await collection.insertOne({
      text: description,
      product_name: description.split(",")[0],
      price: description.split(",")[2],
      $vector: vectorEmbedding,
      metadata: {
        type: "product",
        tableId: 1,
      },
    });
    console.log("embedding that inserted into db", result);
  }
}
createCollection().then(() => loadData());
// loadData();
