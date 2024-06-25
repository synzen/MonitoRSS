import { Stack } from "@chakra-ui/react";
import { DeliveryHistory } from "./DeliveryHistory";
import { RequestHistory } from "./RequestHistory";

export const UserFeedLogs = () => {
  return (
    <Stack spacing={8}>
      <RequestHistory />
      <DeliveryHistory />
    </Stack>
  );
};
