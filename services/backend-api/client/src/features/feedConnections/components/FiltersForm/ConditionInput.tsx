import { FormControl, FormErrorMessage, Input } from "@chakra-ui/react";
import { Controller, FieldError, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { getNestedField } from "../../../../utils/getNestedField";

interface Props {
  controllerName: string;
  placeholder?: string;
}

export const ConditionInput = ({ controllerName, placeholder }: Props) => {
  const { t } = useTranslation();
  const {
    control,
    formState: { errors },
  } = useFormContext();
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
            <Input
              flexGrow={1}
              placeholder={placeholder}
              minWidth={150}
              _placeholder={{
                color: "gray.400",
              }}
              {...field}
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
