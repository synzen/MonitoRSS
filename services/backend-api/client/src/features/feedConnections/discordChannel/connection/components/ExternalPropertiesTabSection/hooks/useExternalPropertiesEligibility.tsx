import { Alert } from "@chakra-ui/react";
import { useUserFeedContext, useUserFeedArticles } from "@/features/feed";
import { useUserMe } from "@/features/discordUser";

import { EXTERNAL_PROPERTIES_MAX_ARTICLES } from "@/constants/externalPropertiesMaxArticles";

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
      <Alert.Root status="warning" rounded="lg">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>This feature is disabled for this feed</Alert.Title>
          <Alert.Description>
            To prevent performance issues, this feature is only enabled for feeds with fewer than{" "}
            {EXTERNAL_PROPERTIES_MAX_ARTICLES} articles. This feed currently has{" "}
            {data.result.totalArticles} articles.
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    ),
  };
};
