import { Stack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import Select from "react-select";
import { useEffect } from "react";
import { useUserFeedArticleProperties } from "../../../feed/hooks";
import { InlineErrorAlert, ThemedSelect } from "../../../../components";
import { useUserFeedContext } from "../../../../contexts/UserFeedContext";
import { CustomPlaceholder } from "../../../../types";

interface Props {
  selectRef?: React.ComponentProps<typeof Select>["ref"] | null;
  customPlaceholders: CustomPlaceholder[];
  onChange: (value: string) => void;
  value?: string;
  placeholder?: string;
  isInvalid: boolean;
  ariaLabelledBy: string;
  inputId: string;
  isRequired?: boolean;
  tabIndex?: number;
  invertBg?: boolean;
}

export const ArticlePropertySelect = ({
  selectRef,
  customPlaceholders,
  value,
  onChange,
  placeholder,
  ariaLabelledBy,
  inputId,
  isInvalid,
  isRequired,
  tabIndex,
  invertBg,
}: Props) => {
  const {
    userFeed: { id: feedId },
  } = useUserFeedContext();
  const input = {
    feedId,
    data: {
      customPlaceholders,
    },
  };
  const { data, error, fetchStatus, status } = useUserFeedArticleProperties(input);
  const { t } = useTranslation();

  useEffect(() => {
    if (status === "success" && data) {
      const availableProperties = data?.result.properties || [];
      const title = availableProperties.includes("title");

      if (!title) {
        onChange(availableProperties[0] as string);
      } else {
        onChange("title");
      }
    }
  }, [status]);

  return (
    <Stack onKeyDown={(e) => e.stopPropagation()}>
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
        isInvalid={isInvalid}
        selectProps={{
          inputId,
          "aria-labelledby": ariaLabelledBy,
          required: isRequired,
          tabIndex,
        }}
        invertBg={invertBg}
      />
      {error && (
        <InlineErrorAlert
          title={t("common.errors.somethingWentWrong")}
          description={error?.message}
        />
      )}
    </Stack>
  );
};
