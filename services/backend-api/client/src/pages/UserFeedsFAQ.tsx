import { Box, Flex, Heading, Stack, Text, Icon, Link } from "@chakra-ui/react";
import {
  BsChatFill,
  BsClockFill,
  BsCursorFill,
  BsFillPencilFill,
  BsFunnelFill,
  BsToggles,
} from "react-icons/bs";
import { FaCloudflare } from "react-icons/fa";
import { BoxConstrained, FAQ } from "../components";

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

const UserFeedsFAQ: React.FC = () => {
  return (
    <BoxConstrained.Wrapper>
      <BoxConstrained.Container paddingTop={10} spacing={6} paddingBottom={32}>
        <Stack spacing={4}>
          <Heading as="h1">What are Personal Feeds?</Heading>
          <Stack spacing={8}>
            <Stack>
              <Text>
                Personal feeds are a new type of feed that will replace current (now considered
                &quot;legacy&quot;) feeds. They are named &quot;personal&quot; because they are tied
                to your account rather than a server, so all the feeds you see are only the ones you
                have personally created.
              </Text>
              <Text>
                They address core infrastructure/stability issues related to legacy feeds and are
                more reliable, customizeable and flexible than the current feeds that you have. New
                feature development will only happen for personal feeds from this point onward. Some
                of its new features are listed below:
              </Text>
            </Stack>
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
                    description: "Enable delivery to one or more channels/webhooks for any feed.",
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
                    description: "Create custom messages based on article content.",
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
                  {
                    icon: <Icon as={BsChatFill} boxSize={10} color="blue.500" />,
                    name: "Forum/Thread Support",
                    description:
                      "Create new threads per article in forum channels, or create new messages per article within an existing thread.",
                  },
                ]}
              />
              <Text textAlign="center" paddingTop="8">
                ...and much more coming!
              </Text>
            </Stack>
            <Stack>
              <FAQ
                items={[
                  {
                    q: "What am I required to do?",
                    a: (
                      <Text>
                        If you are using legacy feeds, you must convert them to personal feeds.
                        Legacy feeds will start getting disabled on 1 September 2023. All legacy
                        feeds will be disabled by 1 October 2023.
                      </Text>
                    ),
                  },
                  {
                    q: "Why should I use personal feeds?",
                    a: (
                      <Text>
                        Legacy feeds wil eventually be disabled and removed. New features will only
                        be added to personal feeds.
                      </Text>
                    ),
                  },
                  {
                    q: "Why were personal feeds created?",
                    a: (
                      <Stack>
                        <Text>
                          Legacy feeds were not scalable in terms of new feature development and
                          maintenance. As a result, a significant portion of time was spent on
                          maintaining and trying to scale infrastructure rather than developing new
                          features. Features also had to be disabled to lessen the load on the bot
                          to prioritize article delivery.
                        </Text>
                        <Text>
                          These issues should be resolved now since feeds were re-designed from the
                          ground up. Feature development should be faster and easier, and there
                          should be less frequent failures.
                        </Text>
                      </Stack>
                    ),
                  },
                  {
                    q: "Can I add my feeds to any server?",
                    a: (
                      <Text>
                        No. The same permissions are required as legacy feeds, which is that you
                        must have Manage Channels permission in the Discord server that you&apos;re
                        trying to connect a feed to.
                      </Text>
                    ),
                  },
                  {
                    q: "The current limits are too low. Can I increase them?",
                    a: (
                      <Text>
                        If you find that the current limits are too restricting, you may create a
                        pledge on{" "}
                        <Link
                          target="_blank"
                          href="https://www.patreon.com/monitorss"
                          rel="noreferrer noopener"
                          isExternal
                          color="blue.200"
                        >
                          Patreon
                        </Link>{" "}
                        to increase your limits. Legacy and personal feed limits are the same per
                        tier.
                      </Text>
                    ),
                  },
                  {
                    q: "What do I do if I am a self-hoster?",
                    a: (
                      <Stack>
                        <Text>For now, you don&apos;t need to do anything.=</Text>
                        <Text>
                          If you are interested in using personal feeds however, documentation will
                          be eventually be available on new deployment procedures. Deployment has
                          unfortunately gotten more complicated due to the new architecture, but
                          it&apos;s still possible to self-host and everything is still open-source
                          on the MIT license.
                        </Text>
                      </Stack>
                    ),
                  },
                  {
                    q: "I have more questions. Where can I ask them?",
                    a: (
                      <Text>
                        You may ask them in the support server at{" "}
                        <Link
                          target="_blank"
                          href="https://discord.gg/pudv7Rx"
                          rel="noreferrer noopener"
                          isExternal
                          color="blue.200"
                        >
                          https://discord.gg/pudv7Rx
                        </Link>
                        .
                      </Text>
                    ),
                  },
                ]}
              />
            </Stack>
          </Stack>
        </Stack>
      </BoxConstrained.Container>
    </BoxConstrained.Wrapper>
  );
};

export default UserFeedsFAQ;
