import { useDisclosure } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FaRightFromBracket } from "react-icons/fa6";
import { useParams } from "react-router-dom";
import { MenuItem } from "@/components/ui/menu";
import { LogoutButton } from "@/features/auth";
import { useDiscordBot, useDiscordUserMe } from "@/features/discordUser";
import { SearchFeedsModal } from "@/features/feed";
import {
  CreateWorkspaceDialog,
  WorkspaceDormantBanner,
  WorkspaceSwitcher,
} from "@/features/workspaces";
import { pages } from "../constants";
import RouteParams from "../types/RouteParams";
import { NewHeader } from "../components";

interface Props {
  invertBackground?: boolean;
}

/**
 * App-shell header container. Lives in the page layer (the composition root,
 * which may import features) so the shared-base NewHeader can stay feature-free.
 *
 * Workspaces: the workspace switcher always renders, including at 0 workspaces
 * (where it shows the "Personal" scope and surfaces "Create a workspace" inside its
 * menu). Discovery and switching share one place rather than splitting
 * create-workspace into a separate account-menu entry.
 */
export const AppHeader = ({ invertBackground }: Props) => {
  const { data: discordBotData, status, error } = useDiscordBot();
  const { data: discordUserMe } = useDiscordUserMe();
  const { t } = useTranslation();
  // The logo is scope-relative: "home" inside a workspace is that workspace's feeds.
  const { workspaceSlug } = useParams<RouteParams>();

  const createWorkspaceDisclosure = useDisclosure();

  return (
    <>
      <NewHeader
        invertBackground={invertBackground}
        bot={discordBotData?.result}
        isBotLoading={status === "loading"}
        botError={error}
        user={discordUserMe}
        logoHref={pages.userFeeds(workspaceSlug ? { workspaceSlug } : undefined)}
        workspaceSlot={<WorkspaceSwitcher onCreateWorkspace={createWorkspaceDisclosure.onOpen} />}
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
      {/* Workspace-level (account-scope) banner sits below the global header, above page
          content — it self-gates via useCurrentWorkspace(), which is null outside a
          workspace scope, so personal routes render nothing here. */}
      <WorkspaceDormantBanner />
      <CreateWorkspaceDialog
        isOpen={createWorkspaceDisclosure.open}
        onClose={createWorkspaceDisclosure.onClose}
      />
    </>
  );
};
