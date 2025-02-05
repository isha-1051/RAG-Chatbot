import OpenAI from "openai";
import fs from "fs";

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_KEY,
});

async function uploadFileAndCreateVectorStore() {
  try {
    // const fileStreams = ["./schema.json"].map((path) =>
    //   fs.createReadStream(path),
    // );
    const fileStream = fs.createReadStream("./schema.txt");
    // console.log("fileStreams =>", fileStream);

    // Create a vector store including files.
    const vectorStore = await openai.beta.vectorStores.create({
      name: "Database assistant",
    });

    await openai.beta.vectorStores.fileBatches.uploadAndPoll(vectorStore.id, { files: [fileStream] });

    console.log("Vector store created with ID:", vectorStore.id);
    return vectorStore.id;
  } catch (error) {
    console.error("Error uploading schema file:", error);
  }
}

async function createAssistant() {
  try {
    const assistant = await openai.beta.assistants.create({
      name: "Database Assistant",
      instructions: "Use the provided schema file to answer database-related questions.",
      model: "gpt-4o",
      tools: [{ type: "file_search" }],
    });

    console.log("Assistant created with ID:", assistant.id);
    return assistant.id;
  } catch (error) {
    console.error("Error creating assistant:", error);
  }
}

async function updateAssistant(assistantId: string, vectorStoreId: string) {
  const newAssistant = await openai.beta.assistants.update(assistantId, {
    tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
  });
  console.log("newAssistant ===>", newAssistant);
  return newAssistant.id;
}

