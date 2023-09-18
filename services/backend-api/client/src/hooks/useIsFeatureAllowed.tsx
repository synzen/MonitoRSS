import { BlockableFeature } from "../constants";
import { useDiscordUserMe } from "../features/discordUser";

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

  if (status === "loading" || !data) {
    return {
      loaded: false,
      allowed: false,
    };
  }

  if (status === "error" || error) {
    return {
      loaded: true,
      allowed: false,
      error,
    };
  }

  if (feature === BlockableFeature.CustomPlaceholders) {
    return {
      loaded: true,
      allowed: data.allowCustomPlaceholders === true,
    };
  }

  return {
    loaded: true,
    allowed: false,
  };
};
