import {
  Flex,
  Heading,
  Box,
  HStack,
  Text,
  Badge,
  Stack,
  Button,
  Link as ChakraLink,
  IconButton,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon } from "@chakra-ui/icons";
import { useCallback, useContext } from "react";
import { UserFeedsTable } from "../features/feed/components/UserFeedsTable";
import { useDiscordUserMe } from "../features/discordUser";
import { UserFeedComputedStatus, useUserFeeds } from "../features/feed";
import { pages } from "../constants";
import { BoxConstrained } from "../components";
import { UserFeedStatusFilterContext } from "../contexts";
import { notifySuccess } from "../utils/notifySuccess";
import { notifyInfo } from "../utils/notifyInfo";

export const UserFeeds: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: discordUserMe } = useDiscordUserMe();
  const { data: userFeedsResults } = useUserFeeds({
    limit: 1,
    offset: 0,
    filters: {
      computedStatuses: [UserFeedComputedStatus.RequiresAttention],
    },
  });
  const { statusFilters, setStatusFilters } = useContext(UserFeedStatusFilterContext);

  const onSelectedFeed = (feedId: string) => {
    navigate(pages.userFeed(feedId));
  };

  const onApplyRequiresAttentionFilters = useCallback(() => {
    setStatusFilters([UserFeedComputedStatus.RequiresAttention]);

    if (
      statusFilters.length === 1 &&
      statusFilters.includes(UserFeedComputedStatus.RequiresAttention)
    ) {
      notifyInfo("You are already viewing feeds that require your attention.");
    } else {
      notifySuccess("Filters applied!");
    }
  }, [setStatusFilters]);

  return (
    <BoxConstrained.Wrapper justifyContent="flex-start" height="100%" overflow="visible">
      <BoxConstrained.Container paddingTop={6} spacing={6} height="100%">
        <Stack spacing={4}>
          <Box>
            <Button marginTop={2} variant="outline" onClick={() => navigate("/")} size="sm">
              Back to legacy feeds
            </Button>
          </Box>
          {userFeedsResults?.total !== undefined && userFeedsResults.total > 0 && (
            <Alert status="warning">
              <AlertIcon />
              <AlertTitle>
                {userFeedsResults.total} feed{userFeedsResults.total > 1 ? "s" : ""} require your
                attention!
              </AlertTitle>
              <AlertDescription>
                Article delivery may be fully or partially paused.{" "}
                <ChakraLink color="blue.300" onClick={onApplyRequiresAttentionFilters}>
                  Apply filters to see which ones they are.
                </ChakraLink>
              </AlertDescription>
            </Alert>
          )}
          <Flex justifyContent="space-between" alignItems="center" gap="4" flexWrap="wrap">
            <Flex alignItems="center" gap={4}>
              <Heading size="lg">{t("pages.userFeeds.title")}</Heading>
              <Badge colorScheme="purple" fontSize="lg">
                {t("pages.userFeeds.newBadge")}
              </Badge>
              <Badge colorScheme="orange" fontSize="lg">
                BETA
              </Badge>
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
                  <Text fontSize="xl" fontWeight={600}>
                    {discordUserMe.maxUserFeeds}
                  </Text>
                </HStack>
              )}
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
