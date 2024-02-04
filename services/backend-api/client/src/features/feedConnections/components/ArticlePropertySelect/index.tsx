import { Stack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import Select from "react-select";
import { useUserFeedArticleProperties } from "../../../feed/hooks";
import { InlineErrorAlert, ThemedSelect } from "../../../../components";
import { GetUserFeedArticlesInput } from "../../../feed/api";

interface Props {
  feedId?: string;
  selectRef?: React.ComponentProps<typeof Select>["ref"] | null;
  articleFormatter: GetUserFeedArticlesInput["data"]["formatter"];
  onChange: (value: string) => void;
  value?: string;
  placeholder?: string;
}

export const ArticlePropertySelect = ({
  feedId,
  selectRef,
  articleFormatter,
  value,
  onChange,
  placeholder,
}: Props) => {
  const input = {
    feedId,
    data: {
      customPlaceholders: articleFormatter.customPlaceholders,
    },
  };
  const { data, error, fetchStatus } = useUserFeedArticleProperties(input);
  const { t } = useTranslation();

  return (
    <Stack>
      <ThemedSelect
        isDisabled={fetchStatus === "fetching" || !!error}
        loading={fetchStatus === "fetching"}
        options={
          data?.result.properties.map((o) => ({
            label: o,
            value: o,
            data: o,
          })) || []
        }
        inputRef={selectRef}
        onChange={onChange}
        value={value}
        placeholder={placeholder}
      />
      {/* <Select
        isDisabled={fetchStatus === "fetching" || !!error}
        borderColor="gray.600"
        placeholder={t("features.feedConnections.components.articlePropertySelect.placeholder")}
        {...selectProps}
        ref={selectRef}
      >
        {options}
      </Select> */}
      {error && (
        <InlineErrorAlert
          title={t("common.errors.somethingWentWrong")}
          description={error?.message}
        />
      )}
    </Stack>
  );
};
