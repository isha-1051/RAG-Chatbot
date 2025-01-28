import mysql from "mysql2/promise";
import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { DataAPIClient } from "@datastax/astra-db-ts";
const dbConfig = process.env;

const openai = new OpenAI({
  apiKey: dbConfig.OPEN_AI_KEY,
});

export async function GET(req: Request) {
  const pool = mysql.createPool({
    host: dbConfig.DB_HOST, // Replace with your host
    user: dbConfig.DB_USER, // Replace with your username
    password: dbConfig.DB_PASS, // Replace with your password
    database: dbConfig.DB_NAME, // Replace with your database name
  });

  // const data = await pool.query("SELECT * FROM sql_prompt.employees");
  // console.log("Query results:", data[0]);
  // const template = {
  //   role: "assistant",
  //   content: `Your are a helpful, cheerful database assistant. 
  //           Use the following database schema when creating your answers:

  //           YOUR_DATABASE_SCHEMA

  //           Include column name headers in the query results.

  //           Always provide your answer in the JSON format below:
            
  //           { ""summary"": ""your-summary"", ""query"":  ""your-query"" }
            
  //           Output ONLY JSON.
  //           In the preceding JSON response, substitute ""your-query"" with Microsoft SQL Server Query to retrieve the requested data.
  //           In the preceding JSON response, substitute ""your-summary"" with a summary of the query.
  //           Always include all columns in the table.
  //           If the resulting query is non-executable, replace ""your-query"" with NA, but still substitute ""your-query"" with a summary of the query.
  //           Do not use MySQL syntax.
  //           Always limit the SQL Query to 100 rows."; `,
  // };

  // const messages = [
  //   {
  //     role: "user",
  //     content: "Give me count of customer do you have.",
  //   },
  // ];

  // Set up the AI chat query/completion
  // ChatCompletionsOptions chatCompletionsOptions = new ChatCompletionsOptions()
  // {
  //     Messages = {
  //         new ChatRequestSystemMessage(systemMessage),
  //         new ChatRequestUserMessage(userPrompt)
  //     },
  //     DeploymentName = openAIDeploymentName
  // };

  const datage = await openai.chat.completions.create({
    model: "gpt-4",
    // stream: true,
    messages: [
      {
        role: "assistant",
        content: `Your are a helpful, cheerful database assistant. 
                Use the following database schema when creating your answers:
    
                YOUR_DATABASE_SCHEMA
    
                Include column name headers in the query results.
    
                Always provide your answer in the JSON format below:
                
                { ""summary"": ""your-summary"", ""query"":  ""your-query"" }
                
                Output ONLY JSON.
                In the preceding JSON response, substitute ""your-query"" with Microsoft SQL Server Query to retrieve the requested data.
                In the preceding JSON response, substitute ""your-summary"" with a summary of the query.
                Always include all columns in the table.
                If the resulting query is non-executable, replace ""your-query"" with NA, but still substitute ""your-query"" with a summary of the query.
                Do not use MySQL syntax.
                Always limit the SQL Query to 100 rows."; `,
      },
      {
        role: "user",
        content: "Give me all selse manager name",
      },
    ],
  });

  console.log("Strem ===>", datage.choices[0].message);

  try {
    return Response.json({ message: "Hello from the SQL API" });
  } catch (err) {
    console.log("Error from api call =====>", err);
    throw err;
  }
}
