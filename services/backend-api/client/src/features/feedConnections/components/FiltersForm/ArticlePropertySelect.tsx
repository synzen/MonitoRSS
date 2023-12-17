import { FormControl, FormErrorMessage } from "@chakra-ui/react";
import { Controller, FieldError, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { getNestedField } from "../../../../utils/getNestedField";
import { useUserFeedArticleProperties } from "../../../feed/hooks";
import { GetUserFeedArticlesInput } from "../../../feed/api";
import { ThemedSelect } from "../../../../components";

interface Props {
  controllerName: string;
  placeholder?: string;
  data: {
    feedId?: string;
  };
  articleFormatter: GetUserFeedArticlesInput["data"]["formatter"];
}

export const ArticlePropertySelect = ({
  controllerName,
  placeholder,
  data,
  articleFormatter,
}: Props) => {
  const { t } = useTranslation();
  const {
    control,
    formState: { errors },
  } = useFormContext();
  const { data: propertiesData, status } = useUserFeedArticleProperties({
    feedId: data.feedId,
    data: {
      customPlaceholders: articleFormatter.customPlaceholders,
    },
  });

  // Using bracket notation on the errors object will not work since the prefix is a string
  const error = getNestedField<FieldError>(errors, controllerName);

  return (
    <FormControl isInvalid={!!error}>
      <Controller
        name={controllerName}
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <>
            <ThemedSelect
              isDisabled={status === "loading"}
              options={
                propertiesData?.result.properties.map((o) => ({
                  label: o,
                  value: o,
                  data: o,
                })) || []
              }
              onChange={(val) => {
                field.onChange(val);
              }}
              placeholder="Select property"
              value={field.value}
            />
            {error?.type === "required" && (
              <FormErrorMessage>
                {t("features.feedConnections.components.filtersForm.valueIsRequired")}
              </FormErrorMessage>
            )}
          </>
        )}
      />
    </FormControl>
  );
};
