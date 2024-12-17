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


// Connect to the db
const astraDB = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = astraDB.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE });

async function loadData() {


  const collection = db.collection(ASTRA_DB_COLLECTION);

  const chunk = 'Current rating of Gukesh Dommaraju is 2783.';

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
};
loadData();
