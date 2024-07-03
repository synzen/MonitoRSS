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
import { PropsWithChildren, createContext, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FeedConnectionType, SendTestArticleDeliveryStatus } from "../types";
import { CreateDiscordChannelConnectionPreviewInput } from "../features/feedConnections/api";
import { notifyError } from "../utils/notifyError";
import { notifySuccess } from "../utils/notifySuccess";
import getChakraColor from "../utils/getChakraColor";
import { notifyInfo } from "../utils/notifyInfo";
import { useCreateConnectionTestArticle } from "../features/feedConnections/hooks";

interface ContextProps {
  sendTestArticle: (
    data: {
      connectionType: FeedConnectionType;
      previewInput: CreateDiscordChannelConnectionPreviewInput;
    },
    opts?: { disableToastErrors?: boolean }
  ) => Promise<void>;
  isFetching: boolean;
  error?: string;
}

export const SendTestArticleContext = createContext<ContextProps>({
  sendTestArticle: async () => {},
  isFetching: false,
});

const MESSAGES_BY_STATUS: Record<
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

export const SendTestArticleProvider = ({ children }: PropsWithChildren<{}>) => {
  const { t } = useTranslation();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [sendResult, setSendResult] = useState({
    title: "",
    description: <div />,
    headerBackgroundColor: "",
  });
  const { mutateAsync, status, error } = useCreateConnectionTestArticle();

  const sendTestArticle: ContextProps["sendTestArticle"] = useCallback(async (data, opts) => {
    try {
      const { result } = await mutateAsync(data);

      const { title, description, useModal, useNotify } = MESSAGES_BY_STATUS[result.status];

      if (useNotify) {
        useNotify.func(t(title), description && t(description));

        return;
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
      if (!opts?.disableToastErrors) {
        notifyError(t("common.errors.somethingWentWrong"), err as Error);
      }
    }
  }, []);

  const providerValue: ContextProps = useMemo(
    () => ({
      sendTestArticle,
      isFetching: status === "loading",
      error: error?.message,
    }),
    [sendTestArticle, status]
  );

  return (
    <SendTestArticleContext.Provider value={providerValue}>
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
      {children}
    </SendTestArticleContext.Provider>
  );
};
