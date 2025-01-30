import OpenAI from "openai";

const openai = new OpenAI({
  apiKey:
    "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",
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
