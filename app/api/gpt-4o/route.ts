import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0.5,
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userQuestion = url.searchParams.get("question");
    console.log("user question =>", userQuestion);

    const response = await llm.invoke(userQuestion);

    return Response.json({
      message: response.content || "Hello from lang graph 2 route",
    });
  } catch (err) {
    console.log("Error from lang graph 2 API", err);
  }
}
