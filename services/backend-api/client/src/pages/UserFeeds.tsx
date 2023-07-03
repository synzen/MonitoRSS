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
} from "@chakra-ui/react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon } from "@chakra-ui/icons";
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
        <Stack spacing={4}>
          <Box>
            <Button marginTop={2} variant="outline" onClick={() => navigate("/")} size="sm">
              Back to legacy feeds
            </Button>
          </Box>
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
