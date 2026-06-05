import { Box, Stack, chakra } from "@chakra-ui/react";
import { useState } from "react";
import { NativeSelectField, NativeSelectRoot } from "@/components/ui/native-select";
import { SafeLoadingButton } from "@/components/SafeLoadingButton";

interface Props {
  properties?: string[];
  isDisabled?: boolean;
  isLoading?: boolean;
  onChange: (value: string) => Promise<void>;
  formLabel: string;
}

export const AddComparisonSelect = ({
  properties,
  isDisabled,
  isLoading,
  onChange,
  formLabel,
}: Props) => {
  const [value, setValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const onClickAdd = async () => {
    setIsAdding(true);
    await onChange(value);
    setValue("");
    setIsAdding(false);
  };

  return (
    <Box as="form" onSubmit={() => onClickAdd()}>
      <Stack>
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label>
          <chakra.span paddingBottom="1" display="block" fontSize="sm" fontWeight="medium">
            {formLabel}
          </chakra.span>
          <NativeSelectRoot size="sm" disabled={isAdding || isDisabled} minWidth={16}>
            <NativeSelectField
              placeholder="Select a property to add"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            >
              {properties?.map((comparison) => (
                <option key={comparison} value={comparison}>
                  {comparison}
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
        </label>
        <SafeLoadingButton
          onClick={(e) => {
            e.preventDefault();
            onClickAdd();
          }}
          type="submit"
          size="sm"
          minW={32}
          loading={isAdding || isLoading}
        >
          <span>Add</span>
        </SafeLoadingButton>
      </Stack>
    </Box>
  );
};
