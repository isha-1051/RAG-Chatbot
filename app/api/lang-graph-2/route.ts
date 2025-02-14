import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import fs from "fs/promises";

const tools = [new TavilySearchResults({ maxResults: 3 })];
const toolsNode = new ToolNode(tools);

const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.5,
}).bindTools(tools);

const callModel = async (state: typeof MessagesAnnotation.State) => {
  const response = await llm.invoke(state.messages);
  return {
    messages: [response],
  };
};

const shouldContinue = async (state: typeof MessagesAnnotation.State) => {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  if (lastMessage.tool_calls?.length) {
    return "tools";
  }
  return "__end__";
};

const workflow = new StateGraph(MessagesAnnotation)
  .addNode("Agent", callModel)
  .addNode("tools", toolsNode)
  .addEdge("__start__", "Agent")
  .addEdge("tools", "Agent")
  .addConditionalEdges("Agent", shouldContinue);

const app = workflow.compile();

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userQuestion = url.searchParams.get("question");
    console.log("user question =>", userQuestion);

    const image = (await app.getGraphAsync()).drawMermaidPng();
    const arrayBuffer = await (await image).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.writeFile("./flow2.png", buffer);
    // const response = await llm.invoke(userQuestion);

    const execute = await app.invoke({
      messages: [new HumanMessage(userQuestion)],
    });

    return Response.json({
      message:
        execute.messages[execute.messages.length - 1].content ||
        "Hello from lang graph 2 route",
    });
  } catch (err) {
    console.log("Error from lang graph 2 API", err);
  }
}
