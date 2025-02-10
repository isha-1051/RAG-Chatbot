import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

const agentTools = [new TavilySearchResults({ maxResults: 3 })];
  const agentModel = new ChatOpenAI({ temperature: 0 });

  // Initialize memory to persist state between graph runs
  const agentCheckpointer = new MemorySaver();
  const agent = createReactAgent({
    llm: agentModel,
    tools: agentTools,
    checkpointSaver: agentCheckpointer,
  });



export async function GET(req: Request) {
  const url = new URL(req.url);
  const userQuestion = url.searchParams.get("question");
  console.log("user question =>", userQuestion);
  // Define the tools for the agent to use
  
  // Now it's time to use!
  const agentFinalState = await agent.invoke(
    {
      messages: [new HumanMessage(userQuestion)],
    },
    { configurable: { thread_id: "41" } }
  );

  console.log(
    agentFinalState.messages[agentFinalState.messages.length - 1].content
  );

//   const agentNextState = await agent.invoke(
//     { messages: [new HumanMessage("what about ny")] },
//     { configurable: { thread_id: "42" } }
//   );

//   console.log(
//     agentNextState.messages[agentNextState.messages.length - 1].content
//   );

  return Response.json({
    message:
    agentFinalState.messages[agentFinalState.messages.length - 1].content ||
      "Hello from langchain agent",
  });
}
