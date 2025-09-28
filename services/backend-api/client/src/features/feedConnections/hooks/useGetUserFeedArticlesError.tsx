import { Alert, AlertDescription, AlertIcon, AlertTitle, Box } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { GetUserFeedArticlesOutput } from "../../feed/api";
import { UserFeedArticleRequestStatus } from "../../feed/types";
import { getErrorMessageForArticleRequestStatus } from "../../feed/utils";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { ApiErrorCode } from "@/utils/getStandardErrorCodeMessage copy";

interface Props {
  getUserFeedArticlesOutput?: GetUserFeedArticlesOutput;
  getUserFeedArticlesStatus: "error" | "success" | "loading";
  getUserFeedArticlesError?: ApiAdapterError | null;
}

export const useGetUserFeedArticlesError = ({
  getUserFeedArticlesOutput,
  getUserFeedArticlesStatus,
  getUserFeedArticlesError,
}: Props) => {
  const { t } = useTranslation();

  if (getUserFeedArticlesError) {
    const messageRef = t("common.errors.somethingWentWrong");
    let description = getUserFeedArticlesError.message;

    if (
      getUserFeedArticlesError.errorCode ===
      ApiErrorCode.INVALID_CUSTOM_PLACEHOLDERS_REGEX_PREVIEW_INPUT
    ) {
      description =
        "Invalid regex search for custom placeholders found. Please update or remove custom placeholders in this connection to resolve.";
    } else if (getUserFeedArticlesError.errorCode === ApiErrorCode.INVALID_FILTERS_REGEX) {
      description =
        "Invalid regex search for filters found. Please update or remove filters to resolve.";
    }

    return {
      hasAlert: true,
      alertComponent: (
        <Alert status="error">
          <AlertIcon />
          <Box>
            <AlertTitle>{messageRef}</AlertTitle>
            <AlertDescription>{description}</AlertDescription>
          </Box>
        </Alert>
      ),
      messageRef,
      description,
    };
  }

  if (!getUserFeedArticlesOutput) {
    return {
      hasAlert: false,
      alertComponent: null,
    };
  }

  const {
    result: { requestStatus, response, articles },
  } = getUserFeedArticlesOutput;

  const alertStatus =
    requestStatus && requestStatus !== UserFeedArticleRequestStatus.Success
      ? getErrorMessageForArticleRequestStatus(requestStatus, response?.statusCode)
      : null;

  if (getUserFeedArticlesStatus === "error") {
    const messageRef = t("common.errors.somethingWentWrong");

    return {
      hasAlert: true,
      alertComponent: (
        <Alert status="error">
          <AlertIcon />
          {messageRef}
        </Alert>
      ),
      messageRef,
    };
  }

  if (alertStatus) {
    const messageRef = t(alertStatus.ref);

    return {
      hasAlert: true,
      alertComponent: (
        <Alert status={alertStatus.status || "error"}>
          <AlertIcon />
          {messageRef}
        </Alert>
      ),
      messageRef,
    };
  }

  if (articles.length === 0) {
    const messageRef = t("features.feedConnections.components.articlePlaceholderTable.noArticles");

    return {
      hasAlert: true,
      alertComponent: (
        <Alert status="info">
          <AlertIcon />
          {messageRef}
        </Alert>
      ),
      messageRef,
    };
  }

  // const noArticlesAlert = articles.length === 0 && (
  //   <Alert status="info">
  //     <AlertIcon />
  //     {t("features.feedConnections.components.articlePlaceholderTable.noArticles")}
  //   </Alert>
  // );

  return {
    hasAlert: false,
    alertComponent: null,
    messageRef: "",
  };
};
