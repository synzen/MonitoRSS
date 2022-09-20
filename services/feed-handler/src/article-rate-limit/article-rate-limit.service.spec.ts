import { Test, TestingModule } from "@nestjs/testing";
import { ArticleRateLimitService } from "./article-rate-limit.service";

describe("ArticleRateLimitService", () => {
  let service: ArticleRateLimitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ArticleRateLimitService],
    }).compile();

    service = module.get<ArticleRateLimitService>(ArticleRateLimitService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
