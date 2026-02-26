const PADDLE_SANDBOX_URL = "https://sandbox-api.paddle.com";
const PADDLE_NOTIFICATION_SETTING_ID = "ntfset_01hbxt19pg3xeqjn4adhh8am17";

function getPaddleKey(): string {
  const key = process.env.BACKEND_API_PADDLE_KEY;
  if (!key)
    throw new Error(
      "BACKEND_API_PADDLE_KEY env var is required for Paddle E2E tests",
    );
  return key;
}

async function paddleRequest<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${PADDLE_SANDBOX_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${getPaddleKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unable to read response");
    throw new Error(`Paddle API ${endpoint} failed (${res.status}): ${text}`);
  }

  return (await res.json()) as T;
}

interface PaddleSubscription {
  id: string;
  status: string;
  custom_data?: { userId?: string };
}

interface PaddleListResponse<T> {
  data: T[];
  meta: { pagination?: { next?: string } };
}

export async function updateNotificationUrl(webhookUrl: string): Promise<void> {
  await paddleRequest(
    `/notification-settings/${PADDLE_NOTIFICATION_SETTING_ID}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        destination: webhookUrl,
      }),
    },
  );
  console.log(`Paddle notification URL updated to: ${webhookUrl}`);
}

export async function listActiveSubscriptions(): Promise<PaddleSubscription[]> {
  const result = await paddleRequest<PaddleListResponse<PaddleSubscription>>(
    "/subscriptions?status=active",
  );
  return result.data;
}

export async function cancelSubscription(
  subscriptionId: string,
): Promise<void> {
  await paddleRequest(`/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({
      effective_from: "immediately",
    }),
  });
  console.log(`Cancelled subscription: ${subscriptionId}`);
}

export async function cancelAllActiveSubscriptions(): Promise<string[]> {
  const subscriptions = await listActiveSubscriptions();
  const cancelledIds: string[] = [];

  for (const sub of subscriptions) {
    try {
      await cancelSubscription(sub.id);
      cancelledIds.push(sub.id);
    } catch (err) {
      console.warn(`Failed to cancel subscription ${sub.id}:`, err);
    }
  }

  return cancelledIds;
}
