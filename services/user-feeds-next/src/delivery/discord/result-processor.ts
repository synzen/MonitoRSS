import {
  ArticleDeliveryStatus,
  ArticleDeliveryErrorCode,
} from "../../stores/interfaces/delivery-record-store";
import {
  ArticleDeliveryRejectedCode,
  type DiscordDeliveryResult,
  type DeliveryJobMeta,
  type ProcessedDeliveryResult,
  type MediumRejectionEvent,
} from "../types";

export function processDeliveryResult(deliveryResult: DiscordDeliveryResult): {
  processed: ProcessedDeliveryResult;
  rejectionEvent?: MediumRejectionEvent;
} {
  const { job, result } = deliveryResult;

  const meta: DeliveryJobMeta = {
    feedId: job.meta?.feedId ?? "",
    articleIdHash: job.meta?.articleIdHash ?? "",
    mediumId: job.meta?.mediumId ?? "",
    articleId: job.meta?.articleId,
    debug: job.meta?.debug === true,
  };

  if (result.state === "error") {
    return {
      processed: {
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.Internal,
        internalMessage: result.message,
        meta,
      },
    };
  }

  const { status, body } = result;

  if (status === 400) {
    const responseBody = JSON.stringify(body);
    const requestBody = job.options?.body;

    return {
      processed: {
        status: ArticleDeliveryStatus.Rejected,
        errorCode: ArticleDeliveryErrorCode.ThirdPartyBadRequest,
        internalMessage: `Body: ${responseBody}, Request Body: ${requestBody}`,
        externalDetail: JSON.stringify({
          type: "DISCORD_RESPONSE",
          data: {
            responseBody: body,
            requestBody: requestBody ? JSON.parse(requestBody) : undefined,
          },
        }),
        meta,
      },
      rejectionEvent: {
        type: "badFormat",
        data: {
          feedId: meta.feedId,
          mediumId: meta.mediumId,
          articleId: meta.articleId,
          responseBody,
        },
      },
    };
  }

  if (status === 403) {
    return {
      processed: {
        status: ArticleDeliveryStatus.Rejected,
        errorCode: ArticleDeliveryErrorCode.ThirdPartyForbidden,
        internalMessage: `Body: ${JSON.stringify(body)}`,
        meta,
      },
      rejectionEvent: {
        type: "missingPermissions",
        data: {
          feedId: meta.feedId,
          mediumId: meta.mediumId,
        },
      },
    };
  }

  if (status === 404) {
    return {
      processed: {
        status: ArticleDeliveryStatus.Rejected,
        errorCode: ArticleDeliveryErrorCode.ThirdPartyNotFound,
        internalMessage: `Body: ${JSON.stringify(body)}`,
        meta,
      },
      rejectionEvent: {
        type: "notFound",
        data: {
          feedId: meta.feedId,
          mediumId: meta.mediumId,
        },
      },
    };
  }

  if (status >= 500) {
    return {
      processed: {
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.ThirdPartyInternal,
        internalMessage: `Body: ${JSON.stringify(body)}`,
        meta,
      },
    };
  }

  if (status < 200 || status > 400) {
    return {
      processed: {
        status: ArticleDeliveryStatus.Failed,
        errorCode: ArticleDeliveryErrorCode.Internal,
        internalMessage: `Unhandled status code from Discord ${status} received. Body: ${JSON.stringify(body)}`,
        meta,
      },
    };
  }

  return {
    processed: {
      status: ArticleDeliveryStatus.Sent,
      meta,
    },
  };
}
