import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { HumanMessage } from "@langchain/core/messages";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";

const tools = [new TavilySearchResults({ maxResults: 3 })];

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

const workflow = new StateGraph(MessagesAnnotation)
  .addNode("Agnet", callModel)
  .addEdge("__start__", "Agnet")
  .addEdge("Agnet", "__end__");

const app = workflow.compile();

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userQuestion = url.searchParams.get("question");
    console.log("user question =>", userQuestion);

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
