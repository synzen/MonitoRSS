import { Alert, AlertIcon } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { GetUserFeedArticlesOutput } from "../../feed/api";
import { UserFeedArticleRequestStatus } from "../../feed/types";
import { getErrorMessageForArticleRequestStatus } from "../../feed/utils";

interface Props {
  getUserFeedArticlesOutput?: GetUserFeedArticlesOutput;
  getUserFeedArticlesStatus: "error" | "success" | "loading";
}

export const useGetUserFeedArticlesError = ({
  getUserFeedArticlesOutput,
  getUserFeedArticlesStatus,
}: Props) => {
  const { t } = useTranslation();

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
