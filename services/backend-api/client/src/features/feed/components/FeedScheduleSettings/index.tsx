import {
  Box,
  Button,
  Fieldset,
  HStack,
  IconButton,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { FaPlus, FaTrash } from "react-icons/fa6";
import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
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

  const toggleDay = (day: number, checked: boolean | "indeterminate") => {
    if (checked === "indeterminate") {
      return;
    }

    if (checked) {
      onDaysChange([...days, day].sort((a, b) => a - b));
    } else {
      onDaysChange(days.filter((d) => d !== day));
    }
  };

  return (
    <Stack gap={6}>
      <Fieldset.Root invalid={!!daysError}>
        <Fieldset.Legend>Days of week</Fieldset.Legend>
        <Fieldset.HelperText>
          The feed is fetched on the selected days only.
        </Fieldset.HelperText>
        {daysError && <Fieldset.ErrorText>{daysError}</Fieldset.ErrorText>}
        <SimpleGrid columns={{ base: 4, md: 7 }} gap={2}>
          {SCHEDULE_DAYS_ORDER.map((day) => {
            const checked = days.includes(day);
            // Never allow unchecking the last selected day.
            const isLastChecked = checked && days.length === 1;

            return (
              <Checkbox
                key={day}
                checked={checked}
                disabled={isLastChecked}
                onCheckedChange={(details) => toggleDay(day, details.checked)}
              >
                {dayShortName(day)}
              </Checkbox>
            );
          })}
        </SimpleGrid>
      </Fieldset.Root>
      <Field
        label="Times of day"
        invalid={!!timesListError || !!timeErrors?.some(Boolean)}
        errorText={timesListError}
        helperText={`Up to ${MAX_SCHEDULE_TIMES} times per day. Duplicates are merged and the list is kept sorted.`}
      >
        <Stack gap={2}>
          {times.map((time, index) => (
            <HStack key={index} gap={2} alignItems="center">
              <Input
                type="time"
                value={time}
                width="150px"
                aria-label={`Scheduled time ${index + 1}`}
                onChange={(e) => updateTime(index, e.target.value)}
              />
              <IconButton
                aria-label={`Remove scheduled time ${index + 1}`}
                variant="ghost"
                size="sm"
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
              size="sm"
              disabled={atCap}
              onClick={() => onTimesChange([...times, ""])}
            >
              <FaPlus />
              Add time
            </Button>
          </Box>
        </Stack>
      </Field>
      <Field
        label="Timezone"
        invalid={!!timezoneError}
        errorText={timezoneError}
        helperText="Times follow daylight saving time of the selected timezone."
      >
        <HStack alignItems="center" gap={3}>
          <NativeSelectRoot minW="260px" width="fit-content">
            <NativeSelectField
              aria-label="Schedule timezone"
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
          {offsetLabel && <Text color="fg.muted">{offsetLabel}</Text>}
        </HStack>
      </Field>
      {nextFetchText && (
        <Text fontWeight="medium" data-testid="next-scheduled-fetch">
          {nextFetchText}
        </Text>
      )}
      <Stack gap={1} color="fg.muted" fontSize="sm">
        <Text>
          Each article is delivered once. A post that stays at the top of the
          feed won&apos;t be delivered again at the next scheduled time.
        </Text>
        <Text>
          Only articles still present in the feed at fetch time can be
          delivered.
        </Text>
      </Stack>
    </Stack>
  );
};
