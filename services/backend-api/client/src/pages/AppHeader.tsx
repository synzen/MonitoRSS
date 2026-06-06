import { useTranslation } from "react-i18next";
import { FaRightFromBracket } from "react-icons/fa6";
import { MenuItem } from "@/components/ui/menu";
import { LogoutButton } from "@/features/auth";
import { useDiscordBot, useDiscordUserMe } from "@/features/discordUser";
import { SearchFeedsModal } from "@/features/feed";
import { NewHeader } from "../components";

interface Props {
  invertBackground?: boolean;
}

/**
 * App-shell header container. Lives in the page layer (the composition root, which ADR-002
 * permits to import features) so the shared-base NewHeader can stay feature-free.
 */
export const AppHeader = ({ invertBackground }: Props) => {
  const { data: discordBotData, status, error } = useDiscordBot();
  const { data: discordUserMe } = useDiscordUserMe();
  const { t } = useTranslation();

  return (
    <NewHeader
      invertBackground={invertBackground}
      bot={discordBotData?.result}
      isBotLoading={status === "loading"}
      botError={error}
      user={discordUserMe}
      searchSlot={<SearchFeedsModal />}
      logoutSlot={
        <LogoutButton
          trigger={
            <MenuItem value="logout">
              <FaRightFromBracket />
              {t("components.pageContentV2.logout")}
            </MenuItem>
          }
        />
      }
    />
  );
};
