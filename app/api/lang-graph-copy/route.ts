import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as tslab from "tslab";
import {
  Annotation,
  MemorySaver,
  messagesStateReducer,
  StateGraph,
} from "@langchain/langgraph";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { pull } from "langchain/hub";
import { DataSource } from "typeorm";
import { SqlDatabase } from "langchain/sql_db";
import { QuerySqlTool } from "langchain/tools/sql";
// need to find a way to save memory in lang Graph
import fs from "fs/promises";

const InputStateAnnotation = Annotation.Root({
  question: Annotation<string>,
});

const StateAnnotation = Annotation.Root({
  question: Annotation<string>,
  query: Annotation<string>,
  result: Annotation<string>,
  answer: Annotation<string>,
});

const datasource = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST || "localhost",
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "tops12345",
  database: process.env.DB_NAME || "sql_prompt",
});

const db = await SqlDatabase.fromDataSourceParams({
  appDataSource: datasource,
});

// llm
const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.5,
});

// tools
const queryPromptTemplate = await pull<ChatPromptTemplate>(
  "langchain-ai/sql-query-system-prompt"
);

// console.log("Check this prompt", queryPromptTemplate.promptMessages[0].lc_kwargs.prompt.template);

const queryOutput = z.object({
  query: z.string().describe("Syntactically valid SQL query."),
});

const structuredLlm = llm.withStructuredOutput(queryOutput);

const needGreetUser = async (state: typeof StateAnnotation.State) => {
  const promptValue = `
    You are Intent identifier Agent.\n\n
    You have to anylize the user's question if question is for Greeting related then you have to return Greet otherwise retun No Greet \n\n
    User question: ${state.question}
  `;

  const response = await llm.invoke(promptValue);

  if (response.content === "Greet") {
    return "greetingAgent";
  } else {
    return "writeQuery";
  }
};

const greetingAgent = async (state: typeof StateAnnotation.State) => {
  const promptValue = `
    You are a Greeting Agent,
    First you have to first analyze user's Question and Greet accordingly.
    After greeting you have to inform user to Ask Database realted Question like Find any data or retrieve any thing which is in the database.
    User's question : ${state.question}
  `;

  const response = await llm.invoke(promptValue);
  return {
    answer: response.content,
  };
};

const writeQuery = async (state: typeof InputStateAnnotation.State) => {
  const promptValue = await queryPromptTemplate.invoke({
    dialect: "mysql",
    top_k: 5,
    table_info: await db.getTableInfo(),
    input: state.question,
  });

  const result = await structuredLlm.invoke(promptValue);
  return {
    query: result.query,
  };
};

const checkQuery = async (state: typeof StateAnnotation.State) => {
  const promptValue = `
    Given following Query and Question if you don't find any connection then 
    return me Not Match otherwise return Match.
    Question: ${state.question}\n
    SQL Query: ${state.query}\n
  `;

  const response = await llm.invoke(promptValue);

  if (response.content === "Not Match") {
    return "generateNormalAnswer";
  } else {
    return "executeQuery";
  }
};

const executeQuery = async (state: typeof StateAnnotation.State) => {
  const executeQueryTool = new QuerySqlTool(db);
  return {
    result: await executeQueryTool.invoke(state.query),
  };
};

const generateAnswer = async (state: typeof StateAnnotation.State) => {
  const promptValue =
    "Given the following user question, corresponding SQL query, " +
    "and SQL result, answer the user question.\n\n" +
    `Question: ${state.question}\n` +
    `SQL Query: ${state.query}\n` +
    `SQL Result: ${state.result}\n`;

  const response = await llm.invoke(promptValue);
  console.log("Check this repsponse generateAnswer ====>", response);

  return {
    answer: response.content,
  };
};

const generateNormalAnswer = async (state: typeof StateAnnotation.State) => {
  return {
    answer: "No Data Found.",
  };
};

const graphBuilder = new StateGraph({
  stateSchema: StateAnnotation,
})
  .addNode("greetingAgent", greetingAgent)
  .addNode("writeQuery", writeQuery)
  .addConditionalEdges("__start__", needGreetUser)
  .addEdge("greetingAgent", "__end__")
  .addConditionalEdges("writeQuery", checkQuery)
  .addNode("generateNormalAnswer", generateNormalAnswer)
  .addEdge("generateNormalAnswer", "__end__")
  .addNode("executeQuery", executeQuery)
  .addNode("generateAnswer", generateAnswer)
  .addEdge("executeQuery", "generateAnswer")
  .addEdge("generateAnswer", "__end__");

const graph = graphBuilder.compile();

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userQuestion = url.searchParams.get("question");
    console.log("user question =>", userQuestion);

    const image = (await graph.getGraphAsync()).drawMermaidPng();
    const arrayBuffer = await (await image).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.writeFile("./flow.png", buffer);

    // tslab.display.png(new Uint8Array(arrayBuffer));
    const answer = [];
    const response = await graph.stream(
      { question: userQuestion },
      {
        streamMode: "values",
      }
    );
    for await (const step of response) {
      // const lastData = step.messages[step.messages.length - 1];
      console.log(step);
      console.log("\n====\n");
      answer.push(step);
    }
    // console.log("Check my answer ===>", answer[answer.length - 1]);

    return Response.json({
      message: answer[answer.length - 1].answer || "Hello from Lang Graph",
    });
  } catch (err) {
    console.log("Error from Error ===>", err);
  }
}
