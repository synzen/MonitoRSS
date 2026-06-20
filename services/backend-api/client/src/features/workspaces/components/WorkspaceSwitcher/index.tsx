import { useMemo, useState } from "react";
import {
  Box,
  Button,
  HStack,
  Icon,
  Input,
  Skeleton,
  Stack,
  Text,
  VisuallyHidden,
} from "@chakra-ui/react";
import { FaChevronDown, FaGear, FaPlus, FaUser, FaUsers } from "react-icons/fa6";
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
const SCOPE_GROUP_LABEL_ID = "workspace-switcher-scope-label";

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
  const isPersonalScope = !workspaceSlug;
  const activeName = useMemo(() => {
    if (!workspaceSlug) {
      return "Personal";
    }

    return workspaces?.find((t) => t.slug === workspaceSlug)?.name ?? "Workspace";
  }, [workspaceSlug, workspaces]);
  const ActiveScopeIcon = isPersonalScope ? FaUser : FaUsers;

  const visibleWorkspaces = useMemo(() => {
    if (!workspaces || workspaces.length <= FILTER_THRESHOLD || !filter.trim()) {
      return workspaces ?? [];
    }

    const q = filter.trim().toLowerCase();

    return workspaces.filter((t) => t.name.toLowerCase().includes(q));
  }, [workspaces, filter]);

  const showFilter = (workspaces?.length ?? 0) > FILTER_THRESHOLD;
  // First-run discovery: with no workspaces yet, the create action carries a one-line
  // pitch so the switcher doubles as the entry point into teams.
  const hasNoWorkspaces = status === "success" && (workspaces?.length ?? 0) === 0;
  // At 0 workspaces "Personal" is meaningless (there's no peer scope to contrast
  // against), so the pill describes what the user is actually looking at. The
  // accessible name stays "Personal" — the switcher's job is unchanged; only the
  // teaching label differs. Once a workspace exists, the contrast makes "Personal"
  // meaningful and the labels converge.
  const triggerLabel = hasNoWorkspaces && isPersonalScope ? "My feeds" : activeName;
  const scopeGroupLabel = hasNoWorkspaces ? "Your feeds" : "Switch scope";

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
        {/* Neutral scope pill: a self-contained control that reads as clickable at rest
            (resting fill + edge), not a breadcrumb label. The leading scope icon flips
            person<->people on switch, teaching that Personal is one scope among peers. */}
        <Button
          variant="subtle"
          size="md"
          maxW="240px"
          fontSize="md"
          fontWeight="medium"
          aria-label={`Switch workspace, current: ${activeName}`}
        >
          <Icon as={ActiveScopeIcon} boxSize={4} color="fg.muted" flexShrink={0} />
          {/* Label collapses on narrow widths; icon + chevron stay a legible target. */}
          <Text as="span" lineClamp={1} display={{ base: "none", sm: "inline" }}>
            {triggerLabel}
          </Text>
          <Icon as={FaChevronDown} boxSize={3} flexShrink={0} />
        </Button>
      </MenuTrigger>
      <MenuContent minW="260px" maxH="420px" overflowY="auto">
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
            aria-labelledby={SCOPE_GROUP_LABEL_ID}
            onValueChange={(e) => handleSelect(e.value)}
          >
            <Box
              id={SCOPE_GROUP_LABEL_ID}
              px={3}
              py={1}
              fontSize="xs"
              fontWeight="semibold"
              textTransform="uppercase"
              letterSpacing="wide"
              color="fg.muted"
            >
              {scopeGroupLabel}
            </Box>
            <MenuRadioItem value={PERSONAL_VALUE}>
              <HStack gap={2} minW={0}>
                <Icon as={FaUser} boxSize={3.5} color="fg.muted" flexShrink={0} />
                <Text as="span">Personal</Text>
              </HStack>
            </MenuRadioItem>
            {visibleWorkspaces.map((workspace) => (
              <MenuRadioItem key={workspace.id} value={workspace.slug}>
                <HStack gap={2} minW={0}>
                  <Icon as={FaUsers} boxSize={3.5} color="fg.muted" flexShrink={0} />
                  <Text as="span" lineClamp={1}>
                    {workspace.name}
                  </Text>
                </HStack>
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
        {/* At 0 workspaces this is the menu's primary action, so it's emphasized with a
            brand tint and the two-line pitch; once workspaces exist it recedes to a
            plain item, since switching (not creating) is then the common task. */}
        <MenuItem
          value="create-workspace"
          onClick={onCreateWorkspace}
          color={hasNoWorkspaces ? "brand.fg" : undefined}
          _hover={hasNoWorkspaces ? { bg: "brand.subtle" } : undefined}
        >
          <FaPlus />
          {hasNoWorkspaces ? (
            <Stack gap={0}>
              <Text as="span">Create a workspace</Text>
              <Text as="span" fontSize="xs" color="fg.muted">
                Collaborate with a team
              </Text>
            </Stack>
          ) : (
            "Create a workspace"
          )}
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
};
