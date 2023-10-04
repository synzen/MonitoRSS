/* eslint-disable no-nested-ternary */
import { CheckIcon, ChevronDownIcon, CloseIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Flex,
  HStack,
  Heading,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  SimpleGrid,
  Stack,
  Switch,
  Tag,
  Text,
  useDisclosure,
  chakra,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Spinner,
  Link,
  ModalCloseButton,
} from "@chakra-ui/react";
import { ChangeEvent, cloneElement, useEffect, useRef, useState } from "react";
import { useSubscriptionProducts } from "../../features/subscriptionProducts";
import { InlineErrorAlert } from "../InlineErrorAlert";
import { useUserMe } from "../../features/discordUser";
import { FAQ } from "../FAQ";
import { usePaddleCheckout } from "../../hooks";

interface Props {
  trigger: React.ReactElement;
}

enum Feature {
  Feeds = "Feeds",
  ArticleLimit = "Article Limit",
  Webhooks = "Webhooks",
  CustomPlaceholders = "Custom Placeholders",
  RefreshRate = "Refresh Rate",
}

const tiers: Array<{
  name: string;
  productId: string;
  disableSubscribe?: boolean;
  priceFormatted: string;
  description: string;
  highlighted?: boolean;
  features: Array<{ name: string; description: string; enabled?: boolean }>;
}> = [
  {
    name: "FREE",
    productId: "free",
    priceFormatted: "$0",
    disableSubscribe: true,
    description: "For plain old news delivery",
    features: [
      {
        name: Feature.Feeds,
        description: "Track 5 news feeds",
        enabled: true,
      },
      {
        name: Feature.ArticleLimit,
        description: "Limit of 50 articles daily",
        enabled: true,
      },
      {
        name: Feature.Webhooks,
        description: "Custom name/avatar with webhooks",
      },
      {
        name: Feature.CustomPlaceholders,
        description: "Custom placeholders",
      },
      {
        name: Feature.RefreshRate,
        description: "10 minute refresh rate",
      },
    ],
  },
  {
    name: "TIER 1",
    productId: "tier1",
    priceFormatted: "$5",
    description: "For customized deliveries",
    features: [
      {
        name: Feature.Feeds,
        description: "Track 15 news feeds",
        enabled: true,
      },
      {
        name: Feature.ArticleLimit,
        description: "Limit of 200 articles daily",
        enabled: true,
      },
      {
        name: Feature.Webhooks,
        description: "Custom name/avatar with webhooks",
        enabled: true,
      },
      {
        name: Feature.CustomPlaceholders,
        description: "Custom placeholders",
        enabled: true,
      },
      {
        name: Feature.RefreshRate,
        description: "10 minute refresh rate",
      },
    ],
  },
  {
    name: "TIER 2",
    productId: "tier2",
    priceFormatted: "$10",
    description: "For time-sensitive deliveries",
    highlighted: true,
    features: [
      {
        name: Feature.Feeds,
        description: "Track 40 news feeds",
        enabled: true,
      },
      {
        name: Feature.ArticleLimit,
        description: "Limit of 500 articles daily",
        enabled: true,
      },
      {
        name: Feature.Webhooks,
        description: "Custom name/avatar with webhooks",
        enabled: true,
      },
      {
        name: Feature.CustomPlaceholders,
        description: "Custom placeholders",
        enabled: true,
      },
      {
        name: Feature.RefreshRate,
        description: "2 minute refresh rate",
        enabled: true,
      },
    ],
  },
  {
    name: "TIER 3",
    productId: "tier3",
    priceFormatted: "$20",
    description: "For power users",
    features: [
      {
        name: Feature.Feeds,
        description: "Track 100 news feeds",
        enabled: true,
      },
      {
        name: Feature.ArticleLimit,
        description: "Limit of 1000 articles daily",
        enabled: true,
      },
      {
        name: Feature.Webhooks,
        description: "Custom name/avatar with webhooks",
        enabled: true,
      },
      {
        name: Feature.CustomPlaceholders,
        description: "Custom placeholders",
        enabled: true,
      },
      {
        name: Feature.RefreshRate,
        description: "2 minute refresh rate",
        enabled: true,
      },
    ],
  },
];

