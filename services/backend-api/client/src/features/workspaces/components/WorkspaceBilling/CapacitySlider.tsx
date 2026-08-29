import { Box, Stack, Text } from "@chakra-ui/react";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { WORKSPACE_DETENTS, formatWorkspaceFeedCount } from "@/shared/workspaceCapacity";

const MAX_INDEX = WORKSPACE_DETENTS.length - 1;

const MARKS = WORKSPACE_DETENTS.map((value, index) => ({
  value: index,
  label: `${value}`,
}));

export const detentIndexForFeeds = (feeds: number) => {
  const idx = WORKSPACE_DETENTS.findIndex((d) => d >= feeds);

  return idx === -1 ? MAX_INDEX : idx;
};

export const feedsForDetentIndex = (index: number) => WORKSPACE_DETENTS[index];

export const WORKSPACE_SLIDER_LABEL = "How many feeds do you need?";

// The change-capacity dialog's coarse detent slider. This is the one surface
// still on a detent model — the buy surfaces (pricing dialog, activation) use
// the exact-entry CapacityPicker — and the slice-2 picker rework of this dialog
// retires the slider entirely. Detent index drives the slider so every
// arrow-key press lands on a real stop; aria-valuetext announces the mapped
// feed count so a screen-reader user hears "140 feeds", not "2". The last
// detent is the workspace capacity ceiling (1,100), so even capacities above
// the other detents can still be raised.
export const CapacitySlider = ({
  index,
  onChange,
}: {
  index: number;
  onChange: (index: number) => void;
}) => (
  // Subtle, rounded surface frames the slider as a grouped control. A hairline
  // border carries the grouping even where bg.subtle sits close to the dialog
  // surface (it reads as flat otherwise). Horizontal padding clears the end
  // thumbs/labels (at 0% and 100% of the track) from the box edges; bottom
  // padding seats the mark labels below the track.
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
  showPrice = true,
}: {
  heading: string;
  feeds: number;
  price?: string;
  interval?: "month" | "year";
  emphasized?: boolean;
  showPrice?: boolean;
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
        {formatWorkspaceFeedCount(feeds)}
      </Text>
      {showPrice &&
        interval &&
        (price ? (
          <Text color="fg.muted">
            {price} / {interval}
          </Text>
        ) : (
          // Both columns show a skeleton the height of the price line while it
          // loads so the row holds its shape without a spinner's "working"
          // connotation or layout shift (the container's aria-busy covers
          // assistive tech).
          <Skeleton height="6" width="32" aria-hidden />
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
      {formatWorkspaceFeedCount(feeds)} / {interval === "month" ? "month" : "year"}
    </Text>
  </Box>
);
