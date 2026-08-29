import { useEffect, useRef, useState } from "react";
import {
  Box,
  Card,
  Heading,
  Separator,
  Stack,
  Text,
  Spinner,
  VisuallyHidden,
} from "@chakra-ui/react";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import {
  AccordionItem,
  AccordionItemContent,
  AccordionItemTrigger,
  AccordionRoot,
} from "@/components/ui/accordion";
import {
  useWorkspaceSliderPrice,
  formatWorkspaceFeedNumber,
  WORKSPACE_BASE_FEEDS,
  WORKSPACE_MAX_FEEDS,
  CapacityPicker,
  WORKSPACE_FEATURES,
  WorkspaceFeatureRow,
  FeatureRow,
  WorkspaceFeedPricing,
} from "@/shared/workspaceCapacity";

// FeatureRow is defined once in the shared capacity module; re-export it here so
// the sibling PricingDialog/index.tsx keeps importing it from this panel.
export { FeatureRow };

// New user-facing copy uses periods/commas, no em dashes (project convention).
// "Team" is the plan you buy; "workspace" is the place you operate in once you
// have it. The subhead names the workspace as the what-you-get noun, not as a
// plan name and not as a feature bullet.
const TEAM_PLAN_TITLE = "Team";
// Leads with the collaboration value (co-management with no per-person feed-limit
// tax), not feed capacity: prod data shows almost no one needs the high feed
// counts, but co-management is widespread.
const TEAM_PLAN_HEADLINE = "Share feeds without using up anyone's limit.";
const TEAM_PLAN_SUBHEAD =
  "Shared feeds belong to the workspace, so they don't count against anyone's personal limit.";
const WORKSPACE_REASSURANCE =
  "Working alone? A workspace of one gives you all of this. Invite people later.";
// The CTA names the action, not a feed count: putting the number on the most
// decisive control re-anchors the purchase on capacity at the worst moment. The
// chosen capacity still travels into the create/billing flow via onCreateWorkspace.
const CREATE_WORKSPACE_CTA = "Create your workspace";

// Shown when the viewer already owns a workspace that needs billing (never
// activated, or cancelled): the CTA takes them there to subscribe rather than
// offering to create another. Copy avoids "finish"/"reactivate" so it reads
// true whether they are subscribing for the first time or coming back.
const OWNER_CTA_LABEL = "Go to your workspace";
const OWNER_REASSURANCE = "You already have a workspace. Pick your capacity and subscribe there.";

