import {
  Badge,
  Box,
  Button,
  Center,
  Flex,
  HStack,
  IconButton,
  Input,
  InputGroup,
  Link,
  Progress,
  Spinner,
  Stack,
  Text,
  VisuallyHidden,
  chakra,
} from "@chakra-ui/react";
import { FaMagnifyingGlass, FaUpRightFromSquare, FaXmark } from "react-icons/fa6";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { captureException } from "@sentry/react";
import { useOwnedPersonalFeeds } from "../../hooks/useOwnedPersonalFeeds";
import { isRedditFeedUrl } from "../../utils/isRedditFeedUrl";
import { InlineErrorAlert } from "@/components";
import { Checkbox } from "@/components/ui/checkbox";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { pages } from "@/constants";
import { UserFeedTabSearchParam } from "@/constants/userFeedTabSearchParam";

const LIMIT = 25;

export type KeepDirection = "newest" | "oldest";

export interface OwnedPersonalFeedPickerCopy {
  legend: string;
  capacityFull: string;
  autoPickDirectionLabel: string;
  autoPickLead: string;
  autoPickSuffix: (allowance: number) => string;
  autoPickButton: string;
  autoPickButtonLabel: (direction: KeepDirection, allowance: number) => string;
  pickedResult: (direction: KeepDirection, selected: number, remaining: number) => string;
  unselectedPlain: string;
  sharedSelected: string;
  sharedConnectionScopedSelected: string;
  sharedUnselected: string;
  redditSelected: string;
  redditUnselected: string;
  sharedSelectedBadge: string;
  sharedConnectionScopedSelectedBadge: string;
  sharedUnselectedBadge: string;
  redditSelectedBadge: string;
  redditUnselectedBadge: string;
}

const defaultCopy: OwnedPersonalFeedPickerCopy = {
  legend: "Personal feeds to select",
  capacityFull: "Capacity full",
  autoPickDirectionLabel: "Which feeds to select when they do not all fit",
  autoPickLead: "Select my",
  autoPickSuffix: (allowance) => `${allowance} feeds:`,
  autoPickButton: "Select them for me",
  autoPickButtonLabel: (direction, allowance) => `Select my ${direction} ${allowance} feeds`,
  pickedResult: (direction, selected, remaining) =>
    `Selected your ${direction} ${selected} feeds, shown first below.${
      remaining > 0 ? ` ${remaining} remain personal.` : ""
    }`,
  unselectedPlain: "Remains personal",
  sharedSelected: "Shared. Its co-managers lose access when this feed moves.",
  sharedConnectionScopedSelected:
    "Shared. A co-manager has access to only some connections; moving this feed gives them access to the whole feed in the workspace.",
  sharedUnselected: "Shared. This feed remains personal, so its sharing is kept.",
  redditSelected: "Reddit feed. It will pause until you connect Reddit to this workspace.",
  redditUnselected: "Reddit feed. This feed remains personal, so its connection is kept.",
  sharedSelectedBadge: "Shared. Co-managers lose access",
  sharedConnectionScopedSelectedBadge: "Shared. Per-connection access dropped",
  sharedUnselectedBadge: "Shared. Remains personal, sharing kept",
  redditSelectedBadge: "Reddit. Will pause until connected",
  redditUnselectedBadge: "Reddit. Remains personal, connection kept",
};

interface Props {
  selectedIds: Set<string>;
  onSelectedIdsChange: (next: Set<string>) => void;
  allowance: number;
  copy?: Partial<OwnedPersonalFeedPickerCopy>;
  onLoaded?: (info: { total: number; overLimit: boolean }) => void;
  onSharingChange?: (info: {
    sharedSelectedCount: number;
    affectedUserIds: string[];
    anyConnectionScoped: boolean;
  }) => void;
  onRedditChange?: (info: { redditSelectedCount: number }) => void;
  onUserEdit?: () => void;
}