async function createThread() {
  // A user wants to attach a file to a specific message, let's upload it.
  const file = await openai.files.create({
    file: fs.createReadStream("./schema.txt"),
    purpose: "assistants",
  });

  const thread = await openai.beta.threads.create({
    messages: [
      {
        role: "assistant",
        content: `Your are a helpful, cheerful database assistant. 
                Use the attachment file for database schema when creating your answers.
    
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
        attachments: [{ file_id: file.id, tools: [{ type: "file_search" }] }],
      },
      {
        role: "user",
        content: "How many employees are working as sales representatives?",
      },
    ],
  });

  // The thread now has a vector store in its tool resources.
  console.log("thread ===>", thread, thread.tool_resources?.file_search);
  return thread.id;
}

async function createRunsAndCitations(threadId: string, assistantId: string) {
  const run = await openai.beta.threads.runs.createAndPoll(threadId, {
    assistant_id: assistantId,
  });

  const messages = await openai.beta.threads.messages.list(threadId, {
    run_id: run.id,
  });

  const message = messages.data.pop()!;
  if (message.content[0].type === "text") {
    const { text } = message.content[0];
    const { annotations } = text;
    const citations: string[] = [];

    let index = 0;
    for (const annotation of annotations) {
      text.value = text.value.replace(annotation.text, "[" + index + "]");
      const { file_citation } = annotation;
      if (file_citation) {
        const citedFile = await openai.files.retrieve(file_citation.file_id);
        citations.push("[" + index + "]" + citedFile.filename);
      }
      index++;
    }

    console.log(text.value, "citations");
    console.log(citations.join("\n"));
  }
}

async function askQuestion(assistantId: string, question: string) {
  try {
    const thread = await openai.threads.create({
      assistant_id: assistantId,
    });

    await openai.threads.messages.create(thread.id, {
      role: "user",
      content: question,
    });

    const run = await openai.threads.runs.create(thread.id);

    console.log("Waiting for response...");

    let status = run.status;
    while (status === "in_progress" || status === "queued") {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Polling delay
      const updatedRun = await openai.threads.runs.retrieve(thread.id, run.id);
      status = updatedRun.status;
    }

    const messages = await openai.threads.messages.list(thread.id);
    console.log("Assistant Response:", messages.data[0].content);
  } catch (error) {
    console.error("Error asking question:", error);
  }
}

async function main() {
  // Create a new Assistant with File Search Enabled
  const assistantId = await createAssistant();
  if (!assistantId) return;

  // Upload files and add them to a Vector Store
  const vectorStoreId = await uploadFileAndCreateVectorStore();
  if (!vectorStoreId) return;

  // Update the assistant to use the new Vector Store
  const newAssistantId = await updateAssistant(assistantId, vectorStoreId);
  if (!newAssistantId) return;

  // Create a Thread
  const threadId = await createThread();
  if (!threadId) return;

  // Create a run and check the output
  const runsAndCitations = await createRunsAndCitations(threadId, assistantId);
  // if (!runsAndCitations) return;

  // await askQuestion(assistantId, "What are the columns in the users table?");
}

main();



// import OpenAI from "openai";
// import fs, { promises } from "fs";
// // const fsPromises = require("fs").promises;

// const openai = new OpenAI({
//   apiKey: process.env.OPEN_AI_KEY,
// });

// async function uploadSchemaFile() {
//   try {
//     const response = await openai.files.create({
//       file: fs.createReadStream("schema.txt"),
//       purpose: "assistants",
//     });
//     console.log("File uploaded successfully. File ID:", response.id);
//     return response.id;
//   } catch (error) {
//     console.error("Error uploading schema file:", error);
//   }
// }

// async function createAssistant() { // fileId: string
//   try {
//     const assistant = await openai.beta.assistants.create({
//       name: "Database Assistant",
//       instructions: "Use the provided schema file to answer database-related questions.",
//       model: "gpt-4o",
//       tools: [{ type: "file_search" }],
//       // file_ids: [fileId],
//     });
//     console.log("Assistant created with ID:", assistant.id);

//     return assistant.id;
//   } catch (error) {
//     console.error("Error creating assistant:", error);
//   }
// }

// async function askQuestion(assistantId: string, question: string) {
//   try {
//     const thread = await openai.beta.threads.create();

//     await openai.beta.threads.messages.create(thread.id, {
//       role: "user",
//       content: question,
//     });

//     const run = await openai.beta.threads.runs.create(thread.id, {
//       assistant_id: assistantId,
//     });

//     console.log("Waiting for response...");

//     let status = run.status;
//     while (status === "in_progress" || status === "queued") {
//       await new Promise((resolve) => setTimeout(resolve, 2000)); // Polling delay
//       const updatedRun = await openai.beta.threads.runs.retrieve(thread.id, run.id);
//       status = updatedRun.status;
//     }

//     const messages = await openai.beta.threads.messages.list(thread.id);
//     console.log("Assistant Response:", messages.data[0].content);
//   } catch (error) {
//     console.error("Error asking question:", error);
//   }
// }

// async function main() {
//   // let assistantId;
//   const assistant = await openai.beta.assistants.create({
//     name: "Database Assistant",
//     instructions: "Use the provided schema file to answer database-related questions.",
//     model: "gpt-4o",
//     tools: [{ type: "file_search" }],
//     // file_ids: [fileId],
//   });
//   console.log("Assistant created with ID:", assistant.id);

//   const assistantDetails = {
//     assistantId: assistant.id,
//     name: "Database Assistant",
//     instructions: "Use the provided schema file to answer database-related questions.",
//     model: "gpt-4o",
//     tools: [{ type: "file_search" }],
//   };

//   // Save the assistant details to assistant.json
//   await promises.writeFile(
//     "./schema.json",
//     JSON.stringify(assistantDetails, null, 2)
//   );
//   const assistantId = assistantDetails.assistantId;

//   // Create a thread using the assistantId
//   const thread = await openai.beta.threads.create();
//   console.log("thread created ===>", thread);

//   // Upload the file
//   const file = await openai.files.create({
//     file: fs.createReadStream("./schema.json"),
//     purpose: "assistants",
//   });
//   console.log("file ===>", file);

//   // Retrieve existing file IDs from assistant.json to not overwrite
//   const existingFileIds = assistantDetails.file_ids || [];

//   // Update the assistant with the new file ID
//   await openai.beta.assistants.update(assistantId, {
//     file_ids: [...existingFileIds, file.id],
//   });

//   // const assistantId = await createAssistant(); // fileId
//   // if (!assistantId) return;

//   // const fileId = await uploadSchemaFile();
//   // if (!fileId) return;

//   // await askQuestion(assistantId, "What are the columns in the users table?");
// }

// main();

