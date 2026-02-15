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
import { PropsWithChildren, ReactNode, createContext, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaCheck, FaTimes } from "react-icons/fa";
import { FaTriangleExclamation } from "react-icons/fa6";
import {
  FeedConnectionType,
  SendTestArticleDeliveryStatus,
  SendTestArticleOperationType,
} from "../types";
import { CreateDiscordChannelConnectionPreviewInput } from "../features/feedConnections/api";
import { notifyError } from "../utils/notifyError";
import { notifySuccess } from "../utils/notifySuccess";
import getChakraColor from "../utils/getChakraColor";
import { notifyInfo } from "../utils/notifyInfo";
import {
  CreateConnectionTestArticleOutput,
  useCreateConnectionTestArticle,
} from "../features/feedConnections/hooks";

interface ContextProps {
  sendTestArticle: (
    data: {
      connectionType: FeedConnectionType;
      previewInput: CreateDiscordChannelConnectionPreviewInput;
    },
    opts?: { disableToastErrors?: boolean; disableToast?: boolean },
  ) => Promise<{
    status: "info" | "success" | "error";
    title: string;
    description?: string;
  } | null>;
  isFetching: boolean;
  error?: string;
}

export const SendTestArticleContext = createContext<ContextProps>({
  sendTestArticle: async () => null,
  isFetching: false,
});

const getMessageByStatus = (
  result: CreateConnectionTestArticleOutput["result"],
): {
  title: string;
  titleIcon?: ReactNode;
  description?: string;
  useNotify?: {
    status: "info" | "success";
    func: (title: string, description?: string) => void;
  };
  useModal?: {
    headerBackgroundColor?: string;
  };
} => {
  const isCreateThread =
    result.operationType === SendTestArticleOperationType.CreateThreadOnMessage;
  const failureTitle = isCreateThread
    ? "Failed to create thread on message"
    : "features.feedConnections.components.sendTestArticleButton.alertTitleFailure";

  switch (result.status) {
    case SendTestArticleDeliveryStatus.Success:
      return {
        title: "features.feedConnections.components.sendTestArticleButton.alertTitleSuccess",
        useNotify: {
          status: "success",
          func: notifySuccess,
        },
        titleIcon: <FaCheck />,
      };

    case SendTestArticleDeliveryStatus.ThirdPartyInternalError:
      return {
        title: "features.feedConnections.components.sendTestArticleButton.alertTitleFailure",
        description:
          "features.feedConnections.components." +
          "sendTestArticleButton.alertDescriptionThirdPartyInternalError",
        useModal: {
          headerBackgroundColor: getChakraColor("red.600"),
        },
        titleIcon: <FaTimes />,
      };

    case SendTestArticleDeliveryStatus.BadPayload:
      return {
        title: failureTitle,
        description:
          "features.feedConnections.components.sendTestArticleButton.alertDescriptionBadPayload",
        useModal: {
          headerBackgroundColor: getChakraColor("red.600"),
        },
        titleIcon: <FaTimes />,
      };

    case SendTestArticleDeliveryStatus.MissingApplicationPermission:
      return {
        title: failureTitle,
        description: isCreateThread
          ? "The article was sent, but the thread could not get created due to missing permissions to create public threads. Ensure the bot has permissions to create public threads in the channel."
          : "features.feedConnections.components." +
            "sendTestArticleButton.alertDescriptionMissingApplicationPermission",
        useModal: {
          headerBackgroundColor: isCreateThread
            ? getChakraColor("orange.600")
            : getChakraColor("red.600"),
        },
        titleIcon: isCreateThread ? <FaTriangleExclamation /> : <FaTimes />,
      };

    case SendTestArticleDeliveryStatus.MissingChannel:
      return {
        title: "features.feedConnections.components.sendTestArticleButton.alertTitleFailure",
        description:
          "features.feedConnections.components." +
          "sendTestArticleButton.alertDescriptionMissingChannel",
        useModal: {
          headerBackgroundColor: getChakraColor("red.600"),
        },
        titleIcon: <FaTimes />,
      };

    case SendTestArticleDeliveryStatus.TooManyRequests:
      return {
        title: failureTitle,
        description:
          "features.feedConnections.components." +
          "sendTestArticleButton.alertDescriptionTooManyRequests",
        useModal: {
          headerBackgroundColor: getChakraColor("red.600"),
        },
        titleIcon: <FaTimes />,
      };

    case SendTestArticleDeliveryStatus.NoArticles:
      return {
        title: "features.feedConnections.components.sendTestArticleButton.alertTitleFailure",
        description:
          "features.feedConnections.components.sendTestArticleButton.alertDescriptionNoArticles",
        useNotify: {
          status: "info",
          func: notifyInfo,
        },
      };

    default:
      return {
        title: "features.feedConnections.components.sendTestArticleButton.alertTitleFailure",
        titleIcon: <FaTimes />,
      };
  }
};

export const SendTestArticleProvider = ({ children }: PropsWithChildren<{}>) => {
  const { t } = useTranslation();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [sendResult, setSendResult] = useState({
    title: "",
    description: <div />,
    headerBackgroundColor: "",
    titleIcon: null as ReactNode,
  });
  const { mutateAsync, status, error } = useCreateConnectionTestArticle();

  const sendTestArticle: ContextProps["sendTestArticle"] = useCallback(async (data, opts) => {
    try {
      const { result } = await mutateAsync(data);

      const { title, description, useModal, useNotify, titleIcon } = getMessageByStatus(result);

      if (useNotify) {
        if (!opts?.disableToast) {
          useNotify.func(t(title), description && t(description));
        }

        return {
          status: useNotify.status,
          title: t(title),
          description: description ? t(description) : undefined,
        };
      }

      const descriptionNode = !description ? (
        <div />
      ) : (
        <Stack spacing={8}>
          <Text mt={2}>{t(description)}</Text>
          <Stack spacing={12}>
            {result.apiPayload && (
              <Stack spacing={6}>
                <Heading size="md">
                  {t("features.feedConnections.components.sendTestArticleButton.apiPayload")}
                </Heading>
                <Text>The configured message that was sent to Discord.</Text>
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
                <Text>
                  The response Discord gave. This should include details on the issues that Discord
                  is reporting with the configured message.
                </Text>
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
        titleIcon,
      });
      onOpen();

      return null;
    } catch (err) {
      if (!opts?.disableToastErrors && !opts?.disableToast) {
        notifyError(t("common.errors.somethingWentWrong"), err as Error);
      }

      return {
        status: "error",
        title: "Failed to send test article.",
        description: (err as Error).message,
      };
    }
  }, []);

  const providerValue: ContextProps = useMemo(
    () => ({
      sendTestArticle,
      isFetching: status === "loading",
      error: error?.message,
    }),
    [sendTestArticle, status],
  );

  return (
    <SendTestArticleContext.Provider value={providerValue}>
      <Modal size="4xl" isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader
            backgroundColor={sendResult.headerBackgroundColor}
            borderTopRightRadius="xl"
            borderTopLeftRadius="xl"
            display="flex"
            alignItems="center"
            gap={2}
          >
            {sendResult.titleIcon}
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
      {children}
    </SendTestArticleContext.Provider>
  );
};
