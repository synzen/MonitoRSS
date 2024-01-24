import { Heading, Link, Stack, Text } from "@chakra-ui/react";
import { GetUserFeedArticlesInput } from "../../../feed/api";

import { LogicalFilterExpression } from "../../types";
import { FiltersForm } from "../FiltersForm";

interface Props {
  feedId?: string;
  filters?: LogicalFilterExpression | null;
  onFiltersUpdated: (filters: LogicalFilterExpression | null) => Promise<void>;
  articleFormatter: GetUserFeedArticlesInput["data"]["formatter"];
}

export const FiltersTabSection = ({
  feedId,
  filters,
  onFiltersUpdated,
  articleFormatter,
}: Props) => {
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
      <FiltersForm
        onSave={onFiltersUpdated}
        expression={filters}
        data={{
          feedId,
          articleFormatter,
        }}
      />
    </Stack>
  );
};
