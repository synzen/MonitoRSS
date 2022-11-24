import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";
import { FeedEventHandlerService } from "./feed-event-handler/feed-event-handler.service";
import { BrokerAsPromised } from "rascal";

export async function setupFeedListener() {
  const app = await NestFactory.createApplicationContext(AppModule.forRoot());
  const config = app.get(ConfigService);

  const broker = await BrokerAsPromised.create({
    vhosts: {
      "/": {
        connection: {
          url: config.getOrThrow("FEED_HANDLER_RABBITMQ_BROKER_URL"),
        },
        queues: {
          "feed.deliver-articles": {
            assert: true,
            check: true,
            name: "feed.deliver-articles",
          },
        },
        subscriptions: {
          onDeliverFeedArticles: {
            queue: "feed.deliver-articles",
            vhost: "/",
          },
        },
      },
    },
  });

  const subscription = await broker.subscribe("onDeliverFeedArticles");

  subscription
    .on("message", async (message, content, ackOrNack) => {
      try {
        const feedEventHandler = app.get(FeedEventHandlerService);
        await feedEventHandler.handleV2Event(
          JSON.parse(message.content.toString())
        );
        ackOrNack();
      } catch (err) {
        console.error(`Failed to handle message`, {
          error: (err as Error).stack,
        });
        ackOrNack(err as Error);
      }
    })
    .on("error", (err) => {
      console.error(`Subscription encountered error`, {
        error: (err as Error).stack,
      });
    });

  broker.on("error", (err) => {
    console.error(`Broker encountered error`, {
      error: (err as Error).stack,
    });
  });

  console.log("Feed handler service initialized");
}
