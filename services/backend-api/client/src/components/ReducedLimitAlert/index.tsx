import { useContext, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  CloseButton,
  HStack,
  ListItem,
  UnorderedList,
} from "@chakra-ui/react";
import { ArrowLeftIcon } from "@chakra-ui/icons";
import { ProductKey } from "../../constants";
import { useUserMe } from "../../features/discordUser";
import { UserFeedDisabledCode, useUserFeeds } from "../../features/feed";
import { PricingDialogContext } from "../../contexts";

const IS_IN_TIMEFRAME_TO_SHOW_REDUCED_LIMIT_ALERT = new Date() < new Date("2025-11-01T00:00:00Z");

export const ReducedLimitAlert = () => {
  const { data: userMeData } = useUserMe();
  const [isUserHiddenDecreasedLimitAlert, setIsUserHiddenDecreasedLimitAlert] = useState(
    localStorage.getItem("userHasHiddenFeedLimitAlert") === "true",
  );
  const { data: exceededFeedLimits } = useUserFeeds({
    limit: 1,
    offset: 0,
    filters: {
      disabledCodes: [UserFeedDisabledCode.ExceededFeedLimit],
    },
  });
  const { onOpen: onOpenPricingDialog } = useContext(PricingDialogContext);

  const shouldShowFeedLimitDecreasedAlert =
    userMeData?.result.subscription.product.key === ProductKey.Free && !!exceededFeedLimits?.total;

  if (
    IS_IN_TIMEFRAME_TO_SHOW_REDUCED_LIMIT_ALERT &&
    shouldShowFeedLimitDecreasedAlert &&
    !isUserHiddenDecreasedLimitAlert
  ) {
    return (
      <Alert status="info" mt={2}>
        <AlertIcon />
        <HStack justifyContent="space-between" alignItems="flex-start">
          <Box>
            <AlertTitle>
              The default limits on the free tier have been reduced as of 1 May 2025.
            </AlertTitle>
            <AlertDescription>
              Due to the unsustainably increasing cost of running this service, free tier benefits
              have unfortunately been scaled back on 1 May 2025 as feeds on the free tier account
              for the overwhelming majority of the load.
              <br /> <br />
              <UnorderedList>
                <ListItem>
                  The number of feeds available on the free tier have been reduced from 5 to 3.
                  Feeds over this limit will be disabled until you remove some feeds or upgrade.
                </ListItem>
                <ListItem>
                  The refresh rate on the free tier have been increased from 10 minutes to 20
                  minutes.
                </ListItem>
              </UnorderedList>
              <br />
              You may attempt to reduce your number of feeds by using third-party RSS feed
              combiners/aggregators to combine multiple RSS feeds into one.
              <br />
              <br />
              While these changes are unfortunate, they are necessary to facilitate contiued free
              usage of this open-source service. If you would like to support the service, consider
              becoming a supporter by upgrading to a paid plan. Thank you for your continued
              support.
            </AlertDescription>
            <Box mt={4}>
              <Button
                leftIcon={<ArrowLeftIcon transform="rotate(90deg)" />}
                onClick={onOpenPricingDialog}
              >
                Become a supporter
              </Button>
            </Box>
          </Box>
          <CloseButton
            onClick={() => {
              setIsUserHiddenDecreasedLimitAlert(true);
              localStorage.setItem("userHasHiddenFeedLimitAlert", "true");
            }}
          />
        </HStack>
      </Alert>
    );
  }

  return null;
};
