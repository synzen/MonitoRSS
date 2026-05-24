# @monitorss/contracts

Single source of truth for RabbitMQ event names and payload schemas across all MonitoRSS services.

See [`docs/adr/007-packages-contracts.md`](../../docs/adr/007-packages-contracts.md) for the reasoning and conventions.

## Usage

**Producer:**

```ts
import { MessageBrokerQueue, FeedDeliverArticlesSchema } from "@monitorss/contracts";

const payload = FeedDeliverArticlesSchema.parse(builtPayload); // fail fast on producer-side misshape
await publishMessage(MessageBrokerQueue.FeedDeliverArticles, payload);
```

**Consumer:**

```ts
import { MessageBrokerQueue, FeedDeliverArticlesSchema } from "@monitorss/contracts";

connection.createConsumer(
  { queue: MessageBrokerQueue.FeedDeliverArticles },
  async (msg) => {
    const result = FeedDeliverArticlesSchema.safeParse(JSON.parse(msg.body));
    if (!result.success) {
      logger.error("Contract violation", { errors: result.error });
      return; // or DLQ
    }
    await handle(result.data); // result.data is typed
  }
);
```

## Conventions

- **One file per event** under `src/events/`.
- **Strict outer structure, freeform inner where unavoidable.** Top-level event keys are pinned; deeply nested Discord-specific shapes (embeds, components) use `z.record(z.unknown())` until they're worth tightening.
- **TODO comments** mark schemas that are currently permissive because the current consumer-side parsing is loose (`as any`). Tighten those when you touch the producer or consumer.
- **Never declare a queue name as a string literal** in a service. Import the enum from here.

## Why Zod and not just TS types

Runtime validation is the point. TS types catch errors at compile time only on the side that imports the type — they do not help a consumer who receives a JSON message that drifted from the producer's shape. Zod's `safeParse` does.

See ADR-007 for the discussion of why Zod is exported directly rather than wrapped.
