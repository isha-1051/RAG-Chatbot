import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { StructuredTool } from "@langchain/core/tools";
import { MemorySaver } from "@langchain/langgraph";
import {
  GmailCreateDraft,
  GmailGetMessage,
  GmailGetThread,
  GmailSearch,
  GmailSendMessage,
} from "@langchain/community/tools/gmail";
import {
  GoogleCalendarCreateTool,
  GoogleCalendarViewTool,
} from "@langchain/community/tools/google_calendar";
import { Calculator } from "@langchain/community/tools/calculator";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

// need to find a way to save memory in lang Graph

// llm
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.5,
});

// tools

const searchTool = new TavilySearchResults({ maxResults: 3 });

// Gmail tool
// const gmailTools: StructuredTool[] = [
//   new GmailCreateDraft(),
//   new GmailGetMessage(),
//   new GmailGetThread(),
//   new GmailSearch(),
//   new GmailSendMessage(),
// ];

// const gmailAgent = await initializeAgentExecutorWithOptions(gmailTools, model, {
//   agentType: "structured-chat-zero-shot-react-description",
//   verbose: true,
// });

// calendar tool



export async function GET(req: Request) {
  const url = new URL(req.url);
  const userQuestion = url.searchParams.get("question");
  console.log("user question =>", userQuestion);
  const googleCalendarParams = {
    credentials: {
      clientEmail: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL,
      privateKey: process.env.GOOGLE_CALENDAR_PRIVATE_KEY,
      calendarId: process.env.GOOGLE_CALENDAR_CALENDAR_ID,
    },
    scopes: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    model,
  };
  
  const tools = [
    new Calculator(),
    new GoogleCalendarCreateTool(googleCalendarParams),
    new GoogleCalendarViewTool(googleCalendarParams),
  ];
  
  const calendarAgent = createReactAgent({
    llm: model,
    tools,
  });
  const response = await model.invoke(userQuestion);
  //   const createResult = await gmailAgent.invoke({ input: userQuestion });
  //     console.log("check createResult ====>", createResult);

//   const createInput = `Create a meeting with Isha Goyal Tomorrow at 4pm - adding to the agenda of it the result of 99 + 99`;

//   const createResult = await calendarAgent.invoke({
//     messages: [{ role: "user", content: createInput }],
//   });
//   //   Create Result {
//   //     output: 'A meeting with John Doe on 29th September at 4pm has been created and the result of 99 + 99 has been added to the agenda.'
//   //   }
//   console.log("Create Result", createResult);



//   const viewInput = `What meetings do I have this week?`;

//   const viewResult = await calendarAgent.invoke({
//     messages: [{ role: "user", content: viewInput }],
//   });
//   //   View Result {
//   //     output: "You have no meetings this week between 8am and 8pm."
//   //   }
//   console.log("View Result", viewResult);

  return Response.json({
    message: response.content || "Hello from Lang Graph",
  });
}
