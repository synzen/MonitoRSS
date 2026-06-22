import { Box, Stack, Text } from "@chakra-ui/react";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
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
  // Subtle, rounded surface frames the slider as a grouped control. A hairline
  // border carries the grouping even where bg.subtle sits close to the dialog
  // surface (it reads as flat otherwise). The buy-flow slider gets matching
  // tint/rounding from its enclosing accordion, so the inner padding here matches
  // that accordion body (px7/pt2/pb7) and both read alike. Horizontal padding
  // clears the end thumbs/labels (at 0% and 100% of the track) from the box edges;
  // bottom padding seats the mark labels below the track.
  <Box
    bg="bg.subtle"
    borderWidth="1px"
    borderColor="border.emphasized"
    rounded="l3"
    px={7}
    pt={2}
    pb={7}
  >
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
    px={5}
    py={4}
    aria-current={emphasized ? "true" : undefined}
  >
    {/* Spacing the eyebrow, the big feed count, and the price apart so the column
        breathes; with no gap the three lines collide and read as cramped. */}
    <Stack gap={1}>
      <Text fontSize="sm" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
        {heading}
      </Text>
      <Text fontSize="2xl" fontWeight="bold" lineHeight="1.1">
        {feeds} feeds
      </Text>
      {interval &&
        (price ? (
          <Text color="fg.muted">
            {price} / {interval}
          </Text>
        ) : (
          // The emphasized "After" column owns the live recurring price; show a
          // skeleton the height of the price line while it loads so the row holds
          // its shape without a spinner's "working" connotation or layout shift
          // (the container's aria-busy covers assistive tech). The non-emphasized
          // "Now" column passes no interval, so it never renders this.
          emphasized && <Skeleton height="6" width="32" aria-hidden />
        ))}
    </Stack>
  </Box>
);

// The live price + capacity line that sits with the slider. The price and feed
// count change together as the slider moves and neither announces on its own, so
// the pair is a polite live region read once it settles. aria-busy holds the
// announcement until the debounced price resolves so an in-flight figure does not
// read as final, and the loading skeleton is decorative.
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
  // shows a skeleton until that preview lands; there is no per-detent "updating"
  // state. aria-busy holds the announcement until the first price is ready.
  <Box aria-live="polite" aria-busy={!price}>
    <Text fontSize={{ base: "3xl", md: "4xl" }} fontWeight="bold" lineHeight="1" color="text.link">
      {price ?? <Skeleton height="10" width="40" aria-hidden />}
    </Text>
    <Text color="fg.muted" mt={1}>
      {feeds} feeds / {interval === "month" ? "month" : "year"}
    </Text>
  </Box>
);
