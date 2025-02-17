// import * as readline from "readline/promises"

// const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout
//   });

import * as readline from "node:readline/promises"; // This uses the promise-based APIs
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });

export default rl;
