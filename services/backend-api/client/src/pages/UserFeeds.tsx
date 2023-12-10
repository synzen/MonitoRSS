import {
  Flex,
  Heading,
  Box,
  HStack,
  Text,
  Stack,
  Button,
  Link as ChakraLink,
  IconButton,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Tooltip,
} from "@chakra-ui/react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon } from "@chakra-ui/icons";
import { useCallback, useContext, useEffect } from "react";
import { UserFeedsTable } from "../features/feed/components/UserFeedsTable";
import { useDiscordUserMe, useUserMe } from "../features/discordUser";
import {
  FeedManagementInvitesDialog,
  UserFeedComputedStatus,
  useUserFeedManagementInvitesCount,
  useUserFeeds,
} from "../features/feed";
import { pages } from "../constants";
import { BoxConstrained } from "../components";
import { PricingDialogContext, UserFeedStatusFilterContext } from "../contexts";
import { notifySuccess } from "../utils/notifySuccess";
import { notifyInfo } from "../utils/notifyInfo";

export const UserFeeds: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: discordUserMe } = useDiscordUserMe();
  const { data: userMeData } = useUserMe();
  const { onOpen: onOpenPricingDialog } = useContext(PricingDialogContext);
  const { data: userFeedsRequireAttentionResults } = useUserFeeds({
    limit: 1,
    offset: 0,
    filters: {
      computedStatuses: [UserFeedComputedStatus.RequiresAttention],
    },
  });
  const { data: managementInvitesCount } = useUserFeedManagementInvitesCount();
  const { data: userFeedsResults } = useUserFeeds({
    limit: 1,
    offset: 0,
  });
  const { statusFilters, setStatusFilters } = useContext(UserFeedStatusFilterContext);

  const onSelectedFeed = (feedId: string, newTab?: boolean) => {
    if (!newTab) {
      navigate(pages.userFeed(feedId));
    } else {
      const w = window.open(pages.userFeed(feedId), "_blank");
      w?.focus();
    }
  };

  const onApplyRequiresAttentionFilters = useCallback(() => {
    if (
      statusFilters.length === 1 &&
      statusFilters.includes(UserFeedComputedStatus.RequiresAttention)
    ) {
      notifyInfo("You are already viewing feeds that require your attention.");
    } else {
      notifySuccess("Filters applied!");
      setStatusFilters([UserFeedComputedStatus.RequiresAttention]);
    }
  }, [statusFilters, setStatusFilters]);

  const hasFailedFeedAlertsDisabled =
    userMeData && !userMeData.result?.preferences?.alertOnDisabledFeeds;

  useEffect(() => {
    document.title = "Feeds | MonitoRSS";
  }, []);

  return (
    <BoxConstrained.Wrapper justifyContent="flex-start" height="100%" overflow="visible">
      <BoxConstrained.Container paddingTop={6} spacing={6} height="100%">
        <Stack spacing={4}>
          <Box>
            {!userMeData?.result.migratedToPersonalFeeds && (
              <Button marginTop={2} variant="outline" onClick={() => navigate("/")} size="sm">
                Back to legacy feeds
              </Button>
            )}
          </Box>
          {userFeedsRequireAttentionResults?.total !== undefined &&
            userFeedsRequireAttentionResults.total > 0 && (
              <Alert status="warning">
                <AlertIcon />
                <Box>
                  <AlertTitle>
                    {userFeedsRequireAttentionResults.total} feed
                    {userFeedsRequireAttentionResults.total > 1 ? "s" : ""} require
                    {userFeedsRequireAttentionResults.total > 1 ? "" : "s"} your attention!
                  </AlertTitle>
                  <AlertDescription>
                    Article delivery may be fully or partially paused.{" "}
                    <ChakraLink color="blue.300" onClick={onApplyRequiresAttentionFilters}>
                      Apply filters to see which ones they are.
                    </ChakraLink>
                    .
                    {hasFailedFeedAlertsDisabled && (
                      <>
                        {" "}
                        You can also{" "}
                        <ChakraLink as={Link} to={pages.userSettings()} color="blue.300">
                          get notified when failures occur
                        </ChakraLink>
                        .
                      </>
                    )}
                  </AlertDescription>
                </Box>
              </Alert>
            )}
          {managementInvitesCount?.total && (
            <Alert>
              <AlertIcon />
              <AlertTitle flex={1}>
                You have {managementInvitesCount.total} pending feed management invite(s)
              </AlertTitle>
              <AlertDescription>
                <Flex justifyContent="flex-end" flex={1}>
                  <FeedManagementInvitesDialog trigger={<Button variant="outline">View</Button>} />
                </Flex>
              </AlertDescription>
            </Alert>
          )}
          <Flex justifyContent="space-between" alignItems="center" gap="4" flexWrap="wrap">
            <Flex alignItems="center" gap={4}>
              <Heading size="lg">{t("pages.userFeeds.title")}</Heading>
            </Flex>
            <Flex alignItems="center">
              {discordUserMe?.maxUserFeeds !== undefined && userFeedsResults?.total !== undefined && (
                <HStack>
                  <Text fontSize="xl" fontWeight={600}>
                    {userFeedsResults.total}
                  </Text>
                  <Text fontSize="xl" fontWeight={600}>
                    /
                  </Text>
                  {discordUserMe.maxUserFeedsComposition.legacy ? (
                    <Tooltip
                      label={
                        <Box>
                          <Text>+{discordUserMe.maxUserFeedsComposition.base}: Base Amount</Text>
                          <Text>
                            +{discordUserMe.maxUserFeedsComposition.legacy}: Legacy feed conversions
                          </Text>
                        </Box>
                      }
                    >
                      <Text fontSize="xl" fontWeight={600}>
                        {discordUserMe.maxUserFeeds}
                      </Text>
                    </Tooltip>
                  ) : (
                    <Text fontSize="xl" fontWeight={600}>
                      {discordUserMe.maxUserFeeds}
                    </Text>
                  )}
                </HStack>
              )}
              {!userMeData?.result.enableBilling && (
                <IconButton
                  as="a"
                  href="https://www.patreon.com/monitorss"
                  target="_blank"
                  rel="noreferrer noopener"
                  marginLeft="4"
                  aria-label="Increase feed limit"
                  variant="outline"
                  icon={<ArrowLeftIcon />}
                  size="sm"
                  transform="rotate(90deg)"
                />
              )}
              {userMeData?.result.enableBilling && (
                <IconButton
                  aria-label="Increase article daily limit"
                  variant="outline"
                  icon={<ArrowLeftIcon />}
                  size="sm"
                  transform="rotate(90deg)"
                  marginLeft="4"
                  onClick={onOpenPricingDialog}
                />
              )}
            </Flex>
          </Flex>
          <Stack spacing={6}>
            <Text>
              Personal feeds are a new type of feed that will replace current (now considered
              &quot;legacy&quot;) feeds. They contain new features that have never been seen before,
              and are more reliable than legacy feeds. For more information, see the{" "}
              <ChakraLink as={Link} color="blue.300" to={pages.userFeedsFaq()}>
                Frequently Asked Questions
              </ChakraLink>{" "}
              page.
            </Text>
          </Stack>
        </Stack>
        <UserFeedsTable onSelectedFeedId={onSelectedFeed} />
      </BoxConstrained.Container>
    </BoxConstrained.Wrapper>
  );
};
