import { config } from "dotenv";
import { Connection } from "rabbitmq-client";

// Load environment variables
config();

const RABBITMQ_URL =
  process.env.USER_FEEDS_NEXT_RABBITMQ_URL ||
  "amqp://guest:guest@rabbitmq-broker:5672";
const PREFETCH_COUNT = 100;

async function main() {
  console.log("Connecting to RabbitMQ...");

  // Create RabbitMQ connection
  const connection = new Connection(RABBITMQ_URL);

  // Set up event handlers
  connection.on("error", (err) => {
    console.error("RabbitMQ connection error:", err);
  });

  console.log("RabbitMQ connection initiated");

  // Create a consumer with prefetch count
  const consumer = connection.createConsumer(
    {
      queue: "feed.deliver-articles",
      queueOptions: { durable: true },
      qos: { prefetchCount: PREFETCH_COUNT },
    },
    async (msg) => {
      console.log("Received message:", msg.body);
      // TODO: Process the message
    }
  );

  consumer.on("error", (err) => {
    console.error("Consumer error:", err);
  });

  console.log(`Consumer created with prefetch count: ${PREFETCH_COUNT}`);

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("Received SIGINT, closing RabbitMQ connection...");
    await consumer.close();
    await connection.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("Received SIGTERM, closing RabbitMQ connection...");
    await consumer.close();
    await connection.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
