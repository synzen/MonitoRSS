import { Heading, Stack } from "@chakra-ui/react";
import { DeliveryHistory } from "./DeliveryHistory";
import { RequestHistory } from "./RequestHistory";
import { ArticleStatus } from "./ArticleStatus";

export const UserFeedLogs = () => {
  return (
    <Stack spacing={8}>
      <Heading size="md" as="h2">
        Logs
      </Heading>
      <ArticleStatus />
      <DeliveryHistory />
      <RequestHistory />
    </Stack>
  );
};
