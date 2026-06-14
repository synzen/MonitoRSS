const PADDLE_SANDBOX_URL = "https://sandbox-api.paddle.com";

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

  const body = await res.text();
  return (body ? JSON.parse(body) : undefined) as T;
}

interface PaddleSubscription {
  id: string;
  status: string;
  customer_id: string;
  custom_data?: { userId?: string };
}

interface PaddleListResponse<T> {
  data: T[];
  meta: { pagination?: { next?: string } };
}

function getNotificationSettingId(): string {
  const id = process.env.E2E_PADDLE_NOTIFICATION_SETTING_ID;
  if (!id) {
    throw new Error(
      "E2E_PADDLE_NOTIFICATION_SETTING_ID is not set. Either run Paddle tests " +
        "via e2e-mock.sh (it creates an ephemeral setting), or set it yourself " +
        "in e2e/.env alongside a matching BACKEND_API_PADDLE_WEBHOOK_SECRET.",
    );
  }
  return id;
}

export async function updateNotificationUrl(webhookUrl: string): Promise<void> {
  await paddleRequest(`/notification-settings/${getNotificationSettingId()}`, {
    method: "PATCH",
    body: JSON.stringify({
      destination: webhookUrl,
    }),
  });
  console.log("Paddle notification URL updated");
}

const E2E_SUBSCRIBED_EVENTS = [
  "subscription.created",
  "subscription.activated",
  "subscription.updated",
  "subscription.canceled",
];

export async function createNotificationSetting(): Promise<{
  id: string;
  secret: string;
}> {
  const result = await paddleRequest<{
    data: { id: string; endpoint_secret_key: string };
  }>("/notification-settings", {
    method: "POST",
    body: JSON.stringify({
      description: "MonitoRSS E2E (ephemeral)",
      type: "url",
      destination: "https://placeholder.invalid/paddle-webhook",
      subscribed_events: E2E_SUBSCRIBED_EVENTS,
    }),
  });

  return {
    id: result.data.id,
    secret: result.data.endpoint_secret_key,
  };
}

export async function deleteNotificationSetting(id: string): Promise<void> {
  await paddleRequest(`/notification-settings/${id}`, { method: "DELETE" });
}

export async function listActiveSubscriptions(): Promise<PaddleSubscription[]> {
  const result = await paddleRequest<PaddleListResponse<PaddleSubscription>>(
    "/subscriptions?status=active",
  );
  return result.data;
}

// The Paddle sandbox is one shared account, so scope cleanup to the test's own
// customer (looked up by its unique email) rather than every active subscription,
// otherwise a parallel test cancels another's subscription mid-run.
export async function findCustomerIdByEmail(
  email: string,
): Promise<string | undefined> {
  const result = await paddleRequest<PaddleListResponse<{ id: string }>>(
    `/customers?email=${encodeURIComponent(email)}`,
  );
  return result.data[0]?.id;
}

export async function cancelActiveSubscriptionsForEmail(
  email: string,
): Promise<string[]> {
  const customerId = await findCustomerIdByEmail(email);
  if (!customerId) {
    return [];
  }

  const result = await paddleRequest<PaddleListResponse<PaddleSubscription>>(
    `/subscriptions?status=active&customer_id=${customerId}`,
  );

  const cancelledIds: string[] = [];
  for (const sub of result.data) {
    try {
      await cancelSubscription(sub.id);
      cancelledIds.push(sub.id);
    } catch (err) {
      console.warn(`Failed to cancel subscription ${sub.id}:`, err);
    }
  }

  return cancelledIds;
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

interface PaddleSimulation {
  id: string;
  status: string;
}

interface PaddleSimulationRun {
  id: string;
  status: string;
}

export async function setNotificationTrafficSource(
  trafficSource: "platform" | "all",
): Promise<void> {
  await paddleRequest(`/notification-settings/${getNotificationSettingId()}`, {
    method: "PATCH",
    body: JSON.stringify({ traffic_source: trafficSource }),
  });
}

export async function createPaddleCustomer(email: string): Promise<string> {
  const result = await paddleRequest<{
    data: { id: string };
  }>("/customers", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  return result.data.id;
}

export async function simulateSubscriptionCreation({
  customerId,
  priceId,
}: {
  customerId: string;
  priceId: string;
}): Promise<void> {
  const simulation = await paddleRequest<{ data: PaddleSimulation }>(
    "/simulations",
    {
      method: "POST",
      body: JSON.stringify({
        notification_setting_id: getNotificationSettingId(),
        name: `e2e-sub-creation-${Date.now()}`,
        type: "subscription_creation",
        config: {
          subscription_creation: {
            entities: {
              customer_id: customerId,
              items: [{ price_id: priceId, quantity: 1 }],
            },
          },
        },
      }),
    },
  );

  const simulationId = simulation.data.id;
  console.log(`Created simulation: ${simulationId}`);

  await paddleRequest<{ data: PaddleSimulationRun }>(
    `/simulations/${simulationId}/runs`,
    { method: "POST" },
  );

  console.log(`Simulation run started for: ${simulationId}`);
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
