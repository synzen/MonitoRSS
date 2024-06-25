import { Alert, AlertDescription, AlertIcon, AlertTitle, Box } from "@chakra-ui/react";
import { useUserFeedContext } from "../../../../../contexts/UserFeedContext";
import { useUserMe } from "../../../../discordUser";
import { useUserFeedArticles } from "../../../../feed";
import { EXTERNAL_PROPERTIES_MAX_ARTICLES } from "../../../../../constants/externalPropertiesMaxArticles";

export const useExternalPropertiesEligibility = () => {
  const { userFeed, articleFormatOptions } = useUserFeedContext();
  const { data } = useUserFeedArticles({
    feedId: userFeed.id,
    data: {
      limit: 1,
      skip: 0,
      formatOptions: articleFormatOptions,
      selectProperties: ["id"],
    },
  });
  const { data: userMeData } = useUserMe();

  if (!data || !userMeData) {
    return {
      loaded: false,
    };
  }

  if (data.result.totalArticles < EXTERNAL_PROPERTIES_MAX_ARTICLES) {
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
            {EXTERNAL_PROPERTIES_MAX_ARTICLES} articles. This feed currently has{" "}
            {data.result.totalArticles} articles.
          </AlertDescription>
        </Box>
      </Alert>
    ),
  };
};
