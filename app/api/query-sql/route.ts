// import mysql from "mysql2/promise";
import { ChatOpenAI } from "@langchain/openai";
import { SqlDatabase } from "langchain/sql_db";
import { DataSource } from "typeorm";
import { Annotation, StateGraph } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { pull } from "langchain/hub";
import { QuerySqlTool } from "langchain/tools/sql";
import { z } from "zod";
// const dbConfig = process.env;

const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o-mini",
  temperature: 0
});

// const datasource = new DataSource({
//     type: "mysql",
//     host: process.env.DB_HOST || "localhost",
//     // port: 3000,
//     username: process.env.DB_USER || "root",
//     password: process.env.DB_PASS || "tops12345",
//     database: process.env.DB_NAME || "sql_prompt",
// });

// const db = await SqlDatabase.fromDataSourceParams({
//     appDataSource: datasource,
// });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userQuestion = url.searchParams.get("question");
  console.log("url =>", userQuestion);

  if (!userQuestion) {
    return new Response(JSON.stringify({ error: "Question is invalid" }), { status: 400 });
  }

//   const result = await llm.invoke(userQuestion);
//   console.log("result =>", result);

const InputStateAnnotation = Annotation.Root({
    question: Annotation<string>,
  });

  const StateAnnotation = Annotation.Root({
    question: Annotation<string>,
    query: Annotation<string>,
    result: Annotation<string>,
    answer: Annotation<string>,
  });

  const queryPromptTemplate = await pull<ChatPromptTemplate>("langchain-ai/sql-query-system-prompt");

  const queryOutputSchema = z.object({
    query: z.string().describe("Syntactically valid MYSQL query."),
  });

  const structuredLlm = llm.withStructuredOutput(queryOutputSchema);

  const writeQuery = async (state: typeof InputStateAnnotation.State) => {
    const promptValue = await queryPromptTemplate.invoke({
      dialect: db.appDataSourceOptions.type,
      top_k: 10,
      table_info: await db.getTableInfo(),
      input: state.question,
    });
    const result = await structuredLlm.invoke(promptValue);
    return { query: result.query };
  };

  const executeQuery = async (state: typeof StateAnnotation.State) => {
    const executeQueryTool = new QuerySqlTool(db);
    return { result: await executeQueryTool.invoke(state.query) };
  };


  const generateAnswer = async (state: typeof StateAnnotation.State) => {
    const promptValue =
      "Given the following user question, corresponding SQL query, " +
      "and SQL result, answer the user question.\n\n" +
      `Question: ${state.question}\n` +
      `SQL Query: ${state.query}\n` +
      `SQL Result: ${state.result}\n`;
    const response = await llm.invoke(promptValue);
    return { answer: response.content };
  };

  const graphBuilder = new StateGraph({
    stateSchema: StateAnnotation
  }).addNode("writeQuery", writeQuery)
    .addNode("executeQuery", executeQuery)
    .addNode("generateAnswer", generateAnswer)
    .addEdge("__start__", "writeQuery")
    .addEdge("writeQuery", "executeQuery")
    .addEdge("executeQuery", "generateAnswer")
    .addEdge("generateAnswer", "__end__");

  const graph = graphBuilder.compile();

  const input = { question: "How many Employees are there?" };

  const result = await graph.invoke(input);
  console.log("result =>", result);

  return Response.json({ message: result || "Hello from the SQL API" });
}
