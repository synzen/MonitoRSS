import {
  createNotificationSetting,
  deleteNotificationSetting,
} from "../helpers/paddle-api";

async function main() {
  const command = process.argv[2];

  if (command === "create") {
    const { id, secret } = await createNotificationSetting();
    process.stdout.write(`${id}\n${secret}\n`);
    return;
  }

  if (command === "delete") {
    const id = process.argv[3];
    if (!id) {
      throw new Error("Usage: paddle-notification-setting.ts delete <id>");
    }
    await deleteNotificationSetting(id);
    return;
  }

  throw new Error(`Unknown command: ${command ?? "(none)"}`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