// The capacity line frames the base feed count as a FLOOR you start at and add
// to, not a ceiling you'll waste: leading with a raw count invites the
// "I only need a few, so this is overpriced" reflex (the same one that sinks
// per-feed competitors). "Add more anytime" names that capacity is yours to grow
// with no commitment, so the number reads as a starting point, not a quantity
// you're overbuying.
const WORKSPACE_CAPACITY_LINE = `Starts at ${formatWorkspaceFeedNumber(
  WORKSPACE_BASE_FEEDS,
)} feeds and scales to ${formatWorkspaceFeedNumber(WORKSPACE_MAX_FEEDS)}. Add more anytime.`;
const WORKSPACE_SIZER_TITLE = "Add more feeds";
const WORKSPACE_SIZER_ACCORDION_VALUE = "sizer";
export const WorkspacePanel = ({
  interval,
  pricing,
  ownsWorkspaceNeedingBilling,
  defaultSizerOpen = false,
  onCreateWorkspace,
  onGoToWorkspace,
}: {
  interval: "month" | "year";
  // The base + per-feed unit prices from the page-level preview, for the current
  // interval. Undefined while that preview is still loading.
  pricing: WorkspaceFeedPricing | undefined;
  // Whether the capacity sizer starts expanded. Defaults to collapsed (capacity
  // is demoted under the collaboration pitch); the parent opens it when the
  // dialog is opened from the feed-limit wall, where capacity is the user's
  // intent, so the picker they came for is in front of them without a click.
  defaultSizerOpen?: boolean;
  // The viewer already owns a workspace that needs billing (never activated, or
  // cancelled), so the CTA reroutes to it to subscribe instead of offering to
  // create another. An owner of only already-paid workspaces can still create,
  // so this is false for them.
  ownsWorkspaceNeedingBilling: boolean;
  onCreateWorkspace: (feedCount: number) => void;
  onGoToWorkspace: (feedCount: number) => void;
}) => {
  const [feeds, setFeeds] = useState(WORKSPACE_BASE_FEEDS);
  const { price } = useWorkspaceSliderPrice({ feeds, pricing });

  const intervalSuffix = interval === "month" ? "per month" : "per year";
  const [priceAnnouncement, setPriceAnnouncement] = useState("");
  const isFirstFeedsRender = useRef(true);

  useEffect(() => {
    if (isFirstFeedsRender.current) {
      isFirstFeedsRender.current = false;

      return;
    }

    if (price) {
      setPriceAnnouncement(`${price} ${intervalSuffix}.`);
    }
  }, [feeds]);

  return (
    <Card.Root size="lg" flex="1" borderWidth="2px" borderColor="brandSolid" position="relative">
      <Card.Header pb={0}>
        <Stack gap={1}>
          <Heading size="md">{TEAM_PLAN_TITLE}</Heading>
          <Text fontSize="lg" fontWeight="semibold">
            {TEAM_PLAN_HEADLINE}
          </Text>
          <Text color="fg.muted" fontSize="sm">
            {TEAM_PLAN_SUBHEAD}
          </Text>
        </Stack>
      </Card.Header>
      <Card.Body>
        <Stack gap={6}>
          <Box>
            <Box aria-busy={!price}>
              <Text fontSize={{ base: "4xl", md: "6xl" }} fontWeight="bold" lineHeight="1">
                {price ?? <Spinner size="lg" aria-label="Loading price" />}
              </Text>
              <Text color="fg.muted" mt={1}>
                {intervalSuffix}
              </Text>
            </Box>
            <Text color="fg.muted">{WORKSPACE_CAPACITY_LINE}</Text>
            <VisuallyHidden aria-live="polite">{priceAnnouncement}</VisuallyHidden>
          </Box>
          <AccordionRoot
            collapsible
            defaultValue={defaultSizerOpen ? [WORKSPACE_SIZER_ACCORDION_VALUE] : []}
            bg="bg.subtle"
            rounded="l3"
            borderWidth="1px"
            borderColor="border"
          >
            <AccordionItem value={WORKSPACE_SIZER_ACCORDION_VALUE} border="none">
              {/* The trigger must read as a control, not plain text blended into
                  the card: a hover/expanded background and a divider under the
                  open state give it a clear clickable affordance. */}
              <AccordionItemTrigger
                px={4}
                py={3}
                rounded="l3"
                cursor="pointer"
                _hover={{ bg: "bg.emphasized" }}
                _open={{ bg: "bg.emphasized", roundedBottom: "none" }}
              >
                <Text fontWeight="semibold">{WORKSPACE_SIZER_TITLE}</Text>
              </AccordionItemTrigger>
              {/* The accordion body recipe zeroes/owns its own inline padding, so
                  the slider needs an explicit padded Box to get horizontal room
                  and clearance for the end detent labels. The open trigger's bg
                  already separates the two, so no top divider is needed. */}
              <AccordionItemContent px={0} pb={0}>
                <Box px={7} pt={2} pb={7}>
                  <CapacityPicker value={feeds} onChange={setFeeds} />
                </Box>
              </AccordionItemContent>
            </AccordionItem>
          </AccordionRoot>
          <Separator />
          <Stack as="ul" listStyleType="none" gap={2}>
            {WORKSPACE_FEATURES.map((feature) => (
              <WorkspaceFeatureRow key={feature.label} feature={feature} />
            ))}
          </Stack>
          <Stack gap={2}>
            <PrimaryActionButton
              width="100%"
              size="lg"
              onClick={() =>
                ownsWorkspaceNeedingBilling ? onGoToWorkspace(feeds) : onCreateWorkspace(feeds)
              }
            >
              {ownsWorkspaceNeedingBilling ? OWNER_CTA_LABEL : CREATE_WORKSPACE_CTA}
            </PrimaryActionButton>
            <Text fontSize="xs" color="fg.muted" textAlign="center">
              {ownsWorkspaceNeedingBilling ? OWNER_REASSURANCE : WORKSPACE_REASSURANCE}
            </Text>
          </Stack>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
};
