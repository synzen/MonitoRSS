import { Box, Button, Select, Stack, chakra } from "@chakra-ui/react";
import { useState } from "react";

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
          <Select
            size="sm"
            isDisabled={isAdding || isDisabled}
            minWidth={16}
            placeholder="Select a property to add"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          >
            {properties?.map((comparison) => (
              <option value={comparison}>{comparison}</option>
            ))}
          </Select>
        </label>
        <Button
          onClick={(e) => {
            e.preventDefault();
            onClickAdd();
          }}
          type="submit"
          size="sm"
          minW={32}
          isLoading={isAdding || isLoading}
        >
          Add
        </Button>
      </Stack>
    </Box>
  );
};
