import {
  MemorySaver,
  Annotation,
  NodeInterrupt,
  Command,
  StateGraph,
  MessagesAnnotation,
  END,
  START,
} from "@langchain/langgraph";
import * as readline from "node:readline/promises"; // This uses the promise-based APIs
import { stdin as input, stdout as output } from "node:process";

import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import * as fs from "fs/promises";
import rl from "../app/utils/userInput/readLine";

const GraphAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  /**
   * Whether or not permission has been granted to refund the user.
   */
  refundAuthorized: Annotation<boolean>(),
});

const llm = new ChatOpenAI({
  apiKey:
    "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",
  model: "gpt-4o",
  temperature: 0,
});

const processRefundTool = tool(
  (input) => {
    return `Successfully processed refund for ${input.productId}`;
  },
  {
    name: "process_refund",
    description: "Process a refund for a given product ID.",
    schema: z.object({
      productId: z.string().describe("The ID of the product to be refunded."),
    }),
  }
);

const tools = [processRefundTool];

const callTool = async (state: typeof GraphAnnotation.State) => {
  const { messages, refundAuthorized } = state;
  console.log("Check this ===>", refundAuthorized);

  if (!refundAuthorized) {
    const data = new NodeInterrupt("Permission to refund is required.");
    console.log("data =====>", data);
  }

  const lastMessage = messages[messages.length - 1];
  // Cast here since `tool_calls` does not exist on `BaseMessage`
  const messageCastAI = lastMessage as AIMessage;
  if (messageCastAI._getType() !== "ai" || !messageCastAI.tool_calls?.length) {
    throw new Error("No tools were called.");
  }
  const toolCall = messageCastAI.tool_calls[0];

  // Invoke the tool to process the refund
  const refundResult = await processRefundTool.invoke(toolCall);

  return {
    messages: refundResult,
  };
};

const callModel = async (state: typeof GraphAnnotation.State) => {
  const { messages } = state;

  const llmWithTools = llm.bindTools(tools);
  const result = await llmWithTools.invoke(messages);
  return { messages: [result] };
};

const shouldContinue = (state: typeof GraphAnnotation.State) => {
  const { messages } = state;

  const lastMessage = messages[messages.length - 1];
  // Cast here since `tool_calls` does not exist on `BaseMessage`
  const messageCastAI = lastMessage as AIMessage;
  if (messageCastAI._getType() !== "ai" || !messageCastAI.tool_calls?.length) {
    // LLM did not call any tools, or it's not an AI message, so we should end.
    return END;
  }

  // Tools are provided, so we should continue.
  return "tools";
};

const workflow = new StateGraph(GraphAnnotation)
  .addNode("agent", callModel)
  .addEdge(START, "agent")
  .addNode("tools", callTool)
  .addEdge("tools", "agent")
  .addConditionalEdges("agent", shouldContinue, ["tools", END]);

export const graph = workflow.compile({
  checkpointer: new MemorySaver(),
});

async function main() {
  const config = {
    configurable: { thread_id: "refunder_dynamic" },
    streamMode: "updates" as const,
  };
  const input = {
    messages: [
      {
        role: "user",
        content: "Can I have a refund for my purchase? Order no. 123",
      },
    ],
  };

  for await (const event of await graph.stream(input, config)) {
    const key = Object.keys(event)[0];
    if (key) {
      console.log(`Event: ${key}\n`);
    }
  }

  console.log("\n---INTERRUPTING GRAPH TO UPDATE STATE---\n\n");

  // console.log(
  //   "---refundAuthorized value before state update---",
  //   (await graph.getState(config)).values.refundAuthorized
  // );

  // const rl = readline.createInterface({ input, output });
  // const userInput = interrupt("Currently where you are?");
  // console.log("Thank you for your query ====>", query);
  const userInput = await rl.question("Can i proceed?Yes/No");
  console.log("Thank you for your feedback ====>", userInput);
  rl.close();

  const answer = userInput === "Yes" ? true : false;

  await graph.updateState(config, { refundAuthorized: answer });

  // console.log(
  //   "---refundAuthorized value after state update---",
  //   (await graph.getState(config)).values.refundAuthorized
  // );

  // console.log("\n---CONTINUING GRAPH AFTER STATE UPDATE---\n\n");

  for await (const event of await graph.stream(null, config)) {
    // Log the event to the terminal
    console.log("Check =====>", event);
  }
}

main();
