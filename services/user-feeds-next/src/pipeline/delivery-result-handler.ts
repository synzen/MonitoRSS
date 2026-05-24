import {
  ArticleDeliveryStatus,
  ArticleDeliveryRejectedCode,
  processDeliveryResult,
  type DiscordDeliveryResult,
  type MediumRejectionEvent,
} from "../delivery";
import { logger } from "../shared/utils";
import { MessageBrokerQueue } from "../shared/constants";
import {
  type DeliveryRecordStore,
  type ArticleDeliveryState,
  ArticleDeliveryErrorCode,
} from "../stores/interfaces/delivery-record-store";

export type QueuePublisher = (queue: string, message: unknown) => Promise<void>;

export async function handleArticleDeliveryResult(
  deliveryResult: DiscordDeliveryResult,
  publisher: QueuePublisher,
  deliveryRecordStore: DeliveryRecordStore
): Promise<void> {
  const { processed, rejectionEvent } = processDeliveryResult(deliveryResult);

  logger.debug(
    `Delivery result for medium ${processed.meta.mediumId}: status=${processed.status}`,
    {
      feedId: processed.meta.feedId,
      errorCode: processed.errorCode,
    }
  );

  const deliveryId = deliveryResult.job.meta?.id;
  if (deliveryId) {
    try {
      await deliveryRecordStore.updateDeliveryStatus(deliveryId, {
        status: processed.status,
        errorCode: processed.errorCode,
        internalMessage: processed.internalMessage,
        externalDetail: processed.externalDetail,
      });
    } catch (err) {
      logger.warn("Failed to update delivery record status", {
        deliveryId,
        error: (err as Error).message,
      });
    }
  }

  if (rejectionEvent) {
    await emitRejectionEvent(rejectionEvent, publisher);
  }
}

export async function emitRejectionEvent(
  event: MediumRejectionEvent,
  publisher: QueuePublisher
): Promise<void> {
  let rejectedCode: ArticleDeliveryRejectedCode;
  let feedId: string;
  let mediumId: string;
  let payload: Record<string, unknown>;

  switch (event.type) {
    case "badFormat":
      rejectedCode = ArticleDeliveryRejectedCode.BadRequest;
      feedId = event.data.feedId;
      mediumId = event.data.mediumId;
      payload = {
        data: {
          rejectedCode,
          articleId: event.data.articleId,
          rejectedMessage: event.data.responseBody,
          medium: { id: mediumId },
          feed: { id: feedId },
        },
      };
      break;

    case "missingPermissions":
      rejectedCode = ArticleDeliveryRejectedCode.Forbidden;
      feedId = event.data.feedId;
      mediumId = event.data.mediumId;
      payload = {
        data: {
          rejectedCode,
          medium: { id: mediumId },
          feed: { id: feedId },
        },
      };
      break;

    case "notFound":
      rejectedCode = ArticleDeliveryRejectedCode.MediumNotFound;
      feedId = event.data.feedId;
      mediumId = event.data.mediumId;
      payload = {
        data: {
          rejectedCode,
          medium: { id: mediumId },
          feed: { id: feedId },
        },
      };
      break;
  }

  logger.debug(`Emitting rejection event: ${rejectedCode}`, {
    feedId,
    mediumId,
  });

  await publisher(
    MessageBrokerQueue.FeedRejectedArticleDisableConnection,
    payload
  );
}

export function getRejectionEventFromDeliveryState(
  feedId: string,
  state: ArticleDeliveryState
): MediumRejectionEvent | null {
  if (state.status !== ArticleDeliveryStatus.Rejected) {
    return null;
  }

  switch (state.errorCode) {
    case ArticleDeliveryErrorCode.NoChannelOrWebhook:
    case ArticleDeliveryErrorCode.ThirdPartyNotFound:
      return {
        type: "notFound",
        data: { feedId, mediumId: state.mediumId },
      };
    case ArticleDeliveryErrorCode.ThirdPartyForbidden:
      return {
        type: "missingPermissions",
        data: { feedId, mediumId: state.mediumId },
      };
    case ArticleDeliveryErrorCode.ThirdPartyBadRequest:
    case ArticleDeliveryErrorCode.NoPayloadForMedium:
      return {
        type: "badFormat",
        data: {
          feedId,
          mediumId: state.mediumId,
          articleId: state.article?.flattened.id,
          responseBody: state.externalDetail || "",
        },
      };
    default:
      return null;
  }
}
