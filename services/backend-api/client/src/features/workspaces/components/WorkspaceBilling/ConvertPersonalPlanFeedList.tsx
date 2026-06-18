import {
  Box,
  Button,
  Center,
  Flex,
  HStack,
  IconButton,
  Input,
  InputGroup,
  Progress,
  Spinner,
  Stack,
  Text,
  VisuallyHidden,
  chakra,
} from "@chakra-ui/react";
import { FaMagnifyingGlass, FaXmark } from "react-icons/fa6";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { captureException } from "@sentry/react";
import { useUserFeedsInfinite } from "../../../feed/hooks/useUserFeedsInfinite";
import { getUserFeeds } from "../../../feed/api";
import { InlineErrorAlert } from "@/components";
import { Checkbox } from "@/components/ui/checkbox";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";

const LIMIT = 25;

type KeepDirection = "newest" | "oldest";

interface Props {
  // The feeds the owner has chosen to move. Owned by the dialog so it can drive
  // the over-capacity guard and the conversion payload.
  selectedIds: Set<string>;
  onSelectedIdsChange: (next: Set<string>) => void;
  // The moving plan's feed limit. When the owner has more feeds than this, the
  // list opens empty (the owner triages which to bring) and the bulk actions
  // fill selection only up to this cap.
  feedLimit: number;
  // Lets the dialog react once the total is known (e.g. to frame the over-limit
  // case) without re-deriving it.
  onLoaded?: (info: { total: number; overLimit: boolean }) => void;
}

