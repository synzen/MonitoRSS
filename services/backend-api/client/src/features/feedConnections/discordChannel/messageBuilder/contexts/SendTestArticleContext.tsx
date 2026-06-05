import { Heading, Stack, Text } from "@chakra-ui/react";
import { PropsWithChildren, ReactNode, createContext, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaCheck, FaTimes } from "react-icons/fa";
import { FaTriangleExclamation } from "react-icons/fa6";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import {
  FeedConnectionType,
  SendTestArticleDeliveryStatus,
  SendTestArticleOperationType,
} from "@/types";
import { CreateDiscordChannelConnectionPreviewInput } from "../../connection/api";
import { notifyError } from "@/utils/notifyError";
import { notifySuccess } from "@/utils/notifySuccess";
import { notifyInfo } from "@/utils/notifyInfo";
import {
  CreateConnectionTestArticleOutput,
  useCreateConnectionTestArticle,
} from "../../connection/hooks";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

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
          headerBackgroundColor: "var(--app-status-error-bg)",
        },
        titleIcon: <FaTimes />,
      };

    case SendTestArticleDeliveryStatus.BadPayload:
      return {
        title: failureTitle,
        description:
          "features.feedConnections.components.sendTestArticleButton.alertDescriptionBadPayload",
        useModal: {
          headerBackgroundColor: "var(--app-status-error-bg)",
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
            ? "var(--app-status-warning-bg)"
            : "var(--app-status-error-bg)",
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
          headerBackgroundColor: "var(--app-status-error-bg)",
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
          headerBackgroundColor: "var(--app-status-error-bg)",
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
  const [open, setOpen] = useState(false);
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
        <Stack gap={8}>
          <Text mt={2}>{t(description)}</Text>
          <Stack gap={12}>
            {result.apiPayload && (
              <Stack gap={6}>
                <Heading size="md">
                  {t("features.feedConnections.components.sendTestArticleButton.apiPayload")}
                </Heading>
                <Text>The configured message that was sent to Discord.</Text>
                <pre
                  style={{
                    backgroundColor: "var(--app-bg-emphasized)",
                    overflow: "auto",
                    padding: "1rem",
                  }}
                >
                  {JSON.stringify(result.apiPayload, null, 2)}
                </pre>
              </Stack>
            )}
            {result.apiResponse && (
              <Stack gap={6}>
                <Heading size="md">
                  {t("features.feedConnections.components.sendTestArticleButton.apiResponse")}
                </Heading>
                <Text>
                  The response Discord gave. This should include details on the issues that Discord
                  is reporting with the configured message.
                </Text>
                <pre
                  style={{
                    backgroundColor: "var(--app-bg-emphasized)",
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
      setOpen(true);

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
      <DialogRoot size="cover" open={open} onOpenChange={(e) => setOpen(e.open)}>
        <DialogContent>
          <DialogHeader
            backgroundColor={sendResult.headerBackgroundColor}
            borderTopRightRadius="xl"
            borderTopLeftRadius="xl"
            display="flex"
            alignItems="center"
            gap={2}
          >
            <DialogTitle display="flex" alignItems="center" gap={2}>
              {sendResult.titleIcon}
              {sendResult.title}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>{sendResult.description}</DialogBody>
          <DialogFooter>
            <PrimaryActionButton onClick={() => setOpen(false)}>
              {t("common.buttons.close")}
            </PrimaryActionButton>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
      {children}
    </SendTestArticleContext.Provider>
  );
};
