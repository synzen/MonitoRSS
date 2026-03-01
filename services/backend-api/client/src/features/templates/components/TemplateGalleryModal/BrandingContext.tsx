import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useIsFeatureAllowed } from "../../../../hooks";
import { BlockableFeature } from "../../../../constants";
import { Branding } from "./types";

interface BrandingContextProps {
  displayName: string;
  setDisplayName: (value: string) => void;
  avatarUrl: string;
  setAvatarUrl: (value: string) => void;
  webhooksAllowed: boolean;
  isDisabled: boolean;
  disabledReason?: string;
  hasBrandingValues: boolean;
  getBranding: () => Branding | undefined;
  clearBranding: () => void;
}

const BrandingContext = createContext<BrandingContextProps>({
  displayName: "",
  setDisplayName: () => {},
  avatarUrl: "",
  setAvatarUrl: () => {},
  webhooksAllowed: false,
  isDisabled: false,
  disabledReason: undefined,
  hasBrandingValues: false,
  getBranding: () => undefined,
  clearBranding: () => {},
});

interface BrandingProviderProps {
  children: ReactNode;
  disabledReason?: string;
  isOpen: boolean;
}

export const BrandingProvider = ({ children, disabledReason, isOpen }: BrandingProviderProps) => {
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const { allowed: webhooksAllowed } = useIsFeatureAllowed({
    feature: BlockableFeature.DiscordWebhooks,
  });

  const isDisabled = !!disabledReason;
  const hasBrandingValues = !isDisabled && !!displayName.trim();

  useEffect(() => {
    if (isDisabled) {
      setDisplayName("");
      setAvatarUrl("");
    }
  }, [isDisabled]);

  useEffect(() => {
    if (!isOpen) {
      setDisplayName("");
      setAvatarUrl("");
    }
  }, [isOpen]);

  const getBranding = useCallback((): Branding | undefined => {
    if (isDisabled) return undefined;

    return {
      name: displayName,
      iconUrl: avatarUrl || undefined,
    };
  }, [isDisabled, displayName, avatarUrl]);

  const clearBranding = useCallback(() => {
    setDisplayName("");
    setAvatarUrl("");
  }, []);

  const value: BrandingContextProps = useMemo(
    () => ({
      displayName,
      setDisplayName,
      avatarUrl,
      setAvatarUrl,
      webhooksAllowed,
      isDisabled,
      disabledReason,
      hasBrandingValues,
      getBranding,
      clearBranding,
    }),
    [
      displayName,
      avatarUrl,
      webhooksAllowed,
      isDisabled,
      disabledReason,
      hasBrandingValues,
      getBranding,
      clearBranding,
    ]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
};

export const useBrandingContext = () => useContext(BrandingContext);
