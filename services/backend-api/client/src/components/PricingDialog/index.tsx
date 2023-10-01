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
} from "@chakra-ui/react";
import { ChangeEvent, cloneElement, useEffect, useRef, useState } from "react";
import { useSubscriptionProducts } from "../../features/subscriptionProducts";
import { InlineErrorAlert } from "../InlineErrorAlert";

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
  const { onOpen, onClose, isOpen } = useDisclosure();
  const [interval, setInterval] = useState<"month" | "year">(initialInterval);
  const [currency, setCurrency] = useState({
    code: initialCurrencyCode,
    symbol: initialCurrencySymbol,
  });
  const { data, fetchStatus, status, error } = useSubscriptionProducts({
    currency: currency.code,
  });
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

  return (
    <Box>
      {cloneElement(trigger, {
        onClick: () => onOpen(),
      })}
      <Modal
        closeOnOverlayClick={false}
        onClose={onClose}
        isOpen={isOpen}
        isCentered
        size="6xl"
        initialFocusRef={initialFocusRef}
      >
        <ModalOverlay backdropFilter="blur(1px)" />
        <ModalContent bg="transparent" shadow="none">
          <ModalBody bg="transparent" shadow="none">
            <Flex
              alignItems="center"
              justifyContent="center"
              mt={-24}
              sx={{
                "@media (max-height: 1150px)": {
                  mt: 12,
                },
              }}
            >
              <Stack width="100%" alignItems="center" spacing={12}>
                <Stack justifyContent="center" textAlign="center">
                  <Heading>Pricing</Heading>
                  <Text color="whiteAlpha.800" fontSize="lg" fontWeight="light">
                    Support MonitoRSS&apos;s open-source development and public hosting in exchange
                    for some upgrades!
                  </Text>
                </Stack>
                {status === "loading" && <Spinner mb={8} />}
                {error && (
                  <InlineErrorAlert
                    title="Sorry, something went werong"
                    description={error.message}
                  />
                )}
                {!error && data && (
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
                        ({
                          name,
                          description,
                          priceFormatted,
                          highlighted,
                          disableSubscribe,
                          features,
                          productId,
                        }) => {
                          const associatedProduct = products?.find((p) => p.id === productId);

                          const price = associatedProduct?.prices.find(
                            (p) => p.interval === interval
                          );

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
                                        (price?.formattedPrice || priceFormatted)}
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
                                {!disableSubscribe && (
                                  <Button
                                    colorScheme="blue"
                                    width="100%"
                                    variant={highlighted ? "solid" : "outline"}
                                  >
                                    Subscribe
                                  </Button>
                                )}
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
          </ModalBody>
          <ModalFooter justifyContent="center">
            <Button onClick={onClose} width="lg" variant="outline">
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};
