import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  Annotation,
  MemorySaver,
  messagesStateReducer,
  StateGraph,
} from "@langchain/langgraph";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
// need to find a way to save memory in lang Graph

// llm
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.5,
});

// tools

const searchTool = new TavilySearchResults({ maxResults: 3 });

const weatherTool = tool(async ({ query }) => {
    console.log("cehck query=====>", query);
    
    // This is a placeholder for the actual implementation
    if (query.toLowerCase().includes("sf") || query.toLowerCase().includes("san francisco")) {
      return "It's 60 degrees and foggy."
    } else{
        console.log("I am from else ====>");
        return "Call a search tool."
    }
    // return "It's 90 degrees and sunny."
  }, {
    name: "weather",
    description:
      "Call to get the current weather for a location.",
    schema: z.object({
      query: z.string().describe("The query to use in your search."),
    }),
  });

const allTools = [weatherTool, searchTool];
const allToolNode = new ToolNode(allTools);

const llm = model.bindTools(allTools);

const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
  }),
});

async function callModel(state: typeof StateAnnotation.State) {
  const messages = state.messages;
  const response = await llm.invoke(messages);
  return {
    messages: [response],
  };
}

function shouldContinue(state: typeof StateAnnotation.State) {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1] as AIMessage;

  // If the LLM makes a tool call, then we route to the "tools" node
  if (lastMessage.tool_calls?.length) {
    return "tools";
  }
  // Otherwise, we stop (reply to the user)
  return "__end__";
}

const workflow = new StateGraph(StateAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", allToolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent");

const checkpointer = new MemorySaver();

const app = workflow.compile({ checkpointer });

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userQuestion = url.searchParams.get("question");
    console.log("user question =>", userQuestion);

    const response = await model.invoke(userQuestion);

    const finalState = await app.invoke(
      {
        messages: [new HumanMessage(userQuestion)],
      },
      {
        configurable: {
          thread_id: "42",
        },
      }
    );

    return Response.json({
      message:
        finalState.messages[finalState.messages.length - 1].content ||
        "Hello from Lang Graph",
    });
  } catch (err) {
    console.log("Error from Error ===>", err);
  }
}
