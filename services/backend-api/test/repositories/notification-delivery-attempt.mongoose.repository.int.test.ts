import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { NotificationDeliveryAttemptMongooseRepository } from "../../src/repositories/mongoose/notification-delivery-attempt.mongoose.repository";
import {
  createServiceTestContext,
  type ServiceTestContext,
} from "../helpers/test-context";

describe(
  "NotificationDeliveryAttemptMongooseRepository Integration",
  { concurrency: true },
  () => {
    let testContext: ServiceTestContext;

    before(async () => {
      testContext = await createServiceTestContext();
      // Constructing the repository registers the model + its indexes on the
      // connection inspected below.
      // eslint-disable-next-line no-new
      new NotificationDeliveryAttemptMongooseRepository(testContext.connection);
    });

    after(() => testContext.teardown());

    it("registers a 90-day TTL index on createdAt", async () => {
      const model = testContext.connection.model("NotificationDeliveryAttempt");
      await model.syncIndexes();

      const indexes = (await model.collection.indexes()) as Array<{
        key: Record<string, number>;
        expireAfterSeconds?: number;
      }>;

      const ttlIndex = indexes.find(
        (index) =>
          index.key.createdAt === 1 && index.expireAfterSeconds !== undefined,
      );

      assert.ok(ttlIndex, "expected a TTL index keyed on createdAt");
      assert.strictEqual(ttlIndex.expireAfterSeconds, 90 * 24 * 60 * 60);
    });
  },
);
