import { useState } from "react";
import {
  Box,
  Card,
  HStack,
  Heading,
  Link,
  Separator,
  Stack,
  Text,
  Spinner,
} from "@chakra-ui/react";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { Slider } from "@/components/ui/slider";
import {
  useWorkspaceSliderPrice,
  WORKSPACE_DETENTS,
  WORKSPACE_FEATURES,
  FeatureRow,
} from "@/shared/workspaceCapacity";

// FeatureRow is defined once in the shared capacity module; re-export it here so
// the sibling PricingDialog/index.tsx keeps importing it from this panel.
export { FeatureRow };

// New user-facing copy uses periods/commas, no em dashes (project convention).
// "Team" is the plan you buy; "workspace" is the place you operate in once you
// have it. The subhead names the workspace as the what-you-get noun, not as a
// plan name and not as a feature bullet.
const TEAM_PLAN_TITLE = "Team";
const TEAM_PLAN_SUBHEAD = "Create a shared workspace to co-manage feeds with others.";
const WORKSPACE_REASSURANCE =
  "Working alone? A workspace of one gives you all of this. Invite people later.";

// Shown when the viewer already owns a workspace that needs billing (never
// activated, or cancelled): the CTA takes them there to subscribe rather than
// offering to create another. Copy avoids "finish"/"reactivate" so it reads
// true whether they are subscribing for the first time or coming back.
const OWNER_CTA_LABEL = "Go to your workspace";
const OWNER_REASSURANCE = "You already have a workspace. Pick your capacity and subscribe there.";

const WORKSPACE_SLIDER_LABEL = "How many feeds do you need?";
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
  baseWorkspacePrice,
  getChargePreview,
  workspacesEnabled,
  ownsWorkspaceNeedingBilling,
  onCreateWorkspace,
  onGoToWorkspace,
}: {
  interval: "month" | "year";
  baseWorkspacePrice: string | undefined;
  getChargePreview: (
    items: Array<{ priceId: string; quantity: number }>,
  ) => Promise<{ totalFormatted: string }>;
  workspacesEnabled: boolean;
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
  const { price, isUpdating } = useWorkspaceSliderPrice({
    feeds,
    interval,
    baseWorkspacePrice,
    getChargePreview,
  });

  const intervalSuffix = interval === "month" ? "per month" : "per year";

  return (
    <Card.Root size="lg" flex="1" borderWidth="2px" borderColor="brandSolid" position="relative">
      <Card.Header pb={0}>
        <Stack gap={1}>
          <Heading size="md">{TEAM_PLAN_TITLE}</Heading>
          <Text color="fg.muted" fontSize="sm">
            {TEAM_PLAN_SUBHEAD}
          </Text>
        </Stack>
      </Card.Header>
      <Card.Body>
        <Stack gap={6}>
          {/* Hero live price + capacity. Only the price and the feed/interval
              line are live (they change with the slider); the static "works solo
              or shared" marketing line sits OUTSIDE the live region so it is not
              re-announced on every step. aria-busy holds the announcement until
              the debounced price lands. */}
          <Box>
            <Box aria-live="polite" aria-busy={isUpdating}>
              <HStack gap={2} alignItems="flex-end">
                <Text
                  fontSize={{ base: "4xl", md: "6xl" }}
                  fontWeight="bold"
                  lineHeight="1"
                  color="text.link"
                  opacity={isUpdating ? 0.65 : 1}
                >
                  {price ?? <Spinner size="lg" />}
                </Text>
                {isUpdating && <Spinner size="sm" aria-hidden mb={2} />}
              </HStack>
              <Text color="fg.muted" mt={1}>
                {feeds} feeds {intervalSuffix}.
              </Text>
            </Box>
            <Text color="fg.muted">Works solo or shared with members.</Text>
          </Box>
          <Box bg="bg.subtle" rounded="l3" p={4}>
            <Slider
              label={WORKSPACE_SLIDER_LABEL}
              min={0}
              max={WORKSPACE_SLIDER_MAX_INDEX}
              step={1}
              value={[detentIndex]}
              onValueChange={(d) => setDetentIndex(d.value[0])}
              // The thumb's raw value is a detent index; announce the feed count
              // it maps to so a screen-reader user hears "140 feeds", not "2".
              getAriaValueText={(d) => `${WORKSPACE_DETENTS[d.value]} feeds`}
              marks={WORKSPACE_SLIDER_MARKS}
            />
          </Box>
          <Separator />
          <Stack as="ul" listStyleType="none" gap={2}>
            {WORKSPACE_FEATURES.map((feature) => (
              <FeatureRow key={feature} included>
                {feature}
              </FeatureRow>
            ))}
          </Stack>
          {workspacesEnabled ? (
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
          ) : (
            // Workspaces are not yet enabled for this account, so the priced
            // slider has no action to offer. Say so plainly instead of leaving a
            // dead-end control, and give a way forward.
            <Text fontSize="sm" color="fg.muted" textAlign="center">
              Workspaces aren&apos;t available on your account yet. Contact us at{" "}
              <Link color="text.link" href="mailto:support@monitorss.xyz">
                support@monitorss.xyz
              </Link>{" "}
              to get early access.
            </Text>
          )}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
};
