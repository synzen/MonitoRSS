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
import { Slider } from "@/components/ui/slider";
import {
  AccordionItem,
  AccordionItemContent,
  AccordionItemTrigger,
  AccordionRoot,
} from "@/components/ui/accordion";
import {
  useWorkspaceSliderPrice,
  WORKSPACE_DETENTS,
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

// Shown when the viewer already owns a workspace that needs billing (never
// activated, or cancelled): the CTA takes them there to subscribe rather than
// offering to create another. Copy avoids "finish"/"reactivate" so it reads
// true whether they are subscribing for the first time or coming back.
const OWNER_CTA_LABEL = "Go to your workspace";
const OWNER_REASSURANCE = "You already have a workspace. Pick your capacity and subscribe there.";

const WORKSPACE_SLIDER_LABEL = "How many feeds do you need?";
// The sizer is a collapsible "size it once you've decided" utility so capacity
// stays demoted under the collaboration pitch. The trigger shows the live price
// of the current detent so the cost is visible without the slider open.
const WORKSPACE_SIZER_TITLE = "Size your plan";
const WORKSPACE_SIZER_ACCORDION_VALUE = "sizer";
// The slider domain is the detent INDEX (0..n-1), so each step is one detent and
// every tick is a real, reachable stop. Labels show the feed count at each index;
// the top detent reads "N+" since it represents that capacity and beyond.
const WORKSPACE_SLIDER_MAX_INDEX = WORKSPACE_DETENTS.length - 1;
const WORKSPACE_SLIDER_MARKS = WORKSPACE_DETENTS.map((value, index) => ({
  value: index,
  label: index === WORKSPACE_SLIDER_MAX_INDEX ? `${value}+` : `${value}`,
}));

// The dominant Workspace panel: a capacity slider drives a live hero price (from
// Paddle previews) and a CTA that names the chosen feed count. The slider always
// buys the base workspace tier plus a per-feed add-on for the overage (see
// useWorkspaceSliderPrice), so every value maps to a real purchasable item set.
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
  // interval. Undefined while that preview is still loading. The slider derives
  // every detent from these with no Paddle call of its own.
  pricing: WorkspaceFeedPricing | undefined;
  // Whether the capacity sizer starts expanded. Defaults to collapsed (capacity
  // is demoted under the collaboration pitch); the parent opens it when the
  // dialog is opened from the feed-limit wall, where capacity is the user's
  // intent, so the slider they came for is in front of them without a click.
  defaultSizerOpen?: boolean;
  // The viewer already owns a workspace that needs billing (never activated, or
  // cancelled), so the CTA reroutes to it to subscribe instead of offering to
  // create another. An owner of only already-paid workspaces can still create,
  // so this is false for them.
  ownsWorkspaceNeedingBilling: boolean;
  onCreateWorkspace: (feedCount: number) => void;
  onGoToWorkspace: (feedCount: number) => void;
}) => {
  // The slider is driven by detent INDEX (0..n-1, step 1), not raw feed counts.
  // Indexing makes every arrow-key press land on a real detent and move cleanly
  // in both directions, which a controlled slider snapping arbitrary feed counts
  // cannot do (it desyncs from Chakra's step grid and traps the keyboard).
  const [detentIndex, setDetentIndex] = useState(0);
  const feeds = WORKSPACE_DETENTS[detentIndex];
  const { price } = useWorkspaceSliderPrice({ feeds, pricing });

  const intervalSuffix = interval === "month" ? "per month" : "per year";

  // Announcing the price when the slider moves is the goal, but the visible price
  // can't be a live region: it also depends on the Monthly/Yearly switch (in a
  // different region of the dialog), so making it live means toggling that switch
  // announces the Team price even though the user never went near this panel. The
  // slider thumb already announces the feed count via aria-valuetext, so the only
  // thing left to speak on a capacity change is the price. Drive a dedicated
  // hidden announcer off the feed count alone: it fires on slider moves and is
  // immune to interval toggles (interval changes the price, never the feed count).
  // Politeness stays fixed, which is what assistive tech expects. The first
  // detent on mount is skipped so the panel doesn't announce on open.
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
    // Keyed on the feed count only: interval changes must not trigger an
    // announcement, and the suffix is read from the latest render when they do.
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
          {/* Hero price + capacity. The price and the feed/interval line update as
              the slider moves (instantly, from the already-fetched preview). The
              visible text is NOT a live region: it also tracks the Monthly/Yearly
              switch, so making it live would announce this panel's price when the
              user toggles that switch elsewhere. Slider-driven price changes are
              spoken by the dedicated hidden announcer below instead. */}
          <Box>
            <Box aria-busy={!price}>
              <Text fontSize={{ base: "4xl", md: "6xl" }} fontWeight="bold" lineHeight="1">
                {price ?? <Spinner size="lg" aria-label="Loading price" />}
              </Text>
              <Text color="fg.muted" mt={1}>
                {feeds} feeds {intervalSuffix}.
              </Text>
            </Box>
            <Text color="fg.muted">Works solo or shared with members.</Text>
            {/* Speaks only the price on a capacity change; the feed count is
                already announced by the slider thumb's aria-valuetext. */}
            <VisuallyHidden aria-live="polite">{priceAnnouncement}</VisuallyHidden>
          </Box>
          {/* The sizer is collapsible so capacity stays demoted under the
              collaboration pitch. The trigger shows the live price of the
              current detent, so the cost is visible without opening it. */}
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
                  <Slider
                    label={WORKSPACE_SLIDER_LABEL}
                    min={0}
                    max={WORKSPACE_SLIDER_MAX_INDEX}
                    step={1}
                    value={[detentIndex]}
                    onValueChange={(d) => setDetentIndex(d.value[0])}
                    // The thumb's raw value is a detent index; announce the feed
                    // count it maps to so a screen-reader user hears "140 feeds",
                    // not "2".
                    getAriaValueText={(d) => `${WORKSPACE_DETENTS[d.value]} feeds`}
                    marks={WORKSPACE_SLIDER_MARKS}
                  />
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
              {ownsWorkspaceNeedingBilling
                ? OWNER_CTA_LABEL
                : `Create workspace for ${feeds} feeds`}
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