const getIdealPriceTextSize = (length: number) => {
  if (length < 10) {
    return "6xl";
  }

  if (length < 11) {
    return "5xl";
  }

  return "4xl";
};

const CurrencyDisplay = ({
  code,
  symbol,
  minimizeGap,
}: {
  code: string;
  symbol: string;
  minimizeGap?: boolean;
}) => {
  return (
    <span>
      <chakra.span
        fontSize="lg"
        fontWeight="bold"
        width={minimizeGap ? undefined : "3rem"}
        display="inline-block"
        mr={minimizeGap ? 4 : 2}
        whiteSpace="nowrap"
      >
        {symbol}
      </chakra.span>
      <chakra.span fontSize="lg" fontWeight="semibold">
        {code}
      </chakra.span>
    </span>
  );
};

const initialCurrencyCode = localStorage.getItem("currency") || "USD";
const initialCurrencySymbol = localStorage.getItem("currencySymbol") || "$";
const initialInterval =
  (localStorage.getItem("preferredPricingInterval") as "month" | "year") || "month";

export const PricingDialog = ({ trigger }: Props) => {
  const { status: userStatus, error: userError, data: userData } = useUserMe();
  const { onOpen, onClose, isOpen } = useDisclosure();
  const [interval, setInterval] = useState<"month" | "year">(initialInterval);
  const [currency, setCurrency] = useState({
    code: initialCurrencyCode,
    symbol: initialCurrencySymbol,
  });
  const { data, fetchStatus, status, error } = useSubscriptionProducts({
    currency: currency.code,
  });
  const { openCheckout } = usePaddleCheckout();
  const initialFocusRef = useRef<HTMLInputElement>(null);

  const onChangeInterval = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setInterval("year");
      localStorage.setItem("preferredPricingInterval", "year");
    } else {
      setInterval("month");
      localStorage.setItem("preferredPricingInterval", "month");
    }
  };

  const onChangeCurrency = (c: { code: string; symbol: string }) => {
    setCurrency(c);
    localStorage.setItem("currency", c.code);
    localStorage.setItem("currencySymbol", c.symbol);
  };

  const currencyElements = data?.data.currencies.map((c) => (
    <MenuItem key={c.code} onClick={() => onChangeCurrency(c)}>
      <CurrencyDisplay code={c.code} symbol={c.symbol} />
    </MenuItem>
  ));

  const onClickPrice = (priceId?: string) => {
    if (!priceId) {
      return;
    }

    onClose();
    openCheckout({
      priceId,
    });
  };

  useEffect(() => {
    if (status === "success") {
      initialFocusRef.current?.focus();
    }
  }, [status, initialFocusRef.current]);

  const products = data?.data.products;

  const biggestPriceLength = data
    ? Math.max(
        ...(products?.flatMap((pr) =>
          pr.prices.filter((p) => p.interval === interval).map((p) => p.formattedPrice.length)
        ) || []),
        0
      )
    : 4;

  const priceTextSize = getIdealPriceTextSize(biggestPriceLength);
  const userSubscription = userData?.result.subscription;
  const userTierIndex = tiers?.findIndex((p) => p.productId === userSubscription?.product.key);

  return (
    <Box>
      {cloneElement(trigger, {
        onClick: () => onOpen(),
      })}
      <Modal
        onClose={onClose}
        isOpen={isOpen}
        isCentered
        size="full"
        initialFocusRef={initialFocusRef}
        motionPreset="slideInBottom"
        scrollBehavior="outside"
      >
        <ModalOverlay backdropFilter="blur(3px)" />
        <ModalContent bg="blackAlpha.700" shadow="none" maxHeight="100vh" overflowY="scroll">
          <ModalCloseButton />
          <ModalBody bg="transparent" shadow="none">
            <Stack>
              <Flex alignItems="center" justifyContent="center">
                <Stack width="100%" alignItems="center" spacing={12}>
                  <Stack justifyContent="center" textAlign="center">
                    <Heading>Pricing</Heading>
                    <Text color="whiteAlpha.800" fontSize="lg" fontWeight="light">
                      Support MonitoRSS&apos;s open-source development and public hosting in
                      exchange for some upgrades!
                    </Text>
                  </Stack>
                  {(status === "loading" || userStatus === "loading") && <Spinner mb={8} />}
                  {(error || userError) && (
                    <InlineErrorAlert
                      title="Sorry, something went werong"
                      description={(error || userError)?.message}
                    />
                  )}
                  {!error && !userError && data && userSubscription && (
                    <>
                      <Stack>
                        <HStack alignItems="center" spacing={4}>
                          <Text fontSize="lg" fontWeight="semibold">
                            Monthly
                          </Text>
                          <Switch
                            size="lg"
                            colorScheme="green"
                            onChange={onChangeInterval}
                            ref={initialFocusRef}
                            isChecked={interval === "year"}
                          />
                          <Text fontSize="lg" fontWeight="semibold">
                            Yearly
                          </Text>
                        </HStack>
                        <Text color="green.300">Save 15% with a yearly plan!</Text>
                      </Stack>
                      <Menu>
                        <MenuButton
                          as={Button}
                          width={[200]}
                          rightIcon={<ChevronDownIcon />}
                          textAlign="left"
                        >
                          <CurrencyDisplay
                            minimizeGap
                            code={currency.code}
                            symbol={currency.symbol}
                          />
                        </MenuButton>
                        <MenuList maxHeight="300px" overflow="auto">
                          {currencyElements}
                        </MenuList>
                      </Menu>
                      <SimpleGrid
                        // gap={4}
                        // alignItems="center"
                        // flexWrap="wrap"
                        // templateColumns="repeat(auto-fill, minmax(350px, 1fr))"
                        justifyContent="center"
                        gridTemplateColumns={[
                          "350px",
                          "450px",
                          "350px 350px",
                          "350px 350px",
                          "350px 350px 350px",
                          "350px 350px 350px 350px",
                        ]}
                        spacing={4}
                        width="100%"
                      >
                        {tiers.map(
                          (
                            { name, description, priceFormatted, highlighted, features, productId },
                            currentTierIndex
                          ) => {
                            const associatedProduct = products?.find((p) => p.id === productId);

                            const associatedPrice = associatedProduct?.prices.find(
                              (p) => p.interval === interval
                            );

                            const shorterProductPrice = associatedPrice?.formattedPrice.endsWith(
                              ".00"
                            ) ? (
                              <Text fontSize={priceTextSize} fontWeight="bold">
                                {associatedPrice?.formattedPrice.slice(0, -3)}
                              </Text>
                            ) : (
                              associatedPrice?.formattedPrice
                            );

                            const isOnThisTier = userSubscription.product.key === productId;
                            const isAboveUserTier = userTierIndex < currentTierIndex;
                            const isBelowUserTier = userTierIndex > currentTierIndex;

                            return (
                              <Card size="lg" shadow="lg" key={name}>
                                <CardHeader pb={0}>
                                  <Stack>
                                    <HStack justifyContent="flex-start">
                                      <Heading size="md" fontWeight="semibold">
                                        {name}
                                      </Heading>
                                      {highlighted && (
                                        <Tag size="sm" colorScheme="blue" fontWeight="bold">
                                          Most Popular
                                        </Tag>
                                      )}
                                    </HStack>
                                    <Text color="whiteAlpha.600" fontSize="lg">
                                      {description}
                                    </Text>
                                  </Stack>
                                </CardHeader>
                                <CardBody>
                                  <Stack spacing="12">
                                    <Box>
                                      <Text fontSize={priceTextSize} fontWeight="bold">
                                        {fetchStatus === "fetching" && (
                                          <Spinner colorScheme="blue" color="blue.300" size="lg" />
                                        )}
                                        {fetchStatus !== "fetching" &&
                                          (shorterProductPrice || priceFormatted)}
                                      </Text>
                                      <Text fontSize="lg" color="whiteAlpha.600">
                                        {interval === "month" && "per month"}
                                        {interval === "year" && "per year"}
                                      </Text>
                                    </Box>
                                    <Stack>
                                      {features.map((f) => {
                                        return (
                                          <HStack key={f.name}>
                                            {f.enabled ? (
                                              <Flex bg="blue.500" rounded="full" p={1}>
                                                <CheckIcon fontSize="md" width={3} height={3} />
                                              </Flex>
                                            ) : (
                                              // </Box>
                                              <Flex bg="whiteAlpha.600" rounded="full" p={1.5}>
                                                <CloseIcon width={2} height={2} fontSize="sm" />
                                              </Flex>
                                            )}
                                            <Text fontSize="lg">{f.description}</Text>
                                          </HStack>
                                        );
                                      })}
                                    </Stack>
                                  </Stack>
                                </CardBody>
                                <CardFooter justifyContent="center">
                                  <Button
                                    isDisabled={isOnThisTier}
                                    width="100%"
                                    onClick={() => onClickPrice(associatedPrice?.id)}
                                    variant={
                                      isOnThisTier
                                        ? "outline"
                                        : isAboveUserTier
                                        ? "solid"
                                        : "outline"
                                    }
                                    colorScheme={
                                      isAboveUserTier ? "blue" : isBelowUserTier ? "red" : undefined
                                    }
                                  >
                                    {isOnThisTier && "Current Tier"}
                                    {isBelowUserTier && "Downgrade"}
                                    {isAboveUserTier && "Upgrade"}
                                  </Button>
                                </CardFooter>
                              </Card>
                            );
                          }
                        )}
                      </SimpleGrid>
                    </>
                  )}
                </Stack>
              </Flex>
              <Text textAlign="center" color="whiteAlpha.600">
                By proceeding to payment, you are agreeing to our{" "}
                <Link target="_blank" href="https://monitorss.xyz/terms" color="blue.300">
                  terms and conditions
                </Link>{" "}
                as well as our{" "}
                <Link target="_blank" color="blue.300" href="https://monitorss.xyz/privacy-policy">
                  privacy policy
                </Link>
                .<br />
                The checkout process is handled by our reseller and Merchant of Record, Paddle.com,
                who also handles subscription-related inquiries.
              </Text>
            </Stack>
            <Stack justifyContent="center" width="100%" alignItems="center">
              <Stack mt={16} maxW={1400} width="100%">
                <FAQ
                  items={[
                    {
                      q: "Can I switch between plans?",
                      a: (
                        <Text>
                          Yes! You can easily upgrade or downgrade your plan, at any time. If you
                          upgrade, the amount you have already paid for the current period will be
                          pro-rated and applied to the new plan. If you downgrade, the amount you
                          have already paid for the current period will be pro-rated and applied as
                          a credit to the new plan.
                        </Text>
                      ),
                    },
                    {
                      q: "Can I cancel my subscription at any time?",
                      a: (
                        <Text>
                          Yes, you can cancel your subscription at any time from your account page.
                          Your subscription will remain active until the end of the period you have
                          paid for, and will then expire with no further charges.
                        </Text>
                      ),
                    },
                    {
                      q: "Can I get a refund?",
                      a: (
                        <Text>
                          We may offer a refund on a case-by-case basis depending on the situation.
                          For more information, please see our{" "}
                          <Link color="blue.300" target="_blank" href="https://monitorss.xyz/terms">
                            Terms and Conditions
                          </Link>
                          . In any case, please do not hesitate to contact us if you have any
                          questions or concerns.
                        </Text>
                      ),
                    },
                    {
                      q: "How many Discord servers does my subscription apply to?",
                      a: (
                        <Text>
                          Your subscription applies to all the feeds that you own, regardless of
                          what server it is in.
                        </Text>
                      ),
                    },
                    {
                      q: "What if I have more requirements?",
                      a: (
                        <Text>
                          If you have more requirements, please contact us and we will be happy to
                          discuss a custom plan.
                        </Text>
                      ),
                    },
                  ]}
                />
              </Stack>
            </Stack>
          </ModalBody>
          <ModalFooter justifyContent="center" mb={24} mt={6}>
            <Button onClick={onClose} width="lg" variant="outline">
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};
