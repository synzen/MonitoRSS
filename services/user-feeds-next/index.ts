import { config } from "dotenv";
import { Connection } from "rabbitmq-client";
import {
  parseFeedV2Event,
  handleFeedV2Event,
  handleArticleDeliveryResult,
  parseFeedDeletedEvent,
  handleFeedDeletedEvent,
} from "./src/feed-event-handler";
import { MessageBrokerQueue } from "./src/constants";
import {
  initializeDiscordProducer,
  initializeDiscordApiClient,
  closeDiscordProducer,
  closeDiscordApiClient,
  type DiscordDeliveryResult,
} from "./src/delivery";

// Load environment variables
config();

const RABBITMQ_URL =
  process.env.USER_FEEDS_NEXT_RABBITMQ_URL ||
  "amqp://guest:guest@rabbitmq-broker:5672";
const DISCORD_CLIENT_ID = process.env.USER_FEEDS_NEXT_DISCORD_CLIENT_ID || "";
const DISCORD_BOT_TOKEN = process.env.USER_FEEDS_NEXT_DISCORD_BOT_TOKEN || "";
const PREFETCH_COUNT = 100;

async function main() {
  // Validate required environment variables
  if (!DISCORD_CLIENT_ID) {
    throw new Error("USER_FEEDS_NEXT_DISCORD_CLIENT_ID is required");
  }
  if (!DISCORD_BOT_TOKEN) {
    throw new Error("USER_FEEDS_NEXT_DISCORD_BOT_TOKEN is required");
  }

  // Initialize Discord REST producer (for async message enqueue)
  await initializeDiscordProducer({
    rabbitmqUri: RABBITMQ_URL,
    clientId: DISCORD_CLIENT_ID,
  });

  // Initialize Discord API client (for synchronous calls like forum thread creation)
  initializeDiscordApiClient(DISCORD_BOT_TOKEN);

  console.log("Connecting to RabbitMQ...");

  // Create RabbitMQ connection
  const connection = new Connection(RABBITMQ_URL);

  // Set up event handlers
  connection.on("error", (err) => {
    console.error("RabbitMQ connection error:", err);
  });

  console.log("RabbitMQ connection initiated");

  // Create a publisher function for sending messages to queues
  const publisher = async (queue: string, message: unknown): Promise<void> => {
    const pub = connection.createPublisher({
      confirm: true,
      maxAttempts: 3,
    });
    await pub.send(queue, message);
    await pub.close();
  };

  // Create feed event consumer
  const feedEventConsumer = connection.createConsumer(
    {
      queue: MessageBrokerQueue.FeedDeliverArticles,
      queueOptions: { durable: true },
      qos: { prefetchCount: PREFETCH_COUNT },
    },
    async (msg) => {
      const event = parseFeedV2Event(msg.body);

      if (!event) {
        console.error("Failed to parse message, skipping");
        return;
      }

      await handleFeedV2Event(event);
    }
  );

  feedEventConsumer.on("error", (err) => {
    console.error("Feed event consumer error:", err);
  });

  console.log(
    `Feed event consumer created with prefetch count: ${PREFETCH_COUNT}`
  );

  // Create delivery result consumer
  const deliveryResultConsumer = connection.createConsumer(
    {
      queue: MessageBrokerQueue.FeedArticleDeliveryResult,
      queueOptions: { durable: true },
      qos: { prefetchCount: PREFETCH_COUNT },
    },
    async (msg) => {
      const deliveryResult = msg.body as DiscordDeliveryResult;

      if (!deliveryResult?.job || !deliveryResult?.result) {
        console.error("Invalid delivery result message, skipping", {
          hasJob: !!deliveryResult?.job,
          hasResult: !!deliveryResult?.result,
        });
        return;
      }

      try {
        await handleArticleDeliveryResult(deliveryResult, publisher);
      } catch (err) {
        console.error("Failed to handle delivery result", {
          error: (err as Error).stack,
        });
      }
    }
  );

  deliveryResultConsumer.on("error", (err) => {
    console.error("Delivery result consumer error:", err);
  });

  console.log(
    `Delivery result consumer created with prefetch count: ${PREFETCH_COUNT}`
  );

  // Create feed deleted consumer
  const feedDeletedConsumer = connection.createConsumer(
    {
      queue: MessageBrokerQueue.FeedDeleted,
      queueOptions: { durable: true },
      qos: { prefetchCount: PREFETCH_COUNT },
    },
    async (msg) => {
      const event = parseFeedDeletedEvent(msg.body);

      if (!event) {
        console.error("Failed to parse feed deleted message, skipping");
        return;
      }

      try {
        await handleFeedDeletedEvent(event);
      } catch (err) {
        console.error("Failed to handle feed deleted event", {
          error: (err as Error).stack,
        });
      }
    }
  );

  feedDeletedConsumer.on("error", (err) => {
    console.error("Feed deleted consumer error:", err);
  });

  console.log(
    `Feed deleted consumer created with prefetch count: ${PREFETCH_COUNT}`
  );

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("Received SIGINT, closing connections...");
    await feedEventConsumer.close();
    await deliveryResultConsumer.close();
    await feedDeletedConsumer.close();
    await connection.close();
    await closeDiscordProducer();
    closeDiscordApiClient();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("Received SIGTERM, closing connections...");
    await feedEventConsumer.close();
    await deliveryResultConsumer.close();
    await feedDeletedConsumer.close();
    await connection.close();
    await closeDiscordProducer();
    closeDiscordApiClient();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
