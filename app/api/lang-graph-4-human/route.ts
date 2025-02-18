import rl from "@/app/utils/userInput/readLine";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import {
  interrupt,
  MemorySaver,
  MessagesAnnotation,
  StateGraph,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as fs from "fs/promises";

const tools = [
  new TavilySearchResults({
    maxResults: 3,
    apiKey: "key",
  }),
];
const toolNode = new ToolNode(tools);

const askHumanTool = tool(
  async () => {
    const userInput = await rl.question("Currently where you are?");
    console.log("Thank you for your feedback ====>", userInput);
    rl.close();
    return userInput;
  },
  {
    name: "askHuman",
    description: "Ask the human for output",
  }
);
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

  if (lastMessage.tool_calls?.[0].name === "askHuman") {
    console.log("--- ASKING HUMAN ---");
    return "askHuman";
  }

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

function askHuman(
  state: typeof MessagesAnnotation.State
): Partial<typeof MessagesAnnotation.State> {
  console.log("I am called and asking for user to input====>");

  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const toolCallId = lastMessage.tool_calls?.[0].id;
  const location: string = interrupt("Please provide your location:");
  const newToolMessage = new ToolMessage({
    tool_call_id: toolCallId!,
    content: location,
  });
  return { messages: [newToolMessage] };
}

const workflow = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addNode("action", toolNode)
  .addNode("askHuman", askHuman)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shoudContinue)
  .addEdge("action", "agent")
  .addEdge("askHuman", "agent");

const memory = new MemorySaver();

const app = workflow.compile({
  checkpointer: memory,
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userQuestion = url.searchParams.get("question");
    console.log("user question =>", userQuestion);

    const image = (await app.getGraphAsync()).drawMermaidPng();
    const arrayBuffer = await (await image).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.writeFile("./ask_human_tool.png", buffer);

    const config2 = {
      configurable: { thread_id: "3" },
      streamMode: "values" as const,
    };

    for await (const event of await app.stream(
      {
        messages: [userQuestion],
      },
      config2
    )) {
      const recentMsg = event.messages[event.messages.length - 1];
      console.log(
        `================================ ${recentMsg.getType()} Message (1) =================================`
      );
      console.log(recentMsg.content);
    }

    return Response.json({
      message: "Hello from lang graph 4 human in loop",
    });
  } catch (err) {
    console.log("Error from lang graph 4 human", err);
    return Response.json({ message: "Error" });
  }
}
