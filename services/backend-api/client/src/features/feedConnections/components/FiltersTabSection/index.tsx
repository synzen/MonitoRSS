import { Heading, Link, Stack, Text } from "@chakra-ui/react";

import { LogicalFilterExpression } from "../../types";
import { FiltersForm } from "../FiltersForm";

interface Props {
  filters?: LogicalFilterExpression | null;
  onFiltersUpdated: (filters: LogicalFilterExpression | null) => Promise<void>;
}

export const FiltersTabSection = ({ filters, onFiltersUpdated }: Props) => {
  return (
    <Stack spacing={8} mb={24}>
      <Stack>
        <Heading as="h2" size="md">
          Filters
        </Heading>
        <Text>
          Block articles based on placeholder content so only relevant articles are delivered. If
          you&apos;re using regex matches, you may use{" "}
          <Link
            target="_blank"
            rel="noopener noreferrer"
            href="https://regex101.com/"
            color="blue.400"
          >
            https://regex101.com/
          </Link>{" "}
          (with JavaScript flavor) to test your regex on sample content.
        </Text>
      </Stack>
      <FiltersForm onSave={onFiltersUpdated} expression={filters} />
    </Stack>
  );
};
