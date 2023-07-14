import {
  Button,
  Heading,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiPlay } from "react-icons/fi";
import { FeedConnectionType, SendTestArticleDeliveryStatus } from "../../../../types";
import getChakraColor from "../../../../utils/getChakraColor";
import { notifyError } from "../../../../utils/notifyError";
import { notifyInfo } from "../../../../utils/notifyInfo";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { GetUserFeedArticlesInput } from "../../../feed/api";
import { ArticleSelectPrompt } from "../../../feed/components";
import { useCreateConnectionTestArticle } from "../../hooks";

interface Props {
  feedId: string;
  connectionId: string;
  type: FeedConnectionType;
  articleFormatter: GetUserFeedArticlesInput["data"]["formatter"];
}

const messagesByStatus: Record<
  SendTestArticleDeliveryStatus,
  {
    title: string;
    description?: string;
    useNotify?: {
      func: (title: string, description?: string) => void;
    };
    useModal?: {
      headerBackgroundColor?: string;
    };
  }
> = {
  [SendTestArticleDeliveryStatus.Success]: {
    title: "features.feedConnections.components.sendTestArticleButton.alertTitleSuccess",
    useNotify: {
      func: notifySuccess,
    },
  },
  [SendTestArticleDeliveryStatus.ThirdPartyInternalError]: {
    title: "features.feedConnections.components.sendTestArticleButton.alertTitleFailure",
    description:
      "features.feedConnections.components." +
      "sendTestArticleButton.alertDescriptionThirdPartyInternalError",
    useModal: {
      headerBackgroundColor: getChakraColor("red.600"),
    },
  },
  [SendTestArticleDeliveryStatus.BadPayload]: {
    title: "features.feedConnections.components.sendTestArticleButton.alertTitleFailure",
    description:
      "features.feedConnections.components.sendTestArticleButton.alertDescriptionBadPayload",
    useModal: {
      headerBackgroundColor: getChakraColor("red.600"),
    },
  },
  [SendTestArticleDeliveryStatus.MissingApplicationPermission]: {
    title: "features.feedConnections.components.sendTestArticleButton.alertTitleFailure",
    description:
      "features.feedConnections.components." +
      "sendTestArticleButton.alertDescriptionMissingApplicationPermission",
    useModal: {
      headerBackgroundColor: getChakraColor("red.600"),
    },
  },
  [SendTestArticleDeliveryStatus.MissingChannel]: {
    title: "features.feedConnections.components.sendTestArticleButton.alertTitleFailure",
    description:
      "features.feedConnections.components." +
      "sendTestArticleButton.alertDescriptionMissingChannel",
    useModal: {
      headerBackgroundColor: getChakraColor("red.600"),
    },
  },
  [SendTestArticleDeliveryStatus.TooManyRequests]: {
    title: "features.feedConnections.components.sendTestArticleButton.alertTitleFailure",
    description:
      "features.feedConnections.components." +
      "sendTestArticleButton.alertDescriptionTooManyRequests",
    useModal: {
      headerBackgroundColor: getChakraColor("red.600"),
    },
  },
  [SendTestArticleDeliveryStatus.NoArticles]: {
    title: "features.feedConnections.components.sendTestArticleButton.alertTitleFailure",
    description:
      "features.feedConnections.components.sendTestArticleButton.alertDescriptionNoArticles",
    useNotify: {
      func: notifyInfo,
    },
  },
};

export const SendConnectionTestArticleButton = ({
  feedId,
  connectionId,
  type,
  articleFormatter,
}: Props) => {
  const { t } = useTranslation();
  const { mutateAsync, status } = useCreateConnectionTestArticle(type);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [sendResult, setSendResult] = useState({
    title: "",
    description: <div />,
    headerBackgroundColor: "",
  });

  const onClick = async (articleId?: string) => {
    try {
      const { result } = await mutateAsync({
        feedId,
        connectionId,
        articleId,
      });

      const { title, description, useModal, useNotify } = messagesByStatus[result.status];

      if (useNotify) {
        useNotify.func(t(title), description && t(description));

        return;
      }

      const descriptionNode = !description ? (
        <div />
      ) : (
        <Stack spacing={8}>
          <Text>{t(description)}</Text>
          <Stack spacing={12}>
            {result.apiPayload && (
              <Stack spacing={6}>
                <Heading size="md">
                  {t("features.feedConnections.components.sendTestArticleButton.apiPayload")}
                </Heading>
                <pre
                  style={{
                    backgroundColor: getChakraColor("gray.800"),
                    overflow: "auto",
                    padding: "1rem",
                  }}
                >
                  {JSON.stringify(result.apiPayload, null, 2)}
                </pre>
              </Stack>
            )}
            {result.apiResponse && (
              <Stack spacing={6}>
                <Heading size="md">
                  {t("features.feedConnections.components.sendTestArticleButton.apiResponse")}
                </Heading>
                <pre
                  style={{
                    backgroundColor: getChakraColor("gray.800"),
                    overflow: "auto",
                    padding: "1rem",
                  }}
                >
                  {JSON.stringify(result.apiResponse, null, 2)}
                </pre>
              </Stack>
            )}
          </Stack>
        </Stack>
      );

      setSendResult({
        title: t(title),
        description: descriptionNode,
        headerBackgroundColor: useModal?.headerBackgroundColor || "",
      });
      onOpen();
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  return (
    <>
      <Modal size="xl" isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader
            backgroundColor={sendResult.headerBackgroundColor}
            borderTopRightRadius="xl"
            borderTopLeftRadius="xl"
          >
            {sendResult.title}
          </ModalHeader>
          <ModalBody>{sendResult.description}</ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" onClick={onClose}>
              {t("common.buttons.close")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <ArticleSelectPrompt
        feedId={feedId}
        trigger={
          <Button
            variant="solid"
            colorScheme="blue"
            isLoading={status === "loading"}
            leftIcon={<FiPlay />}
          >
            {t("features.feedConnections.components.sendTestArticleButton.text")}
          </Button>
        }
        onArticleSelected={onClick}
        onClickRandomArticle={onClick}
        articleFormatter={articleFormatter}
      />
    </>
  );
};
