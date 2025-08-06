import { Box, Button, HStack, Link, Stack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { ExternalLinkIcon, WarningTwoIcon } from "@chakra-ui/icons";
import { useCreateUserFeedManualRequest } from "../../hooks";
import { useUserFeedContext } from "../../../../contexts/UserFeedContext";
import ApiAdapterError from "../../../../utils/ApiAdapterError";
import { getErrorMessageForArticleRequestStatus } from "../../utils";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";
import { ConfirmModal } from "../../../../components";

export const RefreshUserFeedButton = () => {
  const {
    userFeed: { id: feedId, refreshRateSeconds, url },
  } = useUserFeedContext();
  const { t } = useTranslation();
  const { mutateAsync, status: manualRequestStatus } = useCreateUserFeedManualRequest();
  const { createErrorAlert, createSuccessAlert } = usePageAlertContext();

  const onRefreshFeed = async () => {
    if (manualRequestStatus === "loading") {
      return;
    }

    try {
      const {
        result: { requestStatus, requestStatusCode, getArticlesRequestStatus, hasEnabledFeed },
      } = await mutateAsync({
        feedId,
      });

      if (hasEnabledFeed) {
        createSuccessAlert({
          title: "Successfully re-enabled feed.",
        });
      } else {
        const message = getErrorMessageForArticleRequestStatus(
          getArticlesRequestStatus || requestStatus,
          requestStatusCode
        );
        createErrorAlert({
          title: "Failed to re-enable feed. Request to the feed was not successful.",
          description: t(message.ref),
        });
      }
    } catch (err) {
      if (err instanceof ApiAdapterError && err.statusCode === 422) {
        createErrorAlert({
          title: "Failed to re-enable feed due to recently failed feed request.",
          description: `Please wait ${err.body?.result?.minutesUntilNextRequest} minute(s) before trying again.`,
        });
      } else {
        createErrorAlert({
          title: "Failed to re-enable feed.",
          description: (err as Error).message,
        });
      }
    }
  };

  return (
    <ConfirmModal
      trigger={
        <Button aria-disabled={manualRequestStatus === "loading"}>
          <span>
            {manualRequestStatus === "loading"
              ? "Attempting to re-enable..."
              : "Attempt to re-enable"}
          </span>
        </Button>
      }
      onConfirm={onRefreshFeed}
      title="Have you confirmed the feed link is valid?"
      colorScheme="blue"
      descriptionNode={
        <Stack gap={4} alignItems="center">
          <WarningTwoIcon fontSize={24} color="yellow.400" aria-hidden />
          <Stack gap={4}>
            <Text fontWeight={600}>
              Only one attempt to re-enable can be made every {refreshRateSeconds} seconds to avoid
              violating the feed&apos;s rate limits. Make sure the feed below leads to a valid feed
              before proceeding.
            </Text>
            <Box>
              <Link
                href={url}
                isExternal
                target="_blank"
                rel="noopener noreferrer"
                color="blue.300"
              >
                <HStack alignItems="center">
                  <Text wordBreak="break-all">{url}</Text>
                  <ExternalLinkIcon />
                </HStack>
              </Link>
              {/* <FormControl>
                <FormLabel>Feed Link</FormLabel>
                <Input isReadOnly value={url} bg="gray900" />
              </FormControl> */}
            </Box>
          </Stack>
        </Stack>
      }
      okText="Yes, the feed is working"
      cancelText="Cancel"
    />
  );
};
