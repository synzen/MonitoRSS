import { Client } from "pg";
import { E2E_POSTGRES_URI } from "./constants";

// The retry backoff derives all of its state from request_partitioned rows
// (ADR-011), so shifting a URL's row timestamps forward-fakes weeks of failure
// without touching any service. `days` may be fractional.
async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client(E2E_POSTGRES_URI);
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.end();
  }
}

// request_partitioned is partitioned by month and only the current month
// onward exists at boot, so moving rows into the past needs their target
// month's partition to exist first. A shift can straddle one month boundary
// at most, so both candidate months are ensured.
async function ensurePartitionsAround(client: Client, date: Date): Promise<void> {
  for (const offset of [0, -36 * 3600 * 1000]) {
    const candidate = new Date(date.getTime() + offset);
    const from = Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), 1);
    const to = Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, 1);
    const table = `request_partitioned_y${candidate.getUTCFullYear()}m${candidate.getUTCMonth() + 1}`;

    await client.query(
      `CREATE TABLE IF NOT EXISTS ${table}` +
        ` PARTITION OF request_partitioned` +
        ` FOR VALUES FROM ('${new Date(from).toISOString()}') TO ('${new Date(to).toISOString()}')`,
    );
  }
}

export async function backdateRequestsForLookupKey(params: {
  lookupKey: string;
  days: number;
  // Only shift rows of this status (e.g. 'OK') when given; otherwise all rows
  // for the key shift, which would also move the latest attempt the backoff
  // schedules from.
  status?: "OK";
}): Promise<void> {
  await withClient(async (client) => {
    const shifted = new Date(Date.now() - params.days * 24 * 3600 * 1000);
    await ensurePartitionsAround(client, shifted);

    await client.query(
      `UPDATE request_partitioned` +
        ` SET created_at = created_at - ($1 || ' days')::interval` +
        ` WHERE lookup_key = $2` +
        (params.status ? ` AND status = $3` : ""),
      params.status
        ? [String(params.days), params.lookupKey, params.status]
        : [String(params.days), params.lookupKey],
    );
  });
}

export async function countRequestsForLookupKey(lookupKey: string): Promise<number> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT COUNT(*)::int AS count FROM request_partitioned WHERE lookup_key = $1`,
      [lookupKey],
    );
    return result.rows[0].count as number;
  });
}
