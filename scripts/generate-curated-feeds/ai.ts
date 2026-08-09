import { execFileSync } from "child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";

type AiProvider = "claude" | "codex";

interface AiCallOptions {
  allowWebSearch?: boolean;
  maxRetries?: number;
}

interface ClaudeResponse {
  structured_output?: unknown;
  result?: string;
}

interface AiRunResult {
  output?: unknown;
  diagnostic: string;
}

function getAiProvider(): AiProvider {
  const provider = (
    process.env.CURATED_FEEDS_AI_PROVIDER || "codex"
  ).toLowerCase();

  if (provider !== "claude" && provider !== "codex") {
    throw new Error(
      `Unsupported CURATED_FEEDS_AI_PROVIDER: ${provider}. Expected claude or codex.`,
    );
  }

  return provider;
}

function makeStrictJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(makeStrictJsonSchema);
  if (!value || typeof value !== "object") return value;

  const schema = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      makeStrictJsonSchema(child),
    ]),
  );

  if (schema.type === "object" && schema.additionalProperties === undefined) {
    schema.additionalProperties = false;
  }

  return schema;
}

function runClaude(
  prompt: string,
  schema: Record<string, unknown>,
  allowWebSearch: boolean,
): AiRunResult {
  const env = { ...process.env };
  delete env.CLAUDECODE;

  const raw = execFileSync(
    "claude",
    [
      "-p",
      prompt,
      "--output-format",
      "json",
      "--json-schema",
      JSON.stringify(schema),
      "--no-session-persistence",
      "--max-turns",
      "3",
      "--tools",
      allowWebSearch ? "web_search" : "",
    ],
    {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      env,
    },
  );
  const parsed = JSON.parse(raw) as ClaudeResponse;

  if (parsed.structured_output !== undefined) {
    return { output: parsed.structured_output, diagnostic: "structured output" };
  }

  if (parsed.result) {
    try {
      return { output: JSON.parse(parsed.result), diagnostic: "result" };
    } catch {
      return { diagnostic: "result was not valid JSON" };
    }
  }

  return {
    diagnostic: `response keys: ${Object.keys(parsed).join(", ")}`,
  };
}

function runCodex(
  prompt: string,
  schema: Record<string, unknown>,
  allowWebSearch: boolean,
): AiRunResult {
  const tempDirectory = mkdtempSync(
    join(tmpdir(), "monitorss-curated-feeds-"),
  );
  const schemaPath = join(tempDirectory, "schema.json");
  const outputPath = join(tempDirectory, "output.json");

  try {
    writeFileSync(
      schemaPath,
      JSON.stringify(makeStrictJsonSchema(schema)),
      "utf-8",
    );

    const args = [
      "exec",
      "--ephemeral",
      "--cd",
      tempDirectory,
      "--skip-git-repo-check",
      "--sandbox",
      "read-only",
      "--output-schema",
      schemaPath,
      "--output-last-message",
      outputPath,
    ];

    if (allowWebSearch) {
      args.push("-c", 'web_search="live"');
    }

    args.push("-");

    execFileSync(process.platform === "win32" ? "codex.cmd" : "codex", args, {
      encoding: "utf-8",
      input: prompt,
      maxBuffer: 10 * 1024 * 1024,
      shell: process.platform === "win32",
    });

    const raw = readFileSync(outputPath, "utf-8");
    try {
      return { output: JSON.parse(raw), diagnostic: "final message" };
    } catch {
      return { diagnostic: "final message was not valid JSON" };
    }
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

export function callAi(
  prompt: string,
  schema: Record<string, unknown>,
  options: AiCallOptions = {},
): unknown {
  const provider = getAiProvider();
  const providerLabel = provider === "codex" ? "Codex" : "Claude";
  const maxRetries = options.maxRetries ?? 0;
  let diagnostic = "no response";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result =
      provider === "codex"
        ? runCodex(prompt, schema, options.allowWebSearch ?? false)
        : runClaude(prompt, schema, options.allowWebSearch ?? false);
    diagnostic = result.diagnostic;

    if (result.output !== undefined) return result.output;

    if (attempt < maxRetries) {
      console.log(
        `  Retry ${attempt + 1}/${maxRetries} — no structured output from ${providerLabel} (${diagnostic})`,
      );
    }
  }

  throw new Error(
    `No structured output from ${providerLabel} after ${maxRetries + 1} attempts (${diagnostic})`,
  );
}
