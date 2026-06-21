import { Box, Spinner, Text } from "@chakra-ui/react";
import { Slider } from "@/components/ui/slider";
import { WORKSPACE_DETENTS } from "@/shared/workspaceCapacity";

// Coarse capacity detents drive the slider; the slider's domain is the detent
// INDEX (0..n-1, step 1), not raw feed counts, so every arrow-key press lands on
// a real, purchasable anchor and moves cleanly in both directions. The label
// shows the feed count at each index; the top detent reads "N+" since it
// represents that capacity and beyond.
const MAX_INDEX = WORKSPACE_DETENTS.length - 1;

const MARKS = WORKSPACE_DETENTS.map((value, index) => ({
  value: index,
  label: index === MAX_INDEX ? `${value}+` : `${value}`,
}));

// The smallest detent index whose feed count is at least the given count, so a
// current capacity that is not exactly a detent seats on the next detent up and
// is never silently downgraded.
export const detentIndexForFeeds = (feeds: number) => {
  const idx = WORKSPACE_DETENTS.findIndex((d) => d >= feeds);

  return idx === -1 ? MAX_INDEX : idx;
};

export const feedsForDetentIndex = (index: number) => WORKSPACE_DETENTS[index];

export const WORKSPACE_SLIDER_LABEL = "How many feeds do you need?";

// The capacity slider, shared by the activation (buy) and change-capacity
// (manage) surfaces so both express capacity the same way. Driven by detent
// index; announces the mapped feed count as aria-valuetext so a screen-reader
// user hears "140 feeds", not "2".
export const CapacitySlider = ({
  index,
  onChange,
}: {
  index: number;
  onChange: (index: number) => void;
}) => (
  // Extra horizontal padding so the end thumbs/labels (at 0% and 100% of the
  // track) clear the box edges instead of sitting flush against them, and extra
  // bottom padding to seat the mark labels that render below the track.
  <Box bg="bg.subtle" rounded="l3" px={6} pt={4} pb={6}>
    <Slider
      label={WORKSPACE_SLIDER_LABEL}
      min={0}
      max={MAX_INDEX}
      step={1}
      value={[index]}
      onValueChange={(d) => onChange(d.value[0])}
      getAriaValueText={(d) => `${WORKSPACE_DETENTS[d.value]} feeds`}
      marks={MARKS}
    />
  </Box>
);

// One column of the "Now -> After" decrease diff. Visual only; the dialog carries
// the same facts in an sr-only sentence, so this is aria-hidden by its container.
// The emphasized "After" column states its selected role via aria-current so the
// distinction is not border-color alone (though the container hides it from AT).
export const CapacityCompareColumn = ({
  heading,
  feeds,
  price,
  interval,
  emphasized,
}: {
  heading: string;
  feeds: number;
  price?: string;
  interval?: "month" | "year";
  emphasized?: boolean;
}) => (
  <Box
    flex="1"
    borderWidth={emphasized ? "2px" : "1px"}
    borderColor={emphasized ? "brandSolid" : "border.emphasized"}
    rounded="md"
    p={4}
    aria-current={emphasized ? "true" : undefined}
  >
    <Text fontSize="sm" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
      {heading}
    </Text>
    <Text fontSize="2xl" fontWeight="bold">
      {feeds} feeds
    </Text>
    {price && interval && (
      <Text color="fg.muted">
        {price} / {interval}
      </Text>
    )}
  </Box>
);

// The live price + capacity line that sits with the slider. The price and feed
// count change together as the slider moves and neither announces on its own, so
// the pair is a polite live region read once it settles. aria-busy holds the
// announcement until the debounced price resolves so an in-flight figure does not
// read as final, and the spinner is decorative.
export const CapacitySummary = ({
  feeds,
  price,
  interval,
}: {
  feeds: number;
  price: string | undefined;
  interval: "month" | "year";
}) => (
  // The price is derived instantly from the already-fetched preview, so it only
  // shows a spinner until that preview lands; there is no per-detent "updating"
  // state. aria-busy holds the announcement until the first price is ready.
  <Box aria-live="polite" aria-busy={!price}>
    <Text fontSize={{ base: "3xl", md: "4xl" }} fontWeight="bold" lineHeight="1" color="text.link">
      {price ?? <Spinner size="md" aria-label="Loading price" />}
    </Text>
    <Text color="fg.muted" mt={1}>
      {feeds} feeds / {interval === "month" ? "month" : "year"}
    </Text>
  </Box>
);
