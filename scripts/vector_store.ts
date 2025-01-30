import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function main() {
  // create
  //   const vectorStore = await openai.beta.vectorStores.create({
  //     name: "Database stucture",
  //   });
  //   console.log("Created vector ===>",vectorStore);

  // list
  //   const vectorStores = await openai.beta.vectorStores.list();
  //   console.log(vectorStores);

  // retrive single

  const vectorStore = await openai.beta.vectorStores.retrieve(
    "vs_HQQWAGeYBnFPZV73qQk7m3gF"
  );
  console.log("Retrived vector store ====>", vectorStore);
}

main();
