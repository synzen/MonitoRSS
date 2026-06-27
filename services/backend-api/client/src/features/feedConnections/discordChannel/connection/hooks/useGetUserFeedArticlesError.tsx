import { Alert, Box } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import {
  GetUserFeedArticlesOutput,
  UserFeedArticleRequestStatus,
  getErrorMessageForArticleRequestStatus,
} from "@/features/feed";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { ApiErrorCode } from "@/utils/getStandardErrorCodeMessage";

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
        <Alert.Root status="error">
          <Alert.Indicator />
          <Box>
            <Alert.Title>{messageRef}</Alert.Title>
            <Alert.Description>{description}</Alert.Description>
          </Box>
        </Alert.Root>
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
        <Alert.Root status="error">
          <Alert.Indicator />
          {messageRef}
        </Alert.Root>
      ),
      messageRef,
    };
  }

  if (alertStatus) {
    const messageRef = t(alertStatus.ref);

    return {
      hasAlert: true,
      alertComponent: (
        <Alert.Root status={alertStatus.status || "error"}>
          <Alert.Indicator />
          {messageRef}
        </Alert.Root>
      ),
      messageRef,
    };
  }

  if (articles.length === 0) {
    const messageRef = t("features.feedConnections.components.articlePlaceholderTable.noArticles");

    return {
      hasAlert: true,
      alertComponent: (
        <Alert.Root status="info">
          <Alert.Indicator />
          {messageRef}
        </Alert.Root>
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
