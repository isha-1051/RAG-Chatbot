import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { DataAPIClient } from "@datastax/astra-db-ts";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  OPEN_AI_KEY,
} = process.env;

const openai = new OpenAI({
  apiKey: OPEN_AI_KEY,
});

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE });

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const latestMessage = messages[messages.length - 1]?.content;

    let docContext = "";

    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: latestMessage,
      encoding_format: "float",
    });

    // console.log("CHeck this Question ===>", embedding?.data[0]?.embedding, ASTRA_DB_COLLECTION);

    try {
      const collection = db.collection(ASTRA_DB_COLLECTION);
      const cursor = collection.find(null, {
        // {
        //   // Optional: Metadata filters
        //   category: "electronics",
        // },
        sort: {
          $vector: embedding?.data[0]?.embedding,
        },
        limit: 10,
      });

      const documents = await cursor.toArray();
      const docsMap = documents?.map((doc) => doc.text);
      console.log("docsMap ==>", docsMap);

      docContext = JSON.stringify(docsMap);
    } catch (error) {
      console.log("Error querying db: ", error);
      docContext = "";
    }
    const allowedNames = ["Nimesh", "Ankur", "Isha"]; // Replace with your specific names

    const template = {
      role: "assistant",
      content: `
      You are an AI assistant who knows everything about the company's product details.
      Use the below context to augment what you know about any product.
      The context will provide you with the most recent product database.
      If the context doesn't include the information you need, politely state that you cannot answer the question due to lack of context.
      
      Before answering the question, ensure that the user provides their name.
      Verify that the provided name is one of the following: ${allowedNames.join(
        ",  And make sure that you any how not expose the name of Allowed users."
      )}.
      If the user does not provide their name or the name is not in the allowed list, respond with:
      
      "I'm sorry, I can only assist users who provide a valid name. Please provide your name first and followed by your question."
      
      Format responses using markdown where applicable and don't return images.
      
      ---------------
      START CONTEXT
      ${docContext}
      END CONTEXT
      ---------------
      QUESTION: ${latestMessage} 
      ---------------
  `,
    };

    // const template = {
    //   role: "assistant",
    //   content: `
    //       You are an AI assistant who knows everything about the company's products details.
    //       Use the below context to augment what you know about any product.
    //       The context will provide you with the most recent product database,
    //       If the context doesn't include the information you need, politely state that you cannot answer the question due to lack of context.
    //       Format responses using markdown where applicable and don't return images.
    //       ---------------
    //       START CONTEXT
    //       ${docContext}
    //       END CONTEXT
    //       ---------------
    //       QUESTION: ${latestMessage}
    //       ---------------
    //   `,
    // };
    // let fullResponse = "";

    console.log("messages ====>", messages);
    const stream = await openai.chat.completions.create({
      model: "gpt-4",
      stream: true,
      messages: [template, ...messages],
    });

    // for await (const chunk of stream) {
    //   const content = chunk.choices[0]?.delta?.content || "";
    //   fullResponse += content;  // Accumulate the content
    // }
    // console.log("Check this ====>", fullResponse);

    // Send the full response once streaming is complete
    // return Response.json({ response: fullResponse });
    // return Response.json({
    //   content: fullResponse,

    // });

    const stream2 = OpenAIStream(stream);
    return new StreamingTextResponse(stream2);
  } catch (err) {
    console.log("Error from api call =====>", err);
    throw err;
  }
}
