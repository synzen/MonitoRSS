import { useEffect, useId, useState } from "react";
import { Box, HStack, Input, RadioCard, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import {
  WORKSPACE_CAPACITY_QUICK_PICKS,
  WORKSPACE_MAX_FEEDS,
  WORKSPACE_MIN_FEEDS,
  formatWorkspaceFeedCount,
} from "./detents";

const rangeMessage = `Choose a whole number from ${WORKSPACE_MIN_FEEDS} to ${new Intl.NumberFormat().format(WORKSPACE_MAX_FEEDS)} feeds.`;

export const CapacityPicker = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) => {
  const [draft, setDraft] = useState(String(value));
  const [message, setMessage] = useState<string>();
  const labelId = useId();
  const helperId = useId();
  const exactInputId = useId();
  const selectedValue = WORKSPACE_CAPACITY_QUICK_PICKS.includes(value) ? String(value) : "custom";
  const [customOpen, setCustomOpen] = useState(selectedValue === "custom");

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const isCustomVisible = selectedValue === "custom" || customOpen;
  const radioValue = isCustomVisible ? "custom" : selectedValue;

  const commit = () => {
    const parsed = Number(draft);

    if (!draft.trim() || !Number.isInteger(parsed)) {
      setMessage(rangeMessage);
      setDraft(String(value));

      return;
    }

    const clamped = Math.min(WORKSPACE_MAX_FEEDS, Math.max(WORKSPACE_MIN_FEEDS, parsed));
    setMessage(
      clamped === parsed
        ? undefined
        : `${rangeMessage} Using ${formatWorkspaceFeedCount(clamped)}.`,
    );
    setDraft(String(clamped));
    onChange(clamped);
  };

  return (
    <Stack gap={3}>
      <Text id={labelId} fontWeight="medium">
        Feed capacity
      </Text>
      <RadioCard.Root
        name={labelId}
        value={radioValue}
        variant="surface"
        colorPalette="brand"
        size="sm"
        aria-labelledby={labelId}
        onValueChange={(details) => {
          if (!details.value) return;

          if (details.value === "custom") {
            setCustomOpen(true);

            return;
          }

          const feeds = Number(details.value);
          setMessage(undefined);
          setCustomOpen(false);
          setDraft(String(feeds));
          onChange(feeds);
        }}
      >
        <SimpleGrid columns={{ base: 2, sm: 3 }} gap={2}>
          {WORKSPACE_CAPACITY_QUICK_PICKS.map((feeds) => {
            return (
              <RadioCard.Item key={feeds} value={String(feeds)}>
                <RadioCard.ItemHiddenInput />
                <RadioCard.ItemControl>
                  <HStack gap={2} flex="1">
                    <RadioCard.ItemIndicator />
                    <RadioCard.ItemText fontWeight="medium">
                      {formatWorkspaceFeedCount(feeds)}
                    </RadioCard.ItemText>
                  </HStack>
                </RadioCard.ItemControl>
              </RadioCard.Item>
            );
          })}
          <RadioCard.Item value="custom">
            <RadioCard.ItemHiddenInput />
            <RadioCard.ItemControl>
              <HStack gap={2} flex="1">
                <RadioCard.ItemIndicator />
                <RadioCard.ItemText fontWeight="medium">Custom</RadioCard.ItemText>
              </HStack>
            </RadioCard.ItemControl>
          </RadioCard.Item>
        </SimpleGrid>
      </RadioCard.Root>
      {isCustomVisible && (
        <Box
          bg="bg.subtle"
          borderWidth="1px"
          borderColor="border.emphasized"
          borderLeftWidth="2px"
          borderLeftColor="brandSolid"
          rounded="md"
          p={3}
        >
          <Stack gap={1}>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- Chakra Input is a valid control, htmlFor correctly references id */}
            <label htmlFor={exactInputId}>
              <Text as="span" fontSize="sm" color="fg.muted">
                Or enter an exact feed capacity
              </Text>
            </label>
            <Input
              id={exactInputId}
              size="sm"
              type="number"
              min={WORKSPACE_MIN_FEEDS}
              max={WORKSPACE_MAX_FEEDS}
              step={1}
              appearance="textfield"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }

                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                  event.preventDefault();
                }
              }}
              aria-valuetext={formatWorkspaceFeedCount(value)}
              aria-describedby={message ? undefined : helperId}
              aria-errormessage={message ? helperId : undefined}
              aria-invalid={!!message}
              css={{
                "&::-webkit-inner-spin-button, &::-webkit-outer-spin-button": {
                  WebkitAppearance: "none",
                  margin: 0,
                },
              }}
            />
            <Text id={helperId} color={message ? "text.error" : "fg.muted"} fontSize="sm">
              {message ?? rangeMessage}
            </Text>
          </Stack>
        </Box>
      )}
    </Stack>
  );
};
