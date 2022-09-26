import { ConfigService } from "@nestjs/config";
import { SqsPollingService } from "../../common/services/sqs-polling.service";
import { FeedModel } from "../feeds/entities/feed.entity";
import { FailedUrlHandlerService } from "./failed-url-handler.service";

describe("FailedUrlHandlerService Unit", () => {
  let service: FailedUrlHandlerService;
  const configService: ConfigService = {
    get: jest.fn(),
  } as never;
  const sqsPollingService: SqsPollingService = {
    pollQueue: jest.fn(),
  } as never;
  const feedModel: FeedModel = {
    updateMany: jest.fn(),
  } as never;

  beforeEach(async () => {
    jest.resetAllMocks();
    service = new FailedUrlHandlerService(
      configService,
      sqsPollingService,
      feedModel
    );
  });

  describe("disableFeedsWithUrl", () => {
    const url = "foobar";

    it("calls updateMany correctly", async () => {
      await service.disableFeedsWithUrl(url);
      expect(feedModel.updateMany).toHaveBeenCalledWith(
        {
          url,
          isFeedv2: true,
        },
        {
          $set: {
            disabled: "CONNECTION_FAILURE",
          },
        }
      );
    });
  });
});
