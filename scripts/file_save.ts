import OpenAI from "openai";
import fs from "fs";

const openai = new OpenAI({
  // apiKey: process.env.OPENAI_API_KEY
  apiKey: process.env.OPENAI_API_KEY
});

async function main() {
  const assistant = await openai.beta.assistants.create({
    name: "Financial Analyst Assistant",
    instructions:
      "You are an expert financial analyst. Use you knowledge base to answer questions about audited financial statements.",
    model: "gpt-4o",
    tools: [{ type: "file_search" }],
  });

  //   const fileStreams: any = [
  //     "/home/tops/Desktop/Ankur/RAG/RAG-Chatbot/app/api/db_structure.txt",
  //     "/home/tops/Desktop/Ankur/RAG/RAG-Chatbot/app/api/db_structure2.txt",
  //   ].map((path) => fs.createReadStream(path));

  // const fileStream = fs.createReadStream("/home/tops/Desktop/Ankur/RAG/RAG-Chatbot/app/api/db_structure.txt");

  // Create a vector store including our two files.
  //   const vectorStore = await openai.beta.vectorStores.create({
  //     name: "Database structure Assistant",
  //   });

  //   console.log("check this ====>", fileStream);

  //   await openai.beta.vectorStores.fileBatches.createAndPoll(
  //     vectorStore.id,
  //     fileStream
  //   );

  // ====================   new

  // A user wants to attach a file to a specific message, let's upload it.
  const db_struct = await openai.files.create({
    file: fs.createReadStream(
      "/home/tops/Desktop/Ankur/RAG/RAG-Chatbot/app/api/db_structure.txt"
    ),
    purpose: "assistants",
  });

  console.log("check ===db_struct ===>", db_struct);
  

  const thread = await openai.beta.threads.create({
    messages: [
      {
        role: "user",
        content: `Your are a helpful, cheerful database assistant. 
                Use the following database schema when creating your answers:
    
                Use attachment file to see database structure.
    
                Include column name headers in the query results.
    
                Always provide your answer in the JSON format below:
                
                { ""summary"": ""your-summary"", ""query"":  ""your-query"" }
                
                Output ONLY JSON.
                In the preceding JSON response, substitute ""your-query"" with MYSQL Query to retrieve the requested data.
                In the preceding JSON response, substitute ""your-summary"" with a summary of the query.
                Always include all columns in the table.
                If the resulting query is non-executable, replace ""your-query"" with NA, but still substitute ""your-query"" with a summary of the query.
                Always limit the MYSQL Query to 50 rows.
                Do not use Microsoft SQL Query"; 

                If the user needs any information related to the orders schema or payments, replace ""your-query"" with NA.
            `,
        // Attach the new file to the message.
        attachments: [
          { file_id: db_struct.id, tools: [{ type: "file_search" }] },
        ],
      },
      {
        role: "user",
        content: "how many employees are serving as sales rep",
      },
    ],
  });

  const stream = openai.beta.threads.runs
    .stream(thread.id, {
      assistant_id: assistant.id,
    })
    .on("textCreated", () => console.log("assistant >"))
    .on("toolCallCreated", (event) => console.log("assistant " + event.type))
    .on("messageDone", async (event) => {
      if (event.content[0].type === "text") {
        const { text } = event.content[0];
        const { annotations } = text;
        const citations: string[] = [];

        let index = 0;
        for (const annotation of annotations) {
          text.value = text.value.replace(annotation.text, "[" + index + "]");
          const file_citation = 'file_citation' in annotation ? annotation.file_citation as { file_id: string } : null;
          if (file_citation) {
            const citedFile = await openai.files.retrieve(
              file_citation.file_id
            );
            citations.push("[" + index + "]" + citedFile.filename);
          }
          index++;
        }

        console.log(text.value);
        console.log(citations.join("\n"));
      }
    });

  // =========================== new end

  //   await openai.beta.assistants.update(assistant.id, {
  //     tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
  //   });

  //   const thread = await openai.beta.threads.create({
  //     messages: [{ role: "user", content: "Which table do you have?" }],
  //     tool_resources: {
  //       file_search: {
  //         vector_store_ids: [vectorStore.id],
  //       },
  //     },
  //   });

  //   const runStep = await openai.beta.threads.runs.steps.retrieve(
  //     "thread_abc123",
  //     "run_abc123",
  //     "step_abc123",
  //     {
  //       include: ["step_details.tool_calls[*].file_search.results[*].content"],
  //     }
  //   );

  //   console.log(runStep);
}

main();
