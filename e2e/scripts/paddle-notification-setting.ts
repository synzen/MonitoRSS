import {
  createNotificationSetting,
  deleteNotificationSetting,
  deleteStaleEphemeralNotificationSettings,
} from "../helpers/paddle-api";

async function main() {
  const command = process.argv[2];

  if (command === "create") {
    // Best-effort: reclaiming settings leaked by killed runs must not block this
    // run, but skipping it when the cap is already reached would.
    await deleteStaleEphemeralNotificationSettings().catch((err) => {
      console.warn("Stale notification-setting cleanup failed:", err);
    });
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
