import {
  MemorySaver,
  Annotation,
  interrupt,
  Command,
  StateGraph,
  MessagesAnnotation,
} from "@langchain/langgraph";
import * as readline from "node:readline/promises"; // This uses the promise-based APIs
import { stdin as input, stdout as output } from "node:process";

import rl from "../app/utils/userInput/readLine";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import * as fs from "fs/promises";

async function main() {
  const tools = [
    new TavilySearchResults({
      maxResults: 3,
      apiKey: "key",
    }),
  ];

  const askHumanTool = tool(
    async ({ query }) => {
      const rl = readline.createInterface({ input, output });
      // const userInput = interrupt("Currently where you are?");
      // console.log("Thank you for your query ====>", query);
      const userInput = await rl.question(query + ":");
      console.log("Your feedback ====>", userInput);
      rl.close();
      return userInput;
    },
    {
      name: "askHuman",
      description: "Ask the human for output",
      schema: z.object({
        query: z.string().describe("The query to user's question"),
      }),
    }
  );
  const toolNode = new ToolNode([...tools, askHumanTool]);
  const llm = new ChatOpenAI({
    apiKey:
      "key",
    model: "gpt-4o-mini",
    temperature: 0.5,
  }).bindTools([...tools, askHumanTool]);

  // const modelWithTools = .bindTools([...tools, askHumanTool]);

  const shoudContinue = async (state: typeof MessagesAnnotation.State) => {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    if (lastMessage && !lastMessage.tool_calls?.length) {
      return "__end__";
    }

    // if (lastMessage.tool_calls?.[0].name === "askHuman") {
    //   console.log("--- ASKING HUMAN ---");
    //   return "askHuman";
    // }

    return "action";
  };

  const callModel = async (
    state: typeof MessagesAnnotation.State
  ): Promise<Partial<typeof MessagesAnnotation.State>> => {
    //   const messages = { state };
    const response = await llm.invoke(state.messages);
    return {
      messages: [response],
    };
  };

  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("action", toolNode)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", shoudContinue)
    .addEdge("action", "agent");

  const memory = new MemorySaver();

  const app = workflow.compile({
    checkpointer: memory,
  });

  const image = (await app.getGraphAsync()).drawMermaidPng();
  const arrayBuffer = await (await image).arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  fs.writeFile("./ask_human_tool_2.png", buffer);

  //   ======================
  const rl = readline.createInterface({ input, output });
      // const userInput = interrupt("Currently where you are?");
      // console.log("Thank you for your query ====>", query);
      const userInputValue = await rl.question("Ask any question:");
      // console.log("Your feedback ====>", userInputValue);
      rl.close();
  const userInput = {
    role: "user",
    content: userInputValue,
  };

  const config2 = {
    configurable: { thread_id: "3" },
    streamMode: "values" as const,
  };

  for await (const event of await app.stream(
    {
      messages: [userInput],
    },
    config2
  )) {
    const recentMsg = event.messages[event.messages.length - 1];
    console.log(
      `================================ ${recentMsg.getType()} Message (1) =================================`
    );
    console.log(recentMsg.content);
  }

  //   for await (const event of await app.stream(
  //     new Command({ resume: "HUman input" }),
  //     config2
  //   )) {
  //     console.log(event);
  //     console.log("\n====\n");
  //   }
}

main();
