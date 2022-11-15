import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";
import { Consumer } from "sqs-consumer";
import { SQS } from "aws-sdk";
import https from "https";
import { FeedEventHandlerService } from "./feed-event-handler/feed-event-handler.service";

let consumer: Consumer | undefined;

export async function setupFeedListener() {
  const app = await NestFactory.createApplicationContext(AppModule.forRoot());
  const config = app.get(ConfigService);

  const queueUrl = config.getOrThrow<string>(
    "FEED_HANDLER_FEED_EVENT_QUEUE_URL"
  );

  consumer = Consumer.create({
    queueUrl,
    handleMessage: async (message) => {
      if (!message.Body) {
        console.log(`Empty message body received, skipping`, {
          message,
        });

        return;
      }

      const feedEventHandlerService = app.get(FeedEventHandlerService);
      await feedEventHandlerService.handleV2Event(JSON.parse(message.Body));
    },
    sqs: queueUrl.startsWith("https")
      ? new SQS({
          httpOptions: {
            agent: new https.Agent({
              keepAlive: true,
            }),
          },
        })
      : undefined,
    batchSize: 10,
    region: config.getOrThrow("FEED_HANDLER_AWS_REGION"),
  });

  consumer.on("error", (error, message) => {
    console.log("Cosnsumer encountered error", { error, message });
  });

  consumer.on("processing_error", (error, message) => {
    console.log("Cosnsumer encountered processing error", { error, message });
  });

  consumer.on("timeout_error", (error, message) => {
    console.log("Consumer encountered timeout error", { error, message });
  });

  consumer.on("stopped", () => {
    console.log("Consumer stopped");
  });

  consumer.start();
  console.log("Feed handler service initialized");
}

process.on("SIGTERM", () => {
  console.log("SIGTERM received, stopping feed event consumer");
  consumer?.stop();
});
