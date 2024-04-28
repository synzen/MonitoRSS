import { Alert, AlertDescription, AlertIcon, AlertTitle, Box } from "@chakra-ui/react";
import { useUserFeedContext } from "../../../../../contexts/UserFeedContext";
import { useUserMe } from "../../../../discordUser";
import { useUserFeedArticles } from "../../../../feed";

const ARTICLE_THRESHOLD = 25;

export const useExternalPropertiesEligibility = () => {
  const { userFeed } = useUserFeedContext();
  const { data } = useUserFeedArticles({
    feedId: userFeed.id,
    data: {
      limit: 1,
      skip: 0,
      formatter: {
        options: {
          dateFormat: undefined,
          dateTimezone: undefined,
          formatTables: false,
          stripImages: false,
          disableImageLinkPreviews: false,
        },
        externalProperties: [],
      },
      selectProperties: ["id"],
    },
  });
  const { data: userMeData } = useUserMe();

  if (!data || !userMeData) {
    return {
      loaded: false,
    };
  }

  if (data.result.totalArticles <= ARTICLE_THRESHOLD) {
    return {
      loaded: true,
      eligible: true,
    };
  }

  return {
    loaded: true,
    eligible: false,
    alertComponent: (
      <Alert status="warning" rounded="lg">
        <AlertIcon />
        <Box>
          <AlertTitle>This feature is disabled for this feed</AlertTitle>
          <AlertDescription>
            To prevent performance issues, this feature is only enabled for feeds with fewer than{" "}
            {ARTICLE_THRESHOLD + 1} articles. This feed currently has {data.result.totalArticles}{" "}
            articles.
          </AlertDescription>
        </Box>
      </Alert>
    ),
  };
};
