import { ChatOpenAI, ChatOpenAICallOptions } from "@langchain/openai";
import { SqlDatabase } from "langchain/sql_db";
import { DataSource } from "typeorm";
import { Annotation, StateGraph, MemorySaver } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { pull } from "langchain/hub";
import { QuerySqlTool } from "langchain/tools/sql";
import { SqlToolkit } from "langchain/agents/toolkits/sql";
import { z } from "zod";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { AIMessage, BaseMessage, isAIMessage } from "@langchain/core/messages";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { tool } from "@langchain/core/tools";
import { sendEmail } from "../../utils/gmail/sendEmail";

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
  temperature: 0,
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

const memory = new MemorySaver();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userQuestion = url.searchParams.get("question");
  console.log("user question =>", userQuestion);

  if (!userQuestion) {
    return new Response(JSON.stringify({ error: "Question is invalid" }), {
      status: 400,
    });
  }

  const tools = toolkit.getTools();

  // custom tool
  const LanguageConverterTool = tool(
    async ({ question, language }: { question: string; language: string }) => {
      const llm = new ChatOpenAI({
        apiKey: process.env.OPEN_AI_KEY,
        model: "gpt-4o",
        temperature: 0,
      });
      const promtValue = `
        You are a Language Transalation Agent, You have to identify the language from following user's question, 
        Question: ${question} \n
        Translate the following question into ${language}
      `;

      const response = await llm.invoke(promtValue);
      return response.content;
    },
    {
      name: "LanguageConverterTool",
      description:
        "Call this tool everytime before answer any question for convert your answer to target language.",
      schema: z.object({
        question: z
          .string()
          .describe("Question string for identify target language"),
        language: z
          .string()
          .describe("Language for converting Answer into target language"),
      }),
    }
  );

  const sendEmailTool = tool(
    async ({
      to,
      subject,
      body,
    }: {
      to: string;
      subject: string;
      body: string;
    }) => {
      const response = await sendEmail(to, subject, body);
      return response.message;
    },
    {
      name: "sendEmail",
      description: "Call this function for sending an email to perticular user",
      schema: z.object({
        to: z.string(),
        subject: z.string(),
        body: z.string(),
      }),
    }
  );

  const searchTool = new TavilySearchResults({ maxResults: 3 });
  // console.log(
  //   tools.map((tool) => ({ name: tool.name, description: tool.description }))
  // );

  const systemPromptTemplate = await pull<ChatPromptTemplate>(
    "langchain-ai/sql-agent-system-prompt"
  );

  const systemMessage = await systemPromptTemplate.format({
    dialect: "mysql",
    top_k: 5,
  });

  const agent = createReactAgent({
    llm: llm,
    tools: [...tools, searchTool, sendEmailTool],
    stateModifier: systemMessage,
    checkpointer: memory,
  });

  const input2 = {
    messages: [{ role: "user", content: userQuestion }],
  };

  const config = { configurable: { thread_id: "1003", streamMode: "values" } };

  const result3 = await agent.stream(input2, config);

  const array = [];
  for await (const step of result3) {
    const messages = step?.agent?.messages;

    if (!!messages) {
      const lastMessage = messages[messages.length - 1];
      prettyPrint(lastMessage);
      console.log("-----\n");

      array.push(lastMessage.content);
    }
  }

  // console.log("query =>", array[array.length - 3]);
  console.log("answer =>", array[array.length - 1]);
  
  return Response.json({ message: array[array.length - 1] || "Hello from the SQL API" });
}
