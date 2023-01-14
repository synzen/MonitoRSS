import { Flex, Heading, Box, HStack, Text, Badge, Stack, Button } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { UserFeedsTable } from "../features/feed/components/UserFeedsTable";
import { useDiscordUserMe } from "../features/discordUser";
import { useUserFeeds } from "../features/feed";
import { pages } from "../constants";
import { BoxConstrained } from "../components";

export const UserFeeds: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: discordUserMe } = useDiscordUserMe();
  const { data: userFeeds } = useUserFeeds({
    initialLimit: 10,
  });

  const onSelectedFeed = (feedId: string) => {
    navigate(pages.userFeed(feedId));
  };

  return (
    <BoxConstrained.Wrapper>
      <BoxConstrained.Container paddingTop={10} spacing={6}>
        <Stack>
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={4}>
              <Heading size="lg">{t("pages.userFeeds.title")}</Heading>
              <Badge colorScheme="purple" fontSize="lg">
                {t("pages.userFeeds.newBadge")}
              </Badge>
            </Flex>
            <Box>
              {discordUserMe?.maxUserFeeds !== undefined && userFeeds?.total !== undefined && (
                <HStack>
                  <Text fontSize="xl" fontWeight={600}>
                    {userFeeds.total}
                  </Text>
                  <Text fontSize="xl" fontWeight={600}>
                    /
                  </Text>
                  <Text fontSize="xl" fontWeight={600}>
                    {discordUserMe.maxUserFeeds}
                  </Text>
                </HStack>
              )}
            </Box>
          </Flex>
          <Stack spacing={6}>
            {t("pages.userFeeds.description")}
            <Text>
              You&apos;ll has access to {discordUserMe?.maxUserFeeds || ""} personal feed(s) during
              this time on top of their regular feed limit, however the regular feed limit will
              apply again once personal feeds are fully released and legacy feeds are deprecated.
            </Text>
            <Stack>
              <Text>Some features of personal feeds are:</Text>
              <ul
                style={{
                  listStylePosition: "inside",
                }}
              >
                <li>Feed sites behind Cloudflare are supported</li>
                <li>Enable or disable feeds</li>
                <li>Customize messages based on filters</li>
                <li>Improved filter with unlimited possibilities (with regex!)</li>
                <li>Test article deliveries with comprehensive details on failures</li>
              </ul>
            </Stack>
            <Text>
              There will eventually be a way to migrate legacy feeds to personal feeds as more
              features are added for feature parity.
            </Text>
            <Box>
              <Button marginTop={2} variant="outline" onClick={() => navigate("/")} size="sm">
                Back to legacy feeds
              </Button>
            </Box>
          </Stack>
        </Stack>
        {/* <Alert
          borderRadius="md"
          colorScheme="purple"
          flexDirection="column"
          alignItems="flex-start"
        >
          <AlertDescription>
            <Text paddingBottom="2">
              You&apos;ll has access to {discordUserMe?.maxUserFeeds} personal feeds during this
              time on top of their regular feed limit, however the regular feed limit will apply
              again once personal feeds are generally available.
            </Text>
            <Box paddingBottom="2">
              <ul
                style={{
                  listStylePosition: "inside",
                }}
              >
                <li>Feed sites behind Cloudflare are supported</li>
                <li>Enable or disable feeds</li>
                <li>Customize messages based on filters</li>
                <li>Improved filter with unlimited possibilities (with regex!)</li>
                <li>Test article deliveries with comprehensive details on failures</li>
              </ul>
            </Box>
            <Text>
              There will eventually be a way to migrate legacy feeds to personal feeds as personal
              feeds improve to ensure feature parity.
            </Text>
          </AlertDescription>
          <Button marginTop={4} variant="outline" onClick={() => navigate("/")} size="sm">
            Back to legacy feeds
          </Button>
        </Alert> */}
        <UserFeedsTable onSelectedFeedId={onSelectedFeed} />
      </BoxConstrained.Container>
    </BoxConstrained.Wrapper>
  );
};
