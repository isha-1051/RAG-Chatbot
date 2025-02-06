import { ChatOpenAI } from "@langchain/openai";
import { SqlDatabase } from "langchain/sql_db";
import { DataSource } from "typeorm";
import { Annotation, StateGraph } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { pull } from "langchain/hub";
import { QuerySqlTool } from "langchain/tools/sql";
import { SqlToolkit } from "langchain/agents/toolkits/sql";
import { z } from "zod";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { AIMessage, BaseMessage, isAIMessage } from "@langchain/core/messages";

const prettyPrint = (message: BaseMessage) => {
  let txt = `[${message._getType()}]: ${message.content}`;
  if ((isAIMessage(message) && message.tool_calls?.length) || 0 > 0) {
    const tool_calls = (message as AIMessage)?.tool_calls
      ?.map((tc) => `- ${tc.name}(${JSON.stringify(tc.args)})`)
      .join("\n");
    txt += ` \nTools: \n${tool_calls}`;
  }
  console.log(txt);
};

const llm = new ChatOpenAI({
  apiKey: process.env.OPEN_AI_KEY,
  model: "gpt-4o-mini",
  temperature: 0
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

const toolkit = new SqlToolkit(db, llm);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userQuestion = url.searchParams.get("question");
  console.log("user question =>", userQuestion);

  if (!userQuestion) {
    return new Response(JSON.stringify({ error: "Question is invalid" }), { status: 400 });
  }

  // const result = await llm.invoke(userQuestion);
  // console.log("result =>", result);

  /*
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

  const input = { question: userQuestion ?? "How many Employees are there?" };

  const result = await graph.invoke(input);
  console.log("result =>", result);
  */
 
  /* The SqlToolkit includes tools that can:
    1. Create and execute queries
    2. Check query syntax
    3. Retrieve table descriptions
  */
 
  const tools = toolkit.getTools();
  // console.log(
  //   tools.map((tool) => ({ name: tool.name, description: tool.description }))
  // );

  const systemPromptTemplate = await pull<ChatPromptTemplate>("langchain-ai/sql-agent-system-prompt");

  const systemMessage = await systemPromptTemplate.format({ dialect: "mysql", top_k: 5 });

  const agent = createReactAgent({
    llm: llm,
    tools: tools,
    stateModifier: systemMessage,
  });

  const input2 = {
    // messages: [{ role: "user", content: "Which country's customers spent the most?" }],
    // messages: [{ role: "user", content: "Describe the orders table" }],
    messages: [{ role: "user", content: userQuestion }],
  };

  const result3 = await agent.stream(input2, { streamMode: "values" });
  // console.log("result3", result3[0]);

  const array = [];
  for await (const step of result3) {
    const lastMessage = step.messages[step.messages.length - 1];
    // console.log("lastMessage =>", lastMessage);
    prettyPrint(lastMessage);
    console.log("-----\n");

    array.push(lastMessage.content);
  }

  // console.log("query =>", array[array.length - 3]);
  // console.log("answer =>", array[array.length - 1]);
  
  return Response.json({ message: array[array.length - 1] || "Hello from the SQL API" });
}
