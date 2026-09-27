import {
  Box,
  Button,
  Fieldset,
  HStack,
  IconButton,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Text,
} from "@chakra-ui/react";
import { FaPlus, FaTrash } from "react-icons/fa6";
import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MAX_SCHEDULE_TIMES,
  SCHEDULE_DAYS_ORDER,
  buildTimezoneGroups,
  dayShortName,
  getNextScheduledFetchText,
  getTimezoneOffsetLabel,
} from "@/utils/feedSchedule";

interface Props {
  times: string[];
  onTimesChange: (times: string[]) => void;
  timeErrors?: Array<string | undefined>;
  timesListError?: string;
  days: number[];
  onDaysChange: (days: number[]) => void;
  daysError?: string;
  timezone: string;
  onTimezoneChange: (timezone: string) => void;
  timezoneError?: string;
}

export const FeedScheduleSettings = ({
  onTimesChange,
  onTimezoneChange,
  times,
  timeErrors,
  timesListError,
  days,
  onDaysChange,
  daysError,
  timezone,
  timezoneError,
}: Props) => {
  const timezoneGroups = useMemo(() => buildTimezoneGroups(), []);
  const offsetLabel = getTimezoneOffsetLabel(timezone);
  const nextFetchText = getNextScheduledFetchText(times, timezone, days);
  const atCap = times.length >= MAX_SCHEDULE_TIMES;

  const updateTime = (index: number, value: string) => {
    const next = [...times];
    next[index] = value;
    onTimesChange(next);
  };

  const removeTime = (index: number) => {
    onTimesChange(times.filter((_, i) => i !== index));
  };

  return (
    <Stack gap={5}>
      <Fieldset.Root invalid={!!daysError}>
        <Fieldset.Legend fontSize="sm" fontWeight="medium">
          Days
        </Fieldset.Legend>
        {daysError && <Fieldset.ErrorText>{daysError}</Fieldset.ErrorText>}
        <HStack gap={2} flexWrap="wrap">
          {SCHEDULE_DAYS_ORDER.map((day) => {
            const checked = days.includes(day);
            // Never allow unchecking the last selected day.
            const isLastChecked = checked && days.length === 1;

            return (
              <Checkbox
                key={day}
                checked={checked}
                disabled={isLastChecked}
                onCheckedChange={(details) => {
                  if (details.checked === "indeterminate") {
                    return;
                  }

                  if (details.checked) {
                    onDaysChange([...days, day].sort((a, b) => a - b));
                  } else {
                    onDaysChange(days.filter((d) => d !== day));
                  }
                }}
                colorPalette="blue"
                fontWeight="medium"
                // Match the default (md) height of the time inputs.
                height="40px"
                width="fit-content"
                border="1px solid"
                borderColor={checked ? "colorPalette.solid" : "border"}
                color={checked ? "colorPalette.solid" : undefined}
                px={3}
                gap={2}
                borderRadius="l2"
              >
                {dayShortName(day)}
              </Checkbox>
            );
          })}
        </HStack>
      </Fieldset.Root>
      <Stack gap={1.5}>
        <Text fontSize="sm" fontWeight="medium">
          Times (up to {MAX_SCHEDULE_TIMES} per day)
        </Text>
        {timesListError && (
          <Text color="text.error" fontSize="sm" role="alert">
            {timesListError}
          </Text>
        )}
        {times.map((time, index) => (
          // eslint-disable-next-line react/no-array-index-key -- times are positional while being edited; duplicates possible
          <HStack key={index} gap={2}>
            <Input
              type="time"
              value={time}
              width="130px"
              aria-label={`Scheduled time ${index + 1}`}
              aria-invalid={!!timeErrors?.[index]}
              onChange={(e) => updateTime(index, e.target.value)}
            />
            <IconButton
              aria-label={`Remove scheduled time ${index + 1}`}
              variant="ghost"
              size="xs"
              disabled={times.length === 1}
              onClick={() => removeTime(index)}
            >
              <FaTrash />
            </IconButton>
            {timeErrors?.[index] && (
              <Text color="text.error" fontSize="sm">
                {timeErrors[index]}
              </Text>
            )}
          </HStack>
        ))}
        <Box>
          <Button
            variant="outline"
            size="xs"
            disabled={atCap}
            onClick={() => onTimesChange([...times, ""])}
          >
            <FaPlus />
            Add time
          </Button>
        </Box>
      </Stack>
      <Stack gap={1}>
        <Text fontSize="sm" fontWeight="medium">
          Timezone
        </Text>
        <HStack gap={3} flexWrap="wrap">
          <NativeSelectRoot width={{ base: "full", sm: "260px" }} size="sm">
            <NativeSelectField
              aria-label="Schedule timezone"
              aria-invalid={!!timezoneError}
              value={timezone}
              onChange={(e) => onTimezoneChange(e.target.value)}
            >
              {timezoneGroups.map((group) => (
                <optgroup key={group.region} label={group.region}>
                  {group.zones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </optgroup>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
          {offsetLabel && (
            <Text color="fg.muted" fontSize="sm" whiteSpace="nowrap">
              {offsetLabel}
            </Text>
          )}
        </HStack>
        {timezoneError && (
          <Text color="text.error" fontSize="sm">
            {timezoneError}
          </Text>
        )}
      </Stack>
      <Box
        bg="bg.subtle"
        border="1px solid"
        borderColor="border"
        borderRadius="l2"
        px={3}
        py={2}
        width="fit-content"
        maxW="full"
        data-testid="next-scheduled-fetch"
        aria-live="polite"
      >
        {nextFetchText ? (
          <Text fontWeight="medium">{nextFetchText}</Text>
        ) : (
          <Text color="fg.muted">Add a valid time to see the next fetch.</Text>
        )}
        <Text fontSize="sm" color="fg.muted">
          Articles are delivered once each. Something stuck at the top of the feed won&apos;t be
          sent again.
        </Text>
      </Box>
    </Stack>
  );
};
