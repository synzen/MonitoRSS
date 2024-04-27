import { Alert, AlertDescription, AlertIcon, AlertTitle, Box } from "@chakra-ui/react";
import { useUserFeedContext } from "../../../../../contexts/UserFeedContext";
import { useUserMe } from "../../../../discordUser";
import { useUserFeedArticles } from "../../../../feed";

const ARTICLE_THRESHOLD = 25;

export const useArticleInjectionEligibility = () => {
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
        articleInjections: [],
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
      <Alert status="warning">
        <AlertIcon />
        <Box>
          <AlertTitle>This feature is disabled for this feed</AlertTitle>
          <AlertDescription>
            To prevent performance issues, this feature is disabled and will not be processed for
            any articles in feeds with over {ARTICLE_THRESHOLD} articles in them.
          </AlertDescription>
        </Box>
      </Alert>
    ),
  };
};
