import { createWriteStream, mkdirSync } from "fs";
import { join } from "path";

// Mock servers run on the HOST (launched by Playwright's webServer), so their console
// output is otherwise lost. Tee it to logs/<name><suffix>.log — done in TS rather than a
// shell `| tee` so it works regardless of the OS shell Playwright spawns (cmd.exe on
// Windows has no tee). e2e-mock.sh folds these files into logs/combined.log on teardown.
export function teeConsoleToFile(name: string): void {
  const suffix =
    !process.env.E2E_INSTANCE || process.env.E2E_INSTANCE === "0"
      ? ""
      : `-${process.env.E2E_INSTANCE}`;
  const logDir = join(__dirname, "..", "logs");
  mkdirSync(logDir, { recursive: true });
  const stream = createWriteStream(join(logDir, `${name}${suffix}.log`), {
    flags: "w",
  });

  for (const level of ["log", "error", "warn", "info"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      stream.write(`${args.map(String).join(" ")}\n`);
    };
  }
}
