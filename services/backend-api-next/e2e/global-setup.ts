import { existsSync, readFileSync } from "fs";
import { AUTH_STATE_PATH } from "./helpers/constants";

const BASE_URL = "http://localhost:3000";

async function globalSetup() {
  if (!existsSync(AUTH_STATE_PATH)) {
    console.error("\n========================================");
    console.error("ERROR: auth.json not found!");
    console.error("========================================\n");
    console.error("To run E2E tests, you must first authenticate:");
    console.error("  1. Ensure the Docker stack is running:");
    console.error(
      "     docker compose -f docker-compose.dev.yml --profile next up",
    );
    console.error("  2. Run: npm run e2e:auth");
    console.error("  3. Log in via Discord in the browser that opens");
    console.error("  4. Close the browser when done\n");
    process.exit(1);
  }

  const authStatusUrl = `${BASE_URL}/api/v1/discord-users/@me/auth-status`;

  try {
    const authData = JSON.parse(readFileSync(AUTH_STATE_PATH, "utf-8"));
    const cookies = authData.cookies || [];

    const cookieHeader = cookies
      .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
      .join("; ");

    const response = await fetch(authStatusUrl, {
      headers: {
        Cookie: cookieHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`Auth status check failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.authenticated) {
      console.error("\n========================================");
      console.error("ERROR: Session expired!");
      console.error("========================================\n");
      console.error("Your auth.json session has expired. To refresh:");
      console.error("  1. Run: npm run e2e:auth");
      console.error("  2. Log in via Discord in the browser that opens");
      console.error("  3. Close the browser when done\n");
      process.exit(1);
    }

    console.log("Session valid, proceeding with tests...");
  } catch (error) {
    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      console.error("\n========================================");
      console.error("ERROR: Cannot connect to server!");
      console.error("========================================\n");
      console.error("Ensure the Docker stack is running:");
      console.error(
        "  docker compose -f docker-compose.dev.yml --profile next up\n",
      );
      process.exit(1);
    }
    throw error;
  }
}

export default globalSetup;
