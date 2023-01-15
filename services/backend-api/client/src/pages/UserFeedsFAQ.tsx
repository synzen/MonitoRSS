import {
  Box,
  Flex,
  Heading,
  Stack,
  Text,
  Icon,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionIcon,
  AccordionPanel,
  Link,
} from "@chakra-ui/react";
import {
  BsClockFill,
  BsCursorFill,
  BsFillPencilFill,
  BsFunnelFill,
  BsToggles,
} from "react-icons/bs";
import { FaCloudflare } from "react-icons/fa";
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

const FAQItem = ({ q, a }: { q: string; a: string | React.ReactNode }) => (
  <AccordionItem>
    <AccordionButton py={8}>
      {/* <Box as="span" flex="1" textAlign="left"> */}
      <Text fontWeight={600} size="lg" textAlign="left" flex="1">
        {q}
      </Text>
      {/* </Box> */}
      <AccordionIcon />
    </AccordionButton>
    <AccordionPanel pb={8}>{a}</AccordionPanel>
  </AccordionItem>
);

const FAQ = ({ items }: { items: Array<{ q: string; a: string | React.ReactNode }> }) => (
  <Accordion allowToggle allowMultiple borderRadius="lg">
    {items.map(({ q, a }) => (
      <FAQItem q={q} a={a} />
    ))}
  </Accordion>
);

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
            <Stack>
              <FAQ
                items={[
                  {
                    q: "What am I required to do?",
                    a: (
                      <Text>
                        Nothing, for now. Personal feeds are in beta, but it is available for
                        everyone to try. Once it reaches feature parity with legacy feeds, everyone
                        is encouraged to start converting their legacy feeds to personal feeds.
                        Legacy feeds will eventually be disabled and removed.
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
                    q: "Why is my personal feed limit so low?",
                    a: (
                      <Text>
                        Personal feeds are in beta, and starting limitss are low to be conservative.
                        The limit will eventually increase to match your regular/legacy feed limit.
                        While in beta, your personal feed limit is <i>on top</i> of your legacy feed
                        limit. So you&apos;re basically getting extra feeds for free!
                      </Text>
                    ),
                  },
                  {
                    q: "Can I add my feeds to any server?",
                    a: (
                      <Text>
                        No. The same permissions are required as legacy feeds, which is that you
                        must have Manage Server permission in the Discord server that you&apos;re
                        trying to connect a feed to.
                      </Text>
                    ),
                  },
                  {
                    q: "The current limits are too low. Can I increase them?",
                    a: (
                      <Text>
                        If you find that the current limits are too restricting, let us know in the
                        support server at{" "}
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
                  {
                    q: "What do I do if I am a self-hoster?",
                    a: (
                      <Stack>
                        <Text>
                          For now, you don&apos;t need to do anything. Until personal feeds are out
                          of beta, you can continue using what you have.
                        </Text>
                        <Text>
                          If you are interested in using personal feeds however, documentation will
                          be available soon on new deployment procedures. Deployment has
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
              {/* <Accordion>
                <FAQItem
                <AccordionItem>
                  <Heading as="h2" size="lg">
                    <AccordionButton>
                    <BoxWhat am I required to do?

                    </AccordionButton>
                  </Heading>
                  <Text>
                    Nothing, for now. Personal feeds are in beta, but it is available for everyone
                    to try. Once it reaches feature parity with legacy feeds, everyone is encouraged
                    to start converting their legacy feeds to personal feeds. Legacy feeds will
                    eventually be disabled and removed.
                  </Text>
                </AccordionItem>
              </Accordion> */}
            </Stack>
          </Stack>
        </Stack>
      </BoxConstrained.Container>
    </BoxConstrained.Wrapper>
  );
};

export default UserFeedsFAQ;
