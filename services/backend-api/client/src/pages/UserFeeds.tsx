import {
  Flex,
  Heading,
  Box,
  HStack,
  Text,
  Badge,
  Stack,
  Button,
  Icon,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaCloudflare } from "react-icons/fa";
import { StarIcon } from "@chakra-ui/icons";
import {
  BsClockFill,
  BsCursorFill,
  BsFillPencilFill,
  BsFunnelFill,
  BsToggles,
} from "react-icons/bs";
import { UserFeedsTable } from "../features/feed/components/UserFeedsTable";
import { useDiscordUserMe } from "../features/discordUser";
import { useUserFeeds } from "../features/feed";
import { pages } from "../constants";
import { BoxConstrained } from "../components";

interface FeatureProps {
  icon: React.ReactNode;
  name: string;
  description: string;
}

const Feature = ({ icon, name, description }: FeatureProps) => {
  return (
    <Stack flexGrow={1} maxWidth="sm" width="sm">
      <Box borderRadius="lg" padding="4" width="min-content">
        {icon}
      </Box>
      <Text fontWeight="bold" fontSize="lg">
        {name}
      </Text>
      <Text>{description}</Text>
    </Stack>
  );
};

interface FeaturesProp {
  features: Array<FeatureProps>;
}

const Features = ({ features }: FeaturesProp) => {
  return (
    <Flex gap="8" justifyContent="space-between" flexWrap="wrap">
      {features.map((feature) => (
        <Feature
          icon={feature.icon}
          description={feature.description}
          name={feature.name}
          key={feature.name}
        />
      ))}
    </Flex>
  );
};

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
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center" gap={4}>
              <Heading size="lg">{t("pages.userFeeds.title")}</Heading>
              <Badge colorScheme="purple" fontSize="lg">
                {t("pages.userFeeds.newBadge")}
              </Badge>
              <Badge colorScheme="orange" fontSize="lg">
                BETA
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
              Personal feeds are currently in beta until it reaches feature parity with legacy
              feeds. You&apos;ll has access to {discordUserMe?.maxUserFeeds || ""} personal feed(s)
              during this time on top of their regular feed limit. Once personal feeds are out of
              beta, legacy feeds will no longer function and the regular feed limit will apply
              again.
            </Text>
            <Text>
              There will eventually be a way to migrate legacy feeds to personal feeds as more
              features are added for feature parity.
            </Text>
            <Accordion allowToggle>
              <AccordionItem>
                <AccordionButton>
                  <Flex width="100%" justifyContent="space-between" alignItems="center">
                    <HStack>
                      <Icon as={StarIcon} color="purple.400" />
                      <Text>Features</Text>
                    </HStack>
                    <AccordionIcon />
                  </Flex>
                </AccordionButton>
                <AccordionPanel>
                  <Stack spacing={8}>
                    <Features
                      features={[
                        {
                          icon: (
                            <Icon
                              as={FaCloudflare}
                              boxSize={10}
                              color="blue.500"
                              transform="scale(1.4)"
                            />
                          ),
                          name: "Cloudflare Support",
                          description:
                            'Feed sites behind Cloudflare are now supported. Most feeds that previously could not be added due to errors related to "Cloudflare" can now be added!',
                        },
                        {
                          icon: <Icon as={BsToggles} boxSize={10} color="blue.500" />,
                          name: "Enable/disable delivery",
                          description:
                            "Enable delivery to one or more channels/webhooks for any feed.",
                        },
                        {
                          icon: <Icon as={BsFunnelFill} boxSize={10} color="blue.500" />,
                          name: "Upgraded Filters",
                          description:
                            "Customize messages with different types of conditions (ANDs/ORs/regex) on filters with unlimited combinations.",
                        },
                        {
                          icon: <Icon as={BsFillPencilFill} boxSize={10} color="blue.500" />,
                          name: "Filter-Customized Messages",
                          description: "Customize messages of a single feed based on filters.",
                        },
                        {
                          icon: <Icon as={BsCursorFill} boxSize={10} color="blue.500" />,
                          name: "Delivery Testing",
                          description:
                            "Test article delivery for any article and receive comprehensive details on failures for easy troubleshooting.",
                        },
                        {
                          icon: <Icon as={BsClockFill} boxSize={10} color="blue.500" />,
                          name: "Longer Retry Times",
                          description:
                            "Feeds will get disabled much less often after request failures using an exponential backoff retry strategy, retrying for up to 1 week.",
                        },
                      ]}
                    />
                    <Text textAlign="center" paddingTop="8">
                      ...and much more coming!
                    </Text>
                  </Stack>
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
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
