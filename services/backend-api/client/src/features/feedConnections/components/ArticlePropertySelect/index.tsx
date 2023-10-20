import { Select, SelectProps, Stack, chakra } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LegacyRef } from "react";
import { useUserFeedArticleProperties } from "../../../feed/hooks";
import { InlineErrorAlert } from "../../../../components";

interface Props {
  feedId: string;
  selectProps?: SelectProps;
  excludeProperties?: string[];
  selectRef?: LegacyRef<HTMLSelectElement> | null;
}

export const ArticlePropertySelect = ({
  feedId,
  selectProps,
  excludeProperties,
  selectRef,
}: Props) => {
  const { data, error, fetchStatus } = useUserFeedArticleProperties({
    feedId,
  });
  const { t } = useTranslation();

  const options = data?.result.properties
    .filter((property) => !excludeProperties?.includes(property))
    ?.map((prop) => (
      <chakra.option key={prop} value={prop}>
        {prop}
      </chakra.option>
    ));

  return (
    <Stack>
      <Select
        isDisabled={fetchStatus === "fetching" || !!error}
        borderColor="gray.600"
        placeholder={t("features.feedConnections.components.articlePropertySelect.placeholder")}
        {...selectProps}
        ref={selectRef}
      >
        {options}
      </Select>
      {error && (
        <InlineErrorAlert
          title={t("common.errors.somethingWentWrong")}
          description={error?.message}
        />
      )}
    </Stack>
  );
};
