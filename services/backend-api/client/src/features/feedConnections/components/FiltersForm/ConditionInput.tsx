import { FormControl, FormErrorMessage, FormLabel, Input } from "@chakra-ui/react";
import { Controller, FieldError, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { getNestedField } from "../../../../utils/getNestedField";
import { useNavigableTreeItemContext } from "../../../../contexts/NavigableTreeItemContext";

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
  const { isFocused } = useNavigableTreeItemContext();

  return (
    <FormControl isInvalid={!!error} isRequired>
      <FormLabel srOnly id={`${controllerName}-label`}>
        Filter value
      </FormLabel>
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
              aria-invalid={!!error}
              aria-labelledby={`${controllerName}-label`}
              bg="gray.800"
              _placeholder={{
                color: "gray.400",
              }}
              {...field}
              ref={null}
              tabIndex={isFocused ? 0 : -1}
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
