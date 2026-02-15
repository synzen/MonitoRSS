import { firefox } from "@playwright/test";
import { join } from "path";
import * as readline from "readline";

const AUTH_USER2_PATH = join(process.cwd(), "e2e", "auth-user2.json");
const BASE_URL = "http://localhost:3000";

function prompt(question: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, () => {
      rl.close();
      resolve();
    });
  });
}

async function authUser2() {
  console.log("\n========================================");
  console.log("IMPORTANT: Close Discord desktop app first!");
  console.log("Otherwise it will intercept the OAuth flow.");
  console.log("========================================\n");

  await prompt("Press ENTER after closing Discord desktop app...");

  console.log("\nLaunching Firefox...\n");

  const browser = await firefox.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(BASE_URL);

  console.log("========================================");
  console.log("Instructions:");
  console.log("1. Log in with your SECOND Discord account");
  console.log("2. Once logged in, close the browser window");
  console.log("========================================\n");

  // Wait for the browser to be closed by the user
  await new Promise<void>((resolve) => {
    context.on("close", () => resolve());
  });

  // Save storage state before closing
  await context.storageState({ path: AUTH_USER2_PATH });

  console.log(`\nAuth saved to: ${AUTH_USER2_PATH}`);
  await browser.close();
}

authUser2().catch(console.error);
