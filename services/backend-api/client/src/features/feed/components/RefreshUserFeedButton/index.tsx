import { Button } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { notifyError } from "@/utils/notifyError";
import { notifySuccess } from "@/utils/notifySuccess";
import { useCreateUserFeedManualRequest } from "../../hooks";
import { useUserFeedContext } from "../../../../contexts/UserFeedContext";
import ApiAdapterError from "../../../../utils/ApiAdapterError";
import { UserFeedArticleRequestStatus } from "../../types";
import { getErrorMessageForArticleRequestStatus } from "../../utils";

export const RefreshUserFeedButton = () => {
  const {
    userFeed: { id: feedId },
  } = useUserFeedContext();
  const { t } = useTranslation();
  const { mutateAsync, status: manualRequestStatus } = useCreateUserFeedManualRequest();

  const onRefreshFeed = async () => {
    try {
      const {
        result: { requestStatus, requestStatusCode },
      } = await mutateAsync({
        feedId,
      });

      if (requestStatus === UserFeedArticleRequestStatus.Success) {
        notifySuccess(t("features.feed.components.refreshButton.success"));
      } else {
        const message = getErrorMessageForArticleRequestStatus(requestStatus, requestStatusCode);
        notifyError(`Request to feed was not successful`, t(message.ref));
      }
    } catch (err) {
      if (err instanceof ApiAdapterError && err.statusCode === 422) {
        notifyError(
          `Failed to make request`,
          `Please wait ${err.body?.result?.minutesUntilNextRequest} minute(s) before trying again.`
        );
      } else {
        notifyError(t("features.feed.components.refreshButton.failure"), err as Error);
      }
    }
  };

  return (
    <Button onClick={onRefreshFeed} isLoading={manualRequestStatus === "loading"}>
      <span>{t("features.feed.components.refreshButton.text")}</span>
    </Button>
  );
};