export const ConvertPersonalPlanFeedList = ({
  selectedIds,
  onSelectedIdsChange,
  feedLimit,
  onLoaded,
}: Props) => {
  const [searchInput, setSearchInput] = useState("");
  const [keep, setKeep] = useState<KeepDirection>("newest");
  const {
    data,
    error,
    status,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    setSearch,
    isFetching,
    search,
  } = useUserFeedsInfinite(
    // Oldest-first for a stable, deterministic display order across pages.
    { limit: LIMIT, sort: "createdAt" },
    { forcePersonal: true },
  );

  const totalCount = data?.pages[0]?.total;
  const browseFeeds = data?.pages.flatMap((p) => p.results) ?? [];
  const fetchedSoFarCount = browseFeeds.length;

  // The owner's full feed count, latched from the unsearched query. `totalCount`
  // reflects the *filtered* total during a search, so deriving over-limit from it
  // would make the capacity meter vanish whenever a search narrows below the cap.
  // The over-limit framing is a property of the whole account, not the current
  // filter, so it must come from the unfiltered total.
  const fullTotalRef = useRef<number | undefined>(undefined);

  if (!search && totalCount !== undefined) {
    fullTotalRef.current = totalCount;
  }

  const fullTotal = fullTotalRef.current;
  const overLimit = fullTotal !== undefined && fullTotal > feedLimit;

  // After an auto-pick, the chosen feeds (which may live off-screen — the newest
  // sit at the tail of the oldest-first browse list) are surfaced as their own
  // block above the browse list, so the result is immediately visible instead of
  // a count over empty-looking rows. Cleared the moment the owner hand-edits.
  const [pickedTop, setPickedTop] = useState<Array<{ id: string; title: string }> | null>(null);
  const [resultLine, setResultLine] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  // A single polite live region: bulk selection changes (and hitting the cap)
  // are otherwise silent to assistive tech, so each outcome is narrated here.
  const announceRef = useRef<HTMLDivElement | null>(null);

  const announce = (msg: string) => {
    if (announceRef.current) {
      announceRef.current.textContent = msg;
    }
  };

  // The picked-to-top block and its result line are framing for the full,
  // unsearched list. Once the owner searches, the list shows matches (not the
  // pinned picks), so the framing is dropped (and the stale announcement
  // cleared); the selection itself is untouched.
  useEffect(() => {
    if (search) {
      setPickedTop(null);
      setResultLine(null);
      announce("");
    }
  }, [search]);

  // Auto-pick fills to the cap, which swaps the header's action from the
  // "Select them for me" button (which the user just clicked) to "Clear
  // selection" — unmounting the focused button and dropping focus to the body.
  // We move focus to the Clear button (the action's successor) once it mounts,
  // so the keyboard/AT user is never stranded. The flag defers the focus past
  // the re-render that creates the button.
  const clearButtonRef = useRef<HTMLButtonElement | null>(null);
  const autoPickButtonRef = useRef<HTMLButtonElement | null>(null);
  const focusClearAfterPickRef = useRef(false);
  const focusAutoPickAfterClearRef = useRef(false);

  // Both bulk actions can unmount themselves on click (auto-pick fills the cap →
  // becomes Clear; Clear empties → becomes auto-pick), which would drop focus to
  // the body. After each swap, move focus to the action's successor once it
  // mounts, so the keyboard/AT user is never stranded. The flags defer focus
  // past the re-render that creates the new button.
  useEffect(() => {
    if (focusClearAfterPickRef.current && clearButtonRef.current) {
      focusClearAfterPickRef.current = false;
      clearButtonRef.current.focus();
    } else if (focusAutoPickAfterClearRef.current && autoPickButtonRef.current) {
      focusAutoPickAfterClearRef.current = false;
      autoPickButtonRef.current.focus();
    }
  });

  // Under the limit the safe default is "bring everything", which needs explicit
  // ids (the convert API moves an explicit list), so all feeds must be loaded
  // first — a bounded set, at most the plan limit. Over the limit there is no
  // sensible machine default ("which of your 104 feeds matter?" is the user's
  // call), so the list opens empty and the owner picks. `seededRef` makes the
  // bring-all default fire exactly once.
  const seededRef = useRef(false);
  const announcedLoadRef = useRef(false);

  useEffect(() => {
    if (status !== "success" || totalCount === undefined || search || seededRef.current) {
      return;
    }

    if (!announcedLoadRef.current) {
      announcedLoadRef.current = true;
      onLoaded?.({ total: totalCount, overLimit });
    }

    if (overLimit) {
      // No default selection; the owner chooses. Seed is considered done.
      seededRef.current = true;

      return;
    }

    // Under the limit: pull every page, then select all of them once.
    if (hasNextPage) {
      fetchNextPage();

      return;
    }

    seededRef.current = true;
    onSelectedIdsChange(new Set(browseFeeds.map((f) => f.id)));
  }, [status, totalCount, overLimit, hasNextPage, fetchedSoFarCount, search]);

  // The single accelerator: select the cap's worth by age in ONE targeted
  // request (the listing endpoint honors an arbitrary limit + sort), rather than
  // paging the whole list in. Bounded regardless of how many feeds the owner
  // has. The chosen feeds float to the top so the result is visible.
  const autoPick = async () => {
    setIsPicking(true);
    setPickError(null);

    try {
      const { results } = await getUserFeeds({
        limit: feedLimit,
        offset: 0,
        sort: keep === "newest" ? "-createdAt" : "createdAt",
      });
      // Auto-pick operates on the full account, and its picked-to-top result is
      // only visible on the unfiltered list — so clear any active search first.
      // Clearing to empty does not trigger the search effect that drops the pick
      // framing (that effect fires only when search becomes non-empty), so the
      // pickedTop set just below survives.
      setSearchInput("");
      setSearch("");
      onSelectedIdsChange(new Set(results.map((f) => f.id)));
      setPickedTop(results.map((f) => ({ id: f.id, title: f.title })));
      // The selection now fills the cap, so the header swaps this button for
      // "Clear selection"; hand focus there after the swap.
      focusClearAfterPickRef.current = true;
      const left = (fullTotal ?? results.length) - results.length;
      const line = `Selected your ${keep} ${results.length} feeds, shown first below.${
        left > 0 ? ` ${left} stay on your personal plan.` : ""
      }`;
      setResultLine(line);
      announce(line);
    } catch (err) {
      captureException(err);
      setPickError("Could not select your feeds automatically. Please pick them below.");
    } finally {
      setIsPicking(false);
    }
  };

  // Hand-editing freezes the order (no re-sort under the cursor) and dismisses
  // the auto-pick result framing.
  const clearPickFraming = () => {
    setPickedTop(null);
    setResultLine(null);
  };

  const toggle = (id: string, title: string) => {
    clearPickFraming();
    const next = new Set(selectedIds);

    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    const over = next.size - feedLimit;
    const verb = selectedIds.has(id) ? "Removed" : "Added";
    announce(
      over > 0
        ? `${verb} ${title}. ${next.size} of ${feedLimit}; remove ${over} to continue.`
        : `${verb} ${title}. ${feedLimit - next.size} slots left.`,
    );
    onSelectedIdsChange(next);
  };

  const clearAll = () => {
    clearPickFraming();
    onSelectedIdsChange(new Set());
    announce(`Cleared. ${feedLimit} slots left.`);
    // Clearing drops below the cap, so the header swaps this button back for the
    // auto-pick action; hand focus there after the swap.
    focusAutoPickAfterClearRef.current = true;
  };

  const remaining = feedLimit - selectedIds.size;
  const atCap = remaining === 0;
  const overBy = Math.max(0, selectedIds.size - feedLimit);
  const overCap = overBy > 0;

  // The rows to render: after an auto-pick, the picked feeds first (a bounded
  // block), then the browse list with the picked ones removed to avoid showing a
  // feed twice. Otherwise the plain browse list.
  const pickedIds = new Set(pickedTop?.map((f) => f.id));
  const browseRows = pickedTop ? browseFeeds.filter((f) => !pickedIds.has(f.id)) : browseFeeds;

  let searchEndElement: ReactNode;

  if (search && !isFetching) {
    searchEndElement = (
      <IconButton
        aria-label="Clear search"
        size="sm"
        variant="plain"
        color="fg.muted"
        onClick={() => {
          setSearchInput("");
          setSearch("");
        }}
      >
        <FaXmark />
      </IconButton>
    );
  } else if (search && isFetching) {
    searchEndElement = <Spinner size="sm" />;
  }

  const renderRow = (feed: { id: string; title: string }) => {
    const isSelected = selectedIds.has(feed.id);

    return (
      <Box key={`feed-${feed.id}`} as="li">
        {/* The checkbox's label is the feed TITLE only, so assistive tech
            announces "<title>, checkbox". The "Stays personal" cue is a sibling,
            not a child of the label, so it stays out of the accessible name —
            it's a purely visual hint, and the checked state already conveys
            "bring vs leave". */}
        <Checkbox
          width="100%"
          alignItems="flex-start"
          checked={isSelected}
          onCheckedChange={() => toggle(feed.id, feed.title)}
          required={false}
        >
          <chakra.span ml={2} display="block" fontSize="sm" fontWeight={600}>
            {feed.title}
          </chakra.span>
        </Checkbox>
        {/* Always rendered (reserving the line keeps row height stable on
            toggle) and aria-hidden; sits under the title via the checkbox's
            left padding. */}
        <chakra.span
          display="block"
          pl="calc(var(--chakra-spacing-6) + var(--chakra-spacing-2))"
          fontSize="xs"
          color="text.warning"
          visibility={isSelected ? "hidden" : "visible"}
          aria-hidden
        >
          Stays personal
        </chakra.span>
      </Box>
    );
  };

  return (
    <Stack gap={2}>
      {/* Selection outcomes are announced here once, under our control, rather
          than relying on individual checkbox state changes (which a bulk action
          would either spam or leave silent). */}
      <VisuallyHidden role="status" ref={announceRef} />
      <HStack>
        <InputGroup flex={1} startElement={<FaMagnifyingGlass />} endElement={searchEndElement}>
          <Input
            placeholder="Search your feeds"
            onChange={(e) => setSearchInput(e.target.value)}
            value={searchInput}
            aria-label="Search your feeds"
            required={false}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setSearch(searchInput);
              }
            }}
          />
        </InputGroup>
        <Button
          onClick={() => {
            if (isFetching) {
              return;
            }

            setSearch(searchInput);
          }}
          aria-disabled={isFetching}
          aria-busy={isFetching}
        >
          <FaMagnifyingGlass />
          Search
        </Button>
      </HStack>
      <chakra.fieldset
        borderWidth={1}
        borderColor="border.emphasized"
        borderRadius="md"
        // Taller when triaging an over-limit list (more rows visible to scan and
        // compare); the shorter height is fine under the limit, where the list
        // is a short, optional disclosure.
        maxHeight={overLimit ? 520 : 350}
        overflow="auto"
      >
        <VisuallyHidden as="legend">Feeds to bring to this team</VisuallyHidden>
        {overLimit && (
          // A sticky control header: the capacity meter, progress bar, and the
          // one bulk action stay in view while the list scrolls, and sit at the
          // top so a keyboard user reaches them without tabbing backward over the
          // loaded rows.
          <Box
            bg="bg.emphasized"
            py={3}
            px={4}
            position="sticky"
            top={0}
            zIndex={1}
            borderBottomWidth={1}
            borderColor="border.emphasized"
          >
            <Stack gap={3}>
              {/* Meter row — owns the capacity status. Over the cap it turns to a
                  warning and says how many to remove (mirrors the dialog's own
                  over-capacity guard, so the two never contradict). */}
              <Stack gap={1}>
                <HStack justifyContent="space-between">
                  <Text
                    fontWeight="medium"
                    fontSize="sm"
                    color={overCap ? "text.warning" : undefined}
                  >
                    {selectedIds.size} of {feedLimit} selected
                  </Text>
                  <Text fontSize="xs" color={atCap || overCap ? "text.warning" : "fg.muted"}>
                    {/* eslint-disable-next-line no-nested-ternary */}
                    {overCap ? `Remove ${overBy}` : atCap ? "Plan full" : `${remaining} slots left`}
                  </Text>
                </HStack>
                {/* The bar saturates at the cap; over-capacity is carried by the
                    warning text, not an overflowing bar. */}
                <Progress.Root
                  value={Math.min(selectedIds.size, feedLimit)}
                  max={feedLimit}
                  size="sm"
                  colorPalette={overCap ? "orange" : "brand"}
                  aria-hidden
                >
                  <Progress.Track>
                    <Progress.Range />
                  </Progress.Track>
                </Progress.Root>
              </Stack>
              {/* ONE action. Under cap: a plain-language auto-pick sentence with
                  the direction word inline and explained. At or over cap: a quiet
                  Clear (over-cap is resolved by unchecking rows, which the warning
                  text directs). Never a dead/"Full" button, and a checkbox is
                  never blocked. */}
              {atCap || overCap ? (
                <HStack justifyContent="flex-start">
                  <Button ref={clearButtonRef} size="xs" variant="outline" onClick={clearAll}>
                    Clear selection
                  </Button>
                </HStack>
              ) : (
                <HStack gap={2} flexWrap="wrap" fontSize="sm">
                  {/* The select's accessible name is a visually-hidden label tied
                      by htmlFor; the visible "Bring my … feeds" prose gives the
                      sighted reading and is aria-hidden to avoid duplication. */}
                  <chakra.label htmlFor="convert-keep-direction" srOnly>
                    Which feeds to bring when you have more than the plan allows
                  </chakra.label>
                  <Text aria-hidden>Bring my</Text>
                  <chakra.select
                    id="convert-keep-direction"
                    value={keep}
                    onChange={(e) => setKeep(e.target.value as KeepDirection)}
                    bg="bg.panel"
                    borderWidth={1}
                    borderColor="border.emphasized"
                    borderRadius="sm"
                    px={1}
                    py={0.5}
                    fontSize="sm"
                  >
                    <option value="newest">newest</option>
                    <option value="oldest">oldest</option>
                  </chakra.select>
                  <Text aria-hidden>{feedLimit} feeds:</Text>
                  <PrimaryActionButton
                    ref={autoPickButtonRef}
                    size="xs"
                    onClick={autoPick}
                    loading={isPicking}
                    aria-label={`Select my ${keep} ${feedLimit} feeds`}
                  >
                    Select them for me
                  </PrimaryActionButton>
                </HStack>
              )}
              {resultLine && (
                <Text fontSize="xs" color="fg.muted">
                  {resultLine}
                </Text>
              )}
              {pickError && (
                <Text fontSize="xs" color="text.error">
                  {pickError}
                </Text>
              )}
            </Stack>
          </Box>
        )}
        <Stack as="ul" listStyleType="none" gap={3} p={4}>
          {pickedTop?.map((feed) => renderRow(feed))}
          {browseRows.map((feed) => renderRow(feed))}
          {status === "loading" && (
            <Center py={3}>
              <Spinner />
            </Center>
          )}
          {error && (
            <InlineErrorAlert title="Could not load your feeds" description={error.message} />
          )}
          {totalCount === 0 && (
            <Text color="fg.muted" fontSize="sm" textAlign="center" py={3}>
              No feeds found
            </Text>
          )}
          {totalCount !== undefined && totalCount > 0 && (
            <Text color="fg.muted" fontSize="sm" textAlign="center">
              Showing {fetchedSoFarCount} of {totalCount} feeds
            </Text>
          )}
          {hasNextPage && (
            <Flex width="full">
              <Button
                onClick={() => fetchNextPage()}
                variant="outline"
                size="sm"
                width="full"
                aria-disabled={isFetchingNextPage}
                aria-busy={isFetchingNextPage}
              >
                <span>View more feeds</span>
              </Button>
            </Flex>
          )}
        </Stack>
      </chakra.fieldset>
    </Stack>
  );
};
