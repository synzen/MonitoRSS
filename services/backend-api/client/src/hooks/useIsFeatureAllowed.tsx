import { BlockableFeature } from "../constants";
import { useDiscordUserMe, useUserMe } from "../features/discordUser";

interface Props {
  feature: BlockableFeature;
}

interface Returned {
  loaded: boolean;
  allowed: boolean;
  error?: Error | null;
}

export const useIsFeatureAllowed = ({ feature }: Props): Returned => {
  const { data, status, error } = useDiscordUserMe();
  const { data: userMeData, status: userMeStatus, error: userMeError } = useUserMe();

  const isLoading = status === "loading" || userMeStatus === "loading";
  const isError = status === "error" || userMeStatus === "error";
  const finalError = error || userMeError;

  if (isLoading || !data || !userMeData) {
    return {
      loaded: false,
      allowed: false,
    };
  }

  if (isError || finalError) {
    return {
      loaded: true,
      allowed: false,
      error,
    };
  }

  if (feature === BlockableFeature.DiscordWebhooks) {
    return {
      loaded: true,
      allowed: !!data.supporter,
    };
  }

  if (feature === BlockableFeature.CustomPlaceholders) {
    return {
      loaded: true,
      allowed: data.allowCustomPlaceholders === true,
    };
  }

  if (feature === BlockableFeature.ArticleInjections) {
    return {
      loaded: true,
      allowed: userMeData.result.supporterFeatures?.articleInjections?.enabled === true,
    };
  }

  return {
    loaded: true,
    allowed: false,
  };
};
