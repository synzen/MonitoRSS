import { useEffect, useId, useState } from "react";
import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { Field } from "@/components/ui/field";
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
  const helperId = useId();

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft);

    if (!draft.trim() || !Number.isInteger(parsed)) {
      setMessage(rangeMessage);
      setDraft(String(value));
      return;
    }

    const clamped = Math.min(WORKSPACE_MAX_FEEDS, Math.max(WORKSPACE_MIN_FEEDS, parsed));
    setMessage(clamped === parsed ? undefined : `${rangeMessage} Using ${formatWorkspaceFeedCount(clamped)}.`);
    setDraft(String(clamped));
    onChange(clamped);
  };

  return (
    <Stack gap={3}>
      <Field
        label="Feed capacity"
        helperText={!message ? rangeMessage : undefined}
        errorText={message}
        invalid={!!message}
      >
        <Input
          type="number"
          min={WORKSPACE_MIN_FEEDS}
          max={WORKSPACE_MAX_FEEDS}
          step={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          aria-valuetext={formatWorkspaceFeedCount(value)}
          aria-describedby={helperId}
        />
      </Field>
      <Stack gap={2}>
        <Text fontSize="sm" fontWeight="medium">
          Quick picks
        </Text>
        <HStack gap={2} flexWrap="wrap" aria-label="Quick feed capacity picks">
          {WORKSPACE_CAPACITY_QUICK_PICKS.map((feeds) => (
            <Button
              key={feeds}
              size="sm"
              variant={value === feeds ? "solid" : "outline"}
              aria-pressed={value === feeds}
              onClick={() => {
                setMessage(undefined);
                setDraft(String(feeds));
                onChange(feeds);
              }}
            >
              {formatWorkspaceFeedCount(feeds)}
            </Button>
          ))}
        </HStack>
      </Stack>
      <Text id={helperId} srOnly>
        Selected capacity: {formatWorkspaceFeedCount(value)}.
      </Text>
    </Stack>
  );
};
