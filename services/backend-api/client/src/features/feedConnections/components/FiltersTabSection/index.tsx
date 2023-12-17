import { Heading, Stack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

  return (
    <Stack spacing={12} mb={24}>
      <Stack spacing={4}>
        <Heading as="h2" size="md">
          Filters
        </Heading>
        <FiltersForm
          onSave={onFiltersUpdated}
          expression={filters}
          data={{
            feedId,
            articleFormatter,
          }}
        />
      </Stack>
    </Stack>
  );
};
