import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Annotation, StateGraph } from "@langchain/langgraph";
import { Document, DocumentInterface } from "@langchain/core/documents";
import { pull } from "langchain/hub";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { formatDocumentsAsString } from "langchain/util/document";
import { z } from "zod";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import * as fs from "fs/promises";

const urls = [
  "https://lilianweng.github.io/posts/2023-06-23-agent/",
  "https://lilianweng.github.io/posts/2023-03-15-prompt-engineering/",
  "https://lilianweng.github.io/posts/2023-10-25-adv-attack-llm/",
];

const docs = await Promise.all(
  urls.map((url) => new CheerioWebBaseLoader(url).load())
);
const docsList = docs.flat();

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 250,
  chunkOverlap: 0,
});
const docSplits = await textSplitter.splitDocuments(docsList);

// Add to vectorDB
const vectorStore = await MemoryVectorStore.fromDocuments(
  docSplits,
  new OpenAIEmbeddings()
);
const retrieverData = vectorStore.asRetriever();

const GraphState = Annotation.Root({
  documents: Annotation<DocumentInterface[]>({
    reducer: (x, y) => y ?? x ?? [],
  }),
  question: Annotation<string>({
    reducer: (x, y) => y ?? x ?? "",
  }),
  generation: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
});

const model = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0,
});

const retriever = async (
  state: typeof GraphState.State
): Promise<Partial<typeof GraphState.State>> => {
  console.log("-----RETRIVE-----");

  const documents = await retrieverData
    .withConfig({ runName: "FetchRelevantDocuments" })
    .invoke(state.question);
  return {
    documents,
  };
};

const generate = async (
  state: typeof GraphState.State
): Promise<Partial<typeof GraphState.State>> => {
  console.log("---GENERATE---");

  const prompt = await pull<ChatPromptTemplate>("rlm/rag-prompt");

  const ragChain = prompt.pipe(model).pipe(new StringOutputParser());

  const generation = await ragChain.invoke({
    context: formatDocumentsAsString(state.documents),
    question: state.question,
  });

  return {
    generation,
  };
};

const gradeDocuments = async (
  state: typeof GraphState.State
): Promise<Partial<typeof GraphState.State>> => {
  console.log("---CHECK RELEVANCE---");

  const llmWithTool = model.withStructuredOutput(
    z
      .object({
        binaryScore: z
          .enum(["yes", "no"])
          .describe("Relevance score 'yes' or 'no'"),
      })
      .describe(
        "Grade the relevance of the retrieved documents to the question. Either 'yes' or 'no'."
      ),
    {
      name: "grade",
    }
  );

  const prompt = ChatPromptTemplate.fromTemplate(
    `You are a grader assessing relevance of a retrieved document to a user question.
  Here is the retrieved document:

  {context}

  Here is the user question: {question}

  If the document contains keyword(s) or semantic meaning related to the user question, grade it as relevant.
  Give a binary score 'yes' or 'no' score to indicate whether the document is relevant to the question.`
  );

  const chain = prompt.pipe(llmWithTool);

  const filteredDocs: Array<DocumentInterface> = [];
  for await (const doc of state.documents) {
    const grade = await chain.invoke({
      context: doc.pageContent,
      question: state.question,
    });

    if (grade.binaryScore === "yes") {
      console.log("---GRADE: DOCUMENT RELEVANT---");
      filteredDocs.push(doc);
    } else {
      console.log("---GRADE: DOCUMENT NOT RELEVANT---");
    }
  }

  return {
    documents: filteredDocs,
  };
};

const transformQuery = async (
  state: typeof GraphState.State
): Promise<Partial<typeof GraphState.State>> => {
  console.log("---TRANSFORM QUERY---");

  const prompt = ChatPromptTemplate.fromTemplate(
    `You are generating a question that is well optimized for semantic search retrieval.
  Look at the input and try to reason about the underlying sematic intent / meaning.
  Here is the initial question:
  \n ------- \n
  {question} 
  \n ------- \n
  Formulate an improved question: `
  );

  const chain = prompt.pipe(model).pipe(new StringOutputParser());
  const betterQuestion = await chain.invoke({
    question: state.question,
  });

  return {
    question: betterQuestion,
  };
};

const webSearch = async (
  state: typeof GraphState.State
): Promise<Partial<typeof GraphState.State>> => {
  console.log("---WEB SEARCH---");

  const tool = new TavilySearchResults();
  const docs = await tool.invoke({ input: state.question });
  const webResults = new Document({ pageContent: docs });
  const newDocuments = state.documents.concat(webResults);

  return {
    documents: newDocuments,
  };
};

const decideToGenerate = async (state: typeof GraphState.State) => {
  console.log("---DECIDE TO GENERATE---");

  const filteredDocs = state.documents;
  if (filteredDocs.length === 0) {
    console.log("---DECISION: TRANSFORM QUERY---");
    return "transformQuery";
  }
  console.log("---DECISION: GENERATE---");
  return "generate";
};

const workFlow = new StateGraph(GraphState)
  .addNode("retriever", retriever)
  .addNode("gradeDocuments", gradeDocuments)
  .addNode("generate", generate)
  .addNode("transformQuery", transformQuery)
  .addNode("webSearch", webSearch);

workFlow
  .addEdge("__start__", "retriever")
  .addEdge("retriever", "gradeDocuments")
  .addConditionalEdges("gradeDocuments", decideToGenerate)
  .addEdge("transformQuery", "webSearch")
  .addEdge("webSearch", "generate")
  .addEdge("generate", "__end__");

const app = workFlow.compile();

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userQuestion = url.searchParams.get("question");
    console.log("user question =>", userQuestion);

    const image = (await app.getGraphAsync()).drawMermaidPng();
    const arrayBuffer = await (await image).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.writeFile("./corrective_rag.png", buffer);

    const config = {
      recursionLimit: 50,
    };

    let finalGeneration;
    for await (const output of await app.stream(
      { question: userQuestion },
      config
    )) {
      for (const [key, value] of Object.entries(output)) {
        console.log(`Node: '${key}'`);
        finalGeneration = value;
      }
      console.log("\n---\n");
    }

    console.log("Check answer ===>", JSON.stringify(finalGeneration, null, 2));

    return Response.json({
      message: finalGeneration.generation || "Hello from corrective RAG",
    });
  } catch (err) {
    console.log("Error from corrective RAG ==>", err);
    return Response.json({
      message: "Error",
    });
  }
}
