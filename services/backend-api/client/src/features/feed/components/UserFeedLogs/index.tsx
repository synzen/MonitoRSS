import { Stack } from "@chakra-ui/react";
import { DeliveryHistory } from "./DeliveryHistory";
import { RequestHistory } from "./RequestHistory";

interface Props {
  feedId?: string;
}

export const UserFeedLogs = ({ feedId }: Props) => {
  return (
    <Stack spacing={8}>
      <RequestHistory feedId={feedId} />
      <DeliveryHistory feedId={feedId} />
    </Stack>
  );
};