export const OwnedPersonalFeedPicker = ({
  selectedIds,
  onSelectedIdsChange,
  allowance,
  copy: copyOverrides,
  onLoaded,
  onSharingChange,
  onRedditChange,
  onUserEdit,
}: Props) => {
  const copy = { ...defaultCopy, ...copyOverrides };
  const keepDirectionId = useId();
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
    getByAge,
  } = useOwnedPersonalFeeds({ limit: LIMIT, sort: "createdAt" });

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
  const overLimit = fullTotal !== undefined && fullTotal > allowance;

  // Sharing data for the warning, keyed by feed id and accumulated across every
  // feed we have seen (browse pages + auto-pick results). A feed can be selected
  // while off-screen (auto-pick selects the newest, which sit at the tail), so a
  // running map is more reliable than reading only the currently-rendered rows.
  const sharingByFeedIdRef = useRef<
    Map<string, Array<{ discordUserId: string; connectionScoped: boolean }>>
  >(new Map());

  browseFeeds.forEach((feed) => {
    if (feed.sharedManagers) {
      sharingByFeedIdRef.current.set(feed.id, feed.sharedManagers);
    }
  });

  // Which feeds are Reddit feeds, keyed by id and accumulated across every feed
  // we have seen (same reasoning as the sharing map: a feed can be selected
  // off-screen via auto-pick). Detection is from the feed url.
  const redditByFeedIdRef = useRef<Map<string, boolean>>(new Map());

  browseFeeds.forEach((feed) => {
    if (feed.url) {
      redditByFeedIdRef.current.set(feed.id, isRedditFeedUrl(feed.url));
    }
  });

  // After an auto-pick, the chosen feeds (which may live off-screen — the newest
  // sit at the tail of the oldest-first browse list) are surfaced as their own
  // block above the browse list, so the result is immediately visible instead of
  // a count over empty-looking rows. Cleared the moment the owner hand-edits.
  const [pickedTop, setPickedTop] = useState<Array<{
    id: string;
    title: string;
  }> | null>(null);
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

  // Under the allowance, every eligible id must be loaded before seeding the
  // controlled selection. Oversized collections start empty so the user chooses.
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

  // Roll up sharing across the SELECTED feeds for the dialog's warning. Keyed on
  // the selection and the accumulated sharing map, so unselecting a shared feed
  // immediately drops it from the warning.
  useEffect(() => {
    if (!onSharingChange) {
      return;
    }

    const affected = new Set<string>();
    let sharedSelectedCount = 0;
    let anyConnectionScoped = false;

    selectedIds.forEach((id) => {
      const managers = sharingByFeedIdRef.current.get(id);

      if (managers && managers.length > 0) {
        sharedSelectedCount += 1;
        managers.forEach((m) => {
          affected.add(m.discordUserId);

          if (m.connectionScoped) {
            anyConnectionScoped = true;
          }
        });
      }
    });

    onSharingChange({
      sharedSelectedCount,
      affectedUserIds: [...affected],
      anyConnectionScoped,
    });
  }, [selectedIds, fetchedSoFarCount, onSharingChange]);

  // Roll up how many SELECTED feeds are Reddit feeds, for the dialog's warning.
  // Keyed on the selection and the accumulated reddit map, so unselecting a
  // Reddit feed immediately drops it from the count.
  useEffect(() => {
    if (!onRedditChange) {
      return;
    }

    let redditSelectedCount = 0;

    selectedIds.forEach((id) => {
      if (redditByFeedIdRef.current.get(id)) {
        redditSelectedCount += 1;
      }
    });

    onRedditChange({ redditSelectedCount });
  }, [selectedIds, fetchedSoFarCount, onRedditChange]);

  // The single accelerator: select the cap's worth by age in ONE targeted
  // request (the listing endpoint honors an arbitrary limit + sort), rather than
  // paging the whole list in. Bounded regardless of how many feeds the owner
  // has. The chosen feeds float to the top so the result is visible.
  const autoPick = async () => {
    onUserEdit?.();
    setIsPicking(true);
    setPickError(null);

    try {
      const { results } = await getByAge(keep, allowance);
      // Auto-pick operates on the full account, and its picked-to-top result is
      // only visible on the unfiltered list — so clear any active search first.
      // Clearing to empty does not trigger the search effect that drops the pick
      // framing (that effect fires only when search becomes non-empty), so the
      // pickedTop set just below survives.
      setSearchInput("");
      setSearch("");
      results.forEach((f) => {
        if (f.sharedManagers) {
          sharingByFeedIdRef.current.set(f.id, f.sharedManagers);
        }

        if (f.url) {
          redditByFeedIdRef.current.set(f.id, isRedditFeedUrl(f.url));
        }
      });
      onSelectedIdsChange(new Set(results.map((f) => f.id)));
      setPickedTop(results.map((f) => ({ id: f.id, title: f.title })));
      // The selection now fills the cap, so the header swaps this button for
      // "Clear selection"; hand focus there after the swap.
      focusClearAfterPickRef.current = true;
      const left = (fullTotal ?? results.length) - results.length;
      const line = copy.pickedResult(keep, results.length, left);
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
    onUserEdit?.();
    clearPickFraming();
    const next = new Set(selectedIds);

    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    const over = next.size - allowance;
    const verb = selectedIds.has(id) ? "Removed" : "Added";
    announce(
      over > 0
        ? `${verb} ${title}. ${next.size} of ${allowance}; remove ${over} to continue.`
        : `${verb} ${title}. ${allowance - next.size} slots left.`,
    );
    onSelectedIdsChange(next);
  };

  const clearAll = () => {
    onUserEdit?.();
    clearPickFraming();
    onSelectedIdsChange(new Set());
    announce(`Cleared. ${allowance} slots left.`);
    // Clearing drops below the cap, so the header swaps this button back for the
    // auto-pick action; hand focus there after the swap.
    focusAutoPickAfterClearRef.current = true;
  };

  const remaining = allowance - selectedIds.size;
  const atCap = remaining === 0;
  const overBy = Math.max(0, selectedIds.size - allowance);
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
    const managers = sharingByFeedIdRef.current.get(feed.id);
    const isShared = !!managers && managers.length > 0;
    const isConnectionScoped = !!managers?.some((m) => m.connectionScoped);
    const isReddit = !!redditByFeedIdRef.current.get(feed.id);

    // The per-feed Reddit consequence, tied to THIS checkbox via aria-describedby
    // (the visual chip is aria-hidden). Selected: it pauses until the workspace
    // has its own Reddit connection. Unselected: it stays personal, connection
    // untouched. Independent of sharing, so a feed can carry both descriptions.
    const redditDescribedById = isReddit ? `feed-reddit-${feed.id}` : undefined;
    let redditDescription = "";

    if (isReddit && isSelected) {
      redditDescription = copy.redditSelected;
    } else if (isReddit && !isSelected) {
      redditDescription = copy.redditUnselected;
    }

    // The per-feed sharing detail, tied to THIS checkbox via aria-describedby so
    // a screen-reader user hears it on the specific row (the visual chip is
    // aria-hidden, so without this the per-feed scope would be sighted-only). It
    // tracks selection: a selected shared feed warns about lost access; an
    // unselected one reassures that sharing is kept.
    const describedById = isShared ? `feed-share-${feed.id}` : undefined;
    let sharedDescription = "";

    if (isShared && isSelected) {
      sharedDescription = isConnectionScoped
        ? copy.sharedConnectionScopedSelected
        : copy.sharedSelected;
    } else if (isShared && !isSelected) {
      sharedDescription = copy.sharedUnselected;
    }

    return (
      <Box key={`feed-${feed.id}`} as="li">
        {/* The checkbox's label is the feed TITLE only, so assistive tech
            announces "<title>, checkbox". The visual hint below is a sibling, not
            a child of the label, so it stays out of the accessible NAME; the
            sharing consequence is instead tied on as the checkbox's DESCRIPTION
            (aria-describedby), so a shared feed reads as e.g. "<title>, checkbox,
            checked, Shared. Its co-managers lose access…". */}
        <Checkbox
          width="100%"
          alignItems="flex-start"
          checked={isSelected}
          onCheckedChange={() => toggle(feed.id, feed.title)}
          required={false}
          inputProps={
            describedById || redditDescribedById
              ? {
                  "aria-describedby": [describedById, redditDescribedById]
                    .filter(Boolean)
                    .join(" "),
                }
              : undefined
          }
        >
          <chakra.span ml={2} display="block" fontSize="sm" fontWeight={600}>
            {feed.title}
          </chakra.span>
        </Checkbox>
        {describedById ? (
          <VisuallyHidden id={describedById}>{sharedDescription}</VisuallyHidden>
        ) : null}
        {redditDescribedById ? (
          <VisuallyHidden id={redditDescribedById}>{redditDescription}</VisuallyHidden>
        ) : null}
        {/* Visual per-row consequence chips, aria-hidden (the spoken equivalents
            are the checkbox descriptions above). The sharing and Reddit chips
            share ONE horizontal row so a feed that is both shared and Reddit shows
            both badges side by side, and a feed with only one consequence has no
            empty line stacked above its single chip. */}
        {isShared || isReddit ? (
          <HStack
            pl="calc(var(--chakra-spacing-6) + var(--chakra-spacing-2))"
            mt={1}
            gap={2}
            flexWrap="wrap"
            aria-hidden
          >
            {isShared ? (
              <Badge colorPalette={isSelected ? "orange" : undefined} variant="subtle" size="sm">
                {/* eslint-disable-next-line no-nested-ternary */}
                {isSelected
                  ? isConnectionScoped
                    ? copy.sharedConnectionScopedSelectedBadge
                    : copy.sharedSelectedBadge
                  : copy.sharedUnselectedBadge}
              </Badge>
            ) : null}
            {isReddit ? (
              <Badge colorPalette={isSelected ? "orange" : undefined} variant="subtle" size="sm">
                {isSelected ? copy.redditSelectedBadge : copy.redditUnselectedBadge}
              </Badge>
            ) : null}
          </HStack>
        ) : (
          // Plain feed (no sharing, no Reddit): the only row whose hint toggles
          // between "Stays personal" and nothing, so its line is reserved (hidden
          // when selected) to keep row height stable on toggle.
          <chakra.span
            display="block"
            pl="calc(var(--chakra-spacing-6) + var(--chakra-spacing-2))"
            mt={1}
            fontSize="xs"
            color="text.warning"
            visibility={isSelected ? "hidden" : "visible"}
            aria-hidden
          >
            {copy.unselectedPlain}
          </chakra.span>
        )}
        {/* Lets the owner review this feed's co-managers before deciding. Opens
            in a NEW tab so the conversion dialog (and its in-progress selection +
            slug confirmation) is not lost. Personal scope: the feeds being moved
            are personal until conversion. */}
        {isShared ? (
          <Box pl="calc(var(--chakra-spacing-6) + var(--chakra-spacing-2))" mt={1}>
            <Link
              href={pages.userFeed(feed.id, {
                tab: UserFeedTabSearchParam.Settings,
              })}
              target="_blank"
              rel="noopener noreferrer"
              color="text.link"
              fontSize="xs"
              display="inline-flex"
              alignItems="center"
              gap={1}
              aria-label={`Manage sharing for ${feed.title} (opens in a new tab)`}
            >
              Manage sharing
              <FaUpRightFromSquare aria-hidden />
            </Link>
          </Box>
        ) : null}
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
        <VisuallyHidden as="legend">{copy.legend}</VisuallyHidden>
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
                    {selectedIds.size} of {allowance} selected
                  </Text>
                  <Text fontSize="xs" color={atCap || overCap ? "text.warning" : "fg.muted"}>
                    {/* eslint-disable-next-line no-nested-ternary */}
                    {overCap
                      ? `Remove ${overBy}`
                      : atCap
                        ? copy.capacityFull
                        : `${remaining} slots left`}
                  </Text>
                </HStack>
                {/* The bar saturates at the cap; over-capacity is carried by the
                    warning text, not an overflowing bar. */}
                <Progress.Root
                  value={Math.min(selectedIds.size, allowance)}
                  max={allowance}
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
                  <chakra.label htmlFor={keepDirectionId} srOnly>
                    {copy.autoPickDirectionLabel}
                  </chakra.label>
                  <Text aria-hidden>{copy.autoPickLead}</Text>
                  <chakra.select
                    id={keepDirectionId}
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
                  <Text aria-hidden>{copy.autoPickSuffix(allowance)}</Text>
                  <PrimaryActionButton
                    ref={autoPickButtonRef}
                    size="xs"
                    onClick={autoPick}
                    loading={isPicking}
                    aria-label={copy.autoPickButtonLabel(keep, allowance)}
                  >
                    {copy.autoPickButton}
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
