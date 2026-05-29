import { Box } from "@chakra-ui/react";
import { useParams } from "react-router-dom";
import { UserFeedDetail, UserFeedProvider, useUserFeed } from "@/features/feed";
import RouteParams from "../types/RouteParams";
import { DashboardContentV2 } from "../components/DashboardContentV2";
import { PageAlertProvider } from "../contexts/PageAlertContext";

export const UserFeed = () => {
  const { feedId } = useParams<RouteParams>();
  const { status, error } = useUserFeed({
    feedId,
  });

  return (
    <DashboardContentV2 error={error} loading={status === "loading"}>
      <UserFeedProvider feedId={feedId}>
        <Box display="flex" flexDirection="column" alignItems="center" pt={4} isolation="isolate">
          <PageAlertProvider>
            <UserFeedDetail />
          </PageAlertProvider>
        </Box>
      </UserFeedProvider>
    </DashboardContentV2>
  );
};
