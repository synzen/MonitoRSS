import { Alert, AlertDescription, AlertTitle, Box, Button } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { notifyError } from "../../../../utils/notifyError";
import { useUpdateUserFeed, useUserFeed } from "../../hooks";
import { UserFeedDisabledCode } from "../../types";
import { UpdateUserFeedInput } from "../../api";
import { RefreshUserFeedButton } from "../RefreshUserFeedButton";

interface Props {
  feedId?: string;
}

export const UserFeedDisabledAlert = ({ feedId }: Props) => {
  const { t } = useTranslation();
  const { feed } = useUserFeed({
    feedId,
  });
  const { mutateAsync: mutateAsyncUserFeed, status: updatingStatus } = useUpdateUserFeed();

  const onUpdateFeed = async ({ url, ...rest }: UpdateUserFeedInput["data"]) => {
    if (!feedId) {
      return;
    }

    try {
      await mutateAsyncUserFeed({
        feedId,
        data: {
          url: url === feed?.url ? undefined : url,
          ...rest,
        },
      });
      notifySuccess(t("common.success.savedChanges"));
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
      throw err;
    }
  };

  const disabledCode = feed?.disabledCode;

  if (!disabledCode) {
    return null;
  }

  if (disabledCode === UserFeedDisabledCode.Manual) {
    return (
      <Alert status="info" borderRadius="md">
        <Box>
          <AlertTitle>{t("pages.userFeed.manuallyDisabledTitle")}</AlertTitle>
          <AlertDescription display="block">
            {t("pages.userFeed.manuallyDisabledDescription")}
            <Box marginTop="1rem">
              <Button
                isLoading={updatingStatus === "loading"}
                onClick={() =>
                  onUpdateFeed({
                    disabledCode: null,
                  })
                }
              >
                <span>{t("pages.userFeed.manuallyDisabledEnableButtonText")}</span>
              </Button>
            </Box>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  if (disabledCode === UserFeedDisabledCode.InvalidFeed) {
    return (
      <Alert status="error" borderRadius="md">
        <Box>
          <AlertTitle>{t("pages.userFeed.invalidFeedFailureTitle")}</AlertTitle>
          <AlertDescription display="block">
            <span>{t("pages.userFeed.invalidFeedFailureText")}</span>
            <Box marginTop="1rem">{feedId && <RefreshUserFeedButton feedId={feedId} />}</Box>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  if (disabledCode === UserFeedDisabledCode.BadFormat) {
    return (
      <Alert status="error" borderRadius="md">
        <Box>
          <AlertTitle>{t("pages.userFeed.invalidFeedFailureTitle")}</AlertTitle>
          <AlertDescription display="block">
            <span>{t("pages.userFeed.invalidFeedFailureText")}</span>
            <Box marginTop="1rem">{feedId && <RefreshUserFeedButton feedId={feedId} />}</Box>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  if (disabledCode === UserFeedDisabledCode.FailedRequests) {
    return (
      <Alert status="error" borderRadius="md">
        <Box>
          <AlertTitle>{t("pages.userFeed.connectionFailureTitle")}</AlertTitle>
          <AlertDescription display="block">
            <span>{t("pages.userFeed.connectionFailureText")}</span>
            <Box marginTop="1rem">{feedId && <RefreshUserFeedButton feedId={feedId} />}</Box>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  if (disabledCode === UserFeedDisabledCode.ExceededFeedLimit) {
    return (
      <Alert status="error" borderRadius="md">
        <Box>
          <AlertTitle>{t("pages.userFeed.exceededFeedLimitTitle")}</AlertTitle>
          <AlertDescription display="block">
            <span>{t("pages.userFeed.exceededFeedLimitText")}</span>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  if (disabledCode === UserFeedDisabledCode.FeedTooLarge) {
    return (
      <Alert status="error" borderRadius="md">
        <Box>
          <AlertTitle>{t("pages.userFeed.feedTooLargeTitle")}</AlertTitle>
          <AlertDescription display="block">
            <span>{t("pages.userFeed.feedTooLargeText")}</span>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  if (disabledCode === UserFeedDisabledCode.ExcessivelyActive) {
    return (
      <Alert status="error" borderRadius="md">
        <Box>
          <AlertTitle>{t("pages.userFeed.adminDisabledTitle")}</AlertTitle>
          <AlertDescription display="block">
            <span>{t("pages.userFeed.adminDisabledText")}</span>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  return (
    <Alert status="error" borderRadius="md">
      <Box>
        <AlertTitle>{t("pages.userFeed.unknownTitle")}</AlertTitle>
        <AlertDescription display="block">
          <span>{t("pages.userFeed.unknownText")}</span>
        </AlertDescription>
      </Box>
    </Alert>
  );
};
