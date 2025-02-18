import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import fs from "fs/promises";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Annotation, END, StateGraph } from "@langchain/langgraph";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { createRetrieverTool } from "langchain/tools/retriever";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { pull } from "langchain/hub";

// Emplementation of LangGraph Retrieval Agent

// Retriever

const urls = [
  "https://lilianweng.github.io/posts/2023-06-23-agent/",
  "https://lilianweng.github.io/posts/2023-03-15-prompt-engineering/",
  "https://lilianweng.github.io/posts/2023-10-25-adv-attack-llm/",
];

const docs = await Promise.all(
  urls.map((url) => new CheerioWebBaseLoader(url).load())
);

const docsList = docs.flat();

const textSplliter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
});

const docSplits = await textSplliter.splitDocuments(docsList);

const vectorStore = await MemoryVectorStore.fromDocuments(
  docSplits,
  new OpenAIEmbeddings()
);

const retriever = vectorStore.asRetriever();

// Agent state

const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});

const tool = createRetrieverTool(retriever, {
  name: "retrieve_blog_posts",
  description:
    "Search and return information about Lilian Weng blog posts on LLM agents, prompt engineering, and adversarial attacks on LLMs.",
});

const tools = [tool];

const toolNode = new ToolNode(tools);

// node & edges

const agent = async (state: typeof GraphState.State) => {
  console.log("---CALL AGENT---");

  const { messages } = state;
  const filteredMessages = messages.filter((message) => {
    if (
      "tool_calls" in message &&
      Array.isArray(message.tool_calls) &&
      message.tool_calls.length > 0
    ) {
      return message.tool_calls[0].name !== "give_relevence_score";
    }
    return true;
  });

  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.5,
  }).bindTools(tools);

  const response = await llm.invoke(filteredMessages);

  return {
    messages: [response],
  };
};

const shouldRetrive = async (state: typeof GraphState.State) => {
  const { messages } = state;
  console.log("---DECIDE TO RETRIEVE---");
  const lastMessage = messages[messages.length - 1];
  if (
    "tool_calls" in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls?.length
  ) {
    console.log("---DECISION: RETRIEVE---");
    return "retrieve";
  }
  return END;
};

const gradeDocuments = async (state: typeof GraphState.State) => {
  console.log("---GET RELEVANCE---");

  const { messages } = state;

  const tool = {
    name: "give_relevence_score",
    description: "Give a relevance score to the retrieved documents.",
    schema: z.object({
      binaryScore: z.string().describe("Relevance score 'yes' or 'no'"),
    }),
  };

  const prompt = ChatPromptTemplate.fromTemplate(
    `You are a grader assessing relevance of retrieved docs to a user question.
  Here are the retrieved docs:
  \n ------- \n
  {context} 
  \n ------- \n
  Here is the user question: {question}
  If the content of the docs are relevant to the users question, score them as relevant.
  Give a binary score 'yes' or 'no' score to indicate whether the docs are relevant to the question.
  Yes: The docs are relevant to the question.
  No: The docs are not relevant to the question.`
  );

  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.5,
  }).bindTools([tool], {
    tool_choice: tool.name,
  });

  const chain = prompt.pipe(model);

  const lastMessage = messages[messages.length - 1];

  // console.log("Check this XXXXXXXXXXXXXXXXX", messages[0].content);

  const score = await chain.invoke({
    question: messages[0].content as string,
    context: lastMessage.content as string,
  });

  return {
    messages: [score],
  };
};

const checkRelevance = async (state: typeof GraphState.State) => {
  console.log("---CHECK RELEVANCE---");
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  if (!("tool_calls" in lastMessage)) {
    throw new Error(
      "The 'checkRelevance' node requires the most recent message to contain tool calls."
    );
  }

  const toolCalls = (lastMessage as AIMessage).tool_calls;
  if (!toolCalls || !toolCalls.length) {
    throw new Error("Last message was not a function message");
  }

  if (toolCalls[0].args.binaryScore === "yes") {
    console.log("---DECISION: DOCS RELEVANT---");
    return "yes";
  }

  console.log("---DECISION: DOCS NOT RELEVANT---");
  return "no";
};

const generate = async (state: typeof GraphState.State) => {
  console.log("---GENERATE---");
  const { messages } = state;
  const question = messages[0].content as string;
  const lastToolMessage = messages
    .slice()
    .reverse()
    .find((msg) => msg._getType() === "tool");
  if (!lastToolMessage) {
    throw new Error("No tool message found in the conversation history");
  }

  const docs = lastToolMessage.content as string;

  const prompt = await pull<ChatPromptTemplate>("rlm/rag-prompt");

  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.5,
    streaming: true,
  });

  const ragChain = prompt.pipe(llm);

  const response = await ragChain.invoke({
    context: docs,
    question,
  });

  return {
    messages: [response],
  };
};

const rewrite = async (state: typeof GraphState.State) => {
  console.log("---TRANSFORM QUERY---");

  const { messages } = state;
  const question = messages[0].content as string;
  const prompt = ChatPromptTemplate.fromTemplate(
    `Look at the input and try to reason about the underlying semantic intent/meaning. \n 
Here is the initial question:
\n ------- \n
{question} 
\n ------- \n
Formulate an improved question:`
  );

  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.5,
    // streaming: true,
  });

  const response = await prompt.pipe(model).invoke({ question });
  return {
    messages: [response],
  };
};

const workflow = new StateGraph(GraphState)
  .addNode("agent", agent)
  .addNode("retrieve", toolNode)
  .addNode("gradeDocuments", gradeDocuments)
  .addNode("generate", generate)
  .addNode("rewrite", rewrite)

  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldRetrive)
  .addEdge("retrieve", "gradeDocuments")
  .addConditionalEdges("gradeDocuments", checkRelevance, {
    yes: "generate",
    no: "rewrite",
  })
  .addEdge("generate", "__end__")
  .addEdge("rewrite", "agent");

const app = workflow.compile();

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userQuestion = url.searchParams.get("question");
    console.log("user question =>", userQuestion);

    const image = (await app.getGraphAsync()).drawMermaidPng();
    const arrayBuffer = await (await image).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.writeFile("./agentic_rag.png", buffer);

    const response = await app.stream({
      messages: [new HumanMessage(userQuestion)],
    });
    let finalState;
    for await (const output of response) {
      for (const [key, value] of Object.entries(output)) {
        const lastMsg = output[key].messages[output[key].messages.length - 1];
        console.log(`Output from node: '${key}'`);
        console.dir(
          {
            type: lastMsg._getType(),
            content: lastMsg.content,
            tool_calls: lastMsg.tool_calls,
          },
          { depth: null }
        );
        console.log("---\n");
        finalState = value;
      }
    }
    return Response.json({
      message:
        finalState.messages[0].content || "Hello from lang graph 2 route",
    });
  } catch (err) {
    console.log("Error from lang graph 2 API", err);
  }
}
