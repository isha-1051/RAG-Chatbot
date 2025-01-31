import mysql from "mysql2/promise";
import OpenAI from "openai";
// import { OpenAIStream, StreamingTextResponse } from "ai";
// import { DataAPIClient } from "@datastax/astra-db-ts";
const dbConfig = process.env;

const openai = new OpenAI({
  apiKey: dbConfig.OPEN_AI_KEY,
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userQuestion = url.searchParams.get("question");
  // console.log("url =>", userQuestion);

  if (!userQuestion) {
    return new Response(
      JSON.stringify({ error: "Question parameter is missing" }),
      { status: 400 }
    );
  }

  const pool = mysql.createPool({
    host: dbConfig.DB_HOST,
    user: dbConfig.DB_USER,
    password: dbConfig.DB_PASS,
    database: dbConfig.DB_NAME,
  });

  // const question = "give customer names whose orders are in process with highest credit limit";
  // const question = "give me employee name to whom ankur reports";
  // const question = "how many employees are serving as sales rep";
  // const question = "give me a cancelled order";
  // const question = "give total amount received in 2004";

  const queryData = await openai.chat.completions.create({
    model: "gpt-4",
    // stream: true,
    messages: [
      {
        role: "assistant",
        content: `Your are a helpful, cheerful database assistant. 
                You only need to give answer which related to our database. For other question you politely denide.
                If user is asking about any perticular person then you can check schema .
                If you required a multiple query then you can generate.
                Use the following database schema when creating your answers:
    
                - customers (customerNumber, customerName, contactLastName, contactFirstName, phone, addressLine1, addressLine2, city, state, postalCode, country, salesRepEmployeeNumber, creditLimit)
                - employees (employeeNumber, lastName, firstName, extension, email, officeCode, reportsTo, jobTitle)
                - offices (officeCode, city, phone, addressLine1, addressLine2, state, country, postalCode, territory)
                - orderdetails (orderNumber, productCode, quantityOrdered, priceEach, orderLineNumber)
                - orders (orderNumber, orderDate, requiredDate, shippedDate, status, comments, customerNumber)
                - payments (customerNumber, checkNumber, paymentDate, amount)
                - productlines (productLine, textDescription, htmlDescription, image)
                - products (productCode, productName, productLine, productScale, productVendor, productDescription, quantityInStock, buyPrice, MSRP)
    
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

                Example 1. 
                role : "user",
                content: "Hello"
                role : "assistant"
                content: {"summary" : "Hi, How can I assist you?", "query" : "NA"}

                Example 2. 
                role : "user",
                content: "Give me total number of employee"
                role : "assistant"
                content: {"summary" : "Here is the count of all employee in database", "query" : "SELECT COUNT(*) from Employee LIMIT 50"}  

                Example 3.
                role : "user",
                content: "Who is murphy?"
                role : "assistant"
                content: {"summary" : "Here is the count of all employee in database", "query" : "SELECT COUNT(*) from Employee LIMIT 50"}  

                If the user needs any information related to the orders schema or payments, replace ""your-query"" with NA.
            `,
      },
      {
        role: "user",
        content: userQuestion,
      },
    ],
  });
  console.log("Strem ===>", queryData.choices[0].message);

  const response = JSON.parse(queryData.choices[0].message.content);
  const query = response.query;

  // Execure query
  let sql;
  try {
    sql = await pool.getConnection();
    let rows = [];
    if (response.query !== "NA") {
      const data = await Promise.all(
        query.split(";").map((q: string) => {
          return sql.query(q);
        })
      );
      data.map((dt) => {
        rows.push(dt[0]);
      });
      console.log("rows ===>", data);
    } else {
      rows = [];
      return Response.json({
        message: response.summary || "Hello from the SQL API",
      });
    }

    const allowedNames = ["Nimesh", "Ankur", "Isha"];
    const roleBasedAccess = `
      Before answering the question, ensure that the user provides their name.
          Verify that the provided name is one of the following: ${allowedNames.join(
            ",  And make sure that you any how not expose the name of Allowed users."
          )}.
      If the user does not provide their name or the name is not in the allowed list, respond with:
      "I'm sorry, I can only assist users who provide a valid name. Please provide your name first and followed by your question."
    `;

    const stream = await openai.chat.completions.create({
      model: "gpt-4",
      // stream: true,
      messages: [
        {
          role: "assistant",
          content: `
        Here is my data : ${JSON.stringify(rows[0])},
        Question: ${userQuestion}

        Format the data provided into human readable format for the question provided. Keep it simple and understandable.

        If you get empty data then respond with exect this message : No valid information found.
        `,
        },
      ],
    });
    console.log("response to user ===>", stream.choices[0].message);
    return Response.json({
      message: stream.choices[0].message?.content || "Hello from the SQL API",
    });
  } catch (error) {
    console.error("Error executing query:", error);
    throw error;
  } finally {
    if (sql) sql.release();
  }
}
