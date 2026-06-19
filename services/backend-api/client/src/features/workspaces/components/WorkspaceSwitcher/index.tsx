import { useMemo, useState } from "react";
import { Box, Button, Icon, Input, Skeleton, Stack, Text, VisuallyHidden } from "@chakra-ui/react";
import { FaChevronDown, FaGear, FaPlus } from "react-icons/fa6";
import { useNavigate, useParams } from "react-router-dom";
import { pages } from "@/constants";
import RouteParams from "@/types/RouteParams";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import {
  MenuRoot,
  MenuTrigger,
  MenuContent,
  MenuRadioItemGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuItem,
} from "@/components/ui/menu";
import { useWorkspaces } from "../../hooks";

const PERSONAL_VALUE = "personal";
const FILTER_THRESHOLD = 7;

const LIVE_STATUS_TEXT: Record<string, string> = {
  loading: "Loading workspaces",
  success: "Workspaces loaded",
};

/**
 * Header workspace switcher.
 *
 * Active scope is derived from the route (`useParams().workspaceSlug`) + the workspaces
 * list, NOT from `CurrentWorkspaceContext`: the header renders as a sibling of
 * `WorkspaceScopeLayout`, so the context provider is not an ancestor here.
 *
 * Menu item values are workspace slugs (the URL segment), not workspace ids.
 *
 * The feature gate and the "render only when the user has >=1 workspace" count-gate
 * (A2) are applied by `AppHeader`, the single decision point; this component
 * still degrades safely if mounted in an empty/loading state.
 */
export const WorkspaceSwitcher = ({ onCreateWorkspace }: { onCreateWorkspace: () => void }) => {
  const navigate = useNavigate();
  const { workspaceSlug } = useParams<RouteParams>();
  const { workspaces, status, error, refetch } = useWorkspaces();
  const [filter, setFilter] = useState("");

  const activeValue = workspaceSlug ?? PERSONAL_VALUE;
  const activeName = useMemo(() => {
    if (!workspaceSlug) {
      return "Personal";
    }

    return workspaces?.find((t) => t.slug === workspaceSlug)?.name ?? "Workspace";
  }, [workspaceSlug, workspaces]);

  const visibleWorkspaces = useMemo(() => {
    if (!workspaces || workspaces.length <= FILTER_THRESHOLD || !filter.trim()) {
      return workspaces ?? [];
    }

    const q = filter.trim().toLowerCase();

    return workspaces.filter((t) => t.name.toLowerCase().includes(q));
  }, [workspaces, filter]);

  const showFilter = (workspaces?.length ?? 0) > FILTER_THRESHOLD;

  const handleSelect = (value: string) => {
    if (value === PERSONAL_VALUE) {
      navigate(pages.userFeeds());
    } else {
      navigate(pages.userFeeds({ workspaceSlug: value }));
    }
  };

  return (
    <MenuRoot positioning={{ placement: "bottom-start" }}>
      <MenuTrigger asChild>
        {/* Quiet ghost chip: the trigger reads as the scope segment of the header's
            brand/scope path rather than a freestanding control. */}
        <Button
          variant="ghost"
          size="sm"
          maxW="220px"
          fontSize="md"
          fontWeight="medium"
          aria-label={`Switch workspace, current: ${activeName}`}
        >
          <Text as="span" lineClamp={1}>
            {activeName}
          </Text>
          <Icon as={FaChevronDown} boxSize={3} color="fg.muted" />
        </Button>
      </MenuTrigger>
      <MenuContent maxH="420px" overflowY="auto">
        <VisuallyHidden aria-live="polite">{LIVE_STATUS_TEXT[status] ?? ""}</VisuallyHidden>
        {showFilter && (
          <Box px={3} pb={2}>
            <Input
              type="search"
              size="sm"
              placeholder="Filter workspaces…"
              aria-label="Filter workspaces"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </Box>
        )}
        {status === "loading" && (
          <Stack px={3} py={2} gap={2} aria-busy="true">
            <Skeleton height="24px" borderRadius="md" />
            <Skeleton height="24px" borderRadius="md" />
          </Stack>
        )}
        {status === "error" && (
          <Box px={3} py={2}>
            <InlineErrorAlert title="Couldn't load workspaces" description={error?.message} />
            <Button size="sm" mt={2} onClick={() => refetch()}>
              Retry
            </Button>
          </Box>
        )}
        {status === "success" && (
          <MenuRadioItemGroup
            value={activeValue}
            title="Switch workspace"
            onValueChange={(e) => handleSelect(e.value)}
          >
            <MenuRadioItem value={PERSONAL_VALUE}>Personal</MenuRadioItem>
            {visibleWorkspaces.map((workspace) => (
              <MenuRadioItem key={workspace.id} value={workspace.slug}>
                <Text as="span" lineClamp={1}>
                  {workspace.name}
                </Text>
              </MenuRadioItem>
            ))}
            {showFilter && visibleWorkspaces.length === 0 && (
              <Text px={3} py={2} fontSize="sm" color="fg.muted">
                No matching workspaces.
              </Text>
            )}
          </MenuRadioItemGroup>
        )}
        <MenuSeparator />
        {workspaceSlug && (
          <MenuItem
            value="workspace-settings"
            onClick={() => navigate(pages.workspaceSettings(workspaceSlug))}
          >
            <FaGear />
            {activeName} settings
          </MenuItem>
        )}
        <MenuItem value="create-workspace" onClick={onCreateWorkspace}>
          <FaPlus />
          Create workspace
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
};
