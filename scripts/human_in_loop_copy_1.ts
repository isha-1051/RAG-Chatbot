import {
  MemorySaver,
  Annotation,
  interrupt,
  Command,
  StateGraph,
} from "@langchain/langgraph";
import rl from "../app/utils/userInput/readLine";

async function main() {
  // Define the graph state
  const StateAnnotation = Annotation.Root({
    input: Annotation<string>,
    userFeedback: Annotation<string>,
  });

  const step1 = (state: typeof StateAnnotation.State) => {
    console.log("--------Step 1 --------");
    return {};
  };

  const hunamFeedback = (state: typeof StateAnnotation.State) => {
    console.log("--------  humanFeedback ----------------");
    const feedback: string = interrupt("Please provide feedback");
    return {
      userFeedback: feedback,
    };
  };

  const step3 = (state: typeof StateAnnotation.State) => {
    console.log("-----------Step 3 ----------", state);
    return {};
  };

  const workflow = new StateGraph(StateAnnotation)
    .addNode("step1", step1)
    .addNode("humanFeedback", hunamFeedback)
    .addNode("step3", step3)
    .addEdge("__start__", "step1")
    .addEdge("step1", "humanFeedback")
    .addEdge("humanFeedback", "step3")
    .addEdge("step3", "__end__");

  const memory = new MemorySaver();

  const graph = workflow.compile({
    checkpointer: memory,
  });

  // Input
  const initialInput = { input: "hello world" };

  // Thread
  const config = { configurable: { thread_id: "1" } };

  // Run the graph until the first interruption
  for await (const event of await graph.stream(initialInput, config)) {
    console.log(event);
  }

  // Will log when the graph is interrupted, after step 2.
  console.log("--- GRAPH INTERRUPTED ---");

  const userInput = await rl.question("What is your name?");
  console.log("Thank you for your feedback ====>", userInput);
  rl.close();

  // Continue the graph execution
  for await (const event of await graph.stream(
    new Command({ resume: userInput }),
    config
  )) {
    console.log(event);
    console.log("\n====\n");
  }
}

main();
