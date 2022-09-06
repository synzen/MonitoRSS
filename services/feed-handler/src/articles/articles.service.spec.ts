import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../shared/utils/setup-integration-tests";
import { ArticlesService } from "./articles.service";
import { FeedArticleField } from "./entities";
import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { randomUUID } from "crypto";

describe("ArticlesService", () => {
  let service: ArticlesService;
  let repo: EntityRepository<FeedArticleField>;

  beforeAll(async () => {
    const { init } = await setupIntegrationTests(
      {
        providers: [ArticlesService],
      },
      {
        models: [FeedArticleField],
      }
    );

    const { module } = await init();

    service = module.get<ArticlesService>(ArticlesService);
    const em = module.get(EntityManager);
    repo = em.getRepository(FeedArticleField);
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("hasPriorArticlesStored", () => {
    it("returns true correctly", async () => {
      const feedId = randomUUID();

      await repo.nativeInsert({
        feed_id: feedId,
        field_name: "field-name",
        field_value: "field-value",
        created_at: new Date(),
      });

      const result = await service.hasPriorArticlesStored(feedId);
      expect(result).toEqual(true);
    });
  });
});
