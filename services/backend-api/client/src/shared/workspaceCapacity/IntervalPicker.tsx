import { useId } from "react";
import { Badge, HStack, RadioCard, SimpleGrid, Stack, Text } from "@chakra-ui/react";

export type BillingInterval = "month" | "year";

const INTERVAL_OPTIONS: Array<{ value: BillingInterval; label: string }> = [
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];

// Adverb form for prose ("billed yearly", "Billing is now monthly"), where the
// raw interval value reads like a unit rather than a cadence.
export const BILLING_INTERVAL_WORD: Record<BillingInterval, string> = {
  month: "monthly",
  year: "yearly",
};

// Monthly/yearly selection in the same RadioCard idiom as CapacityPicker, so
// keyboard and screen-reader interaction is identical to the capacity choice
// beside it. `currentValue` badges the subscription's current interval.
export const IntervalPicker = ({
  value,
  onChange,
  currentValue,
}: {
  value: BillingInterval;
  onChange: (value: BillingInterval) => void;
  currentValue?: BillingInterval;
}) => {
  const labelId = useId();

  return (
    <Stack gap={3}>
      <Text id={labelId} fontWeight="medium">
        Billing interval
      </Text>
      <RadioCard.Root
        name={labelId}
        value={value}
        variant="surface"
        colorPalette="brand"
        size="sm"
        aria-labelledby={labelId}
        onValueChange={(details) => {
          if (details.value === "month" || details.value === "year") {
            onChange(details.value);
          }
        }}
      >
        <SimpleGrid columns={2} gap={2}>
          {INTERVAL_OPTIONS.map(({ value: intervalValue, label }) => {
            const isCurrent = currentValue !== undefined && intervalValue === currentValue;

            return (
              <RadioCard.Item key={intervalValue} value={intervalValue}>
                <RadioCard.ItemHiddenInput />
                <RadioCard.ItemControl>
                  <HStack gap={2} flex="1">
                    <RadioCard.ItemIndicator />
                    <RadioCard.ItemText fontWeight="medium">
                      {label}{" "}
                      {isCurrent && (
                        <Badge size="sm" ms={1}>
                          Current
                        </Badge>
                      )}
                    </RadioCard.ItemText>
                  </HStack>
                </RadioCard.ItemControl>
              </RadioCard.Item>
            );
          })}
        </SimpleGrid>
      </RadioCard.Root>
    </Stack>
  );
};
