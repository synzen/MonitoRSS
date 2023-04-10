import { AddIcon } from "@chakra-ui/icons";
import { Flex, IconButton, Select } from "@chakra-ui/react";
import { useState } from "react";

interface Props {
  properties?: string[];
  isDisabled?: boolean;
  isLoading?: boolean;
  onChange: (value: string) => Promise<void>;
}

export const AddComparisonSelect = ({ properties, isDisabled, isLoading, onChange }: Props) => {
  const [value, setValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const onClickAdd = async () => {
    setIsAdding(true);
    await onChange(value);
    setValue("");
    setIsAdding(false);
  };

  return (
    <Flex>
      <Select
        size="sm"
        borderTopLeftRadius="lg"
        borderBottomLeftRadius="lg"
        borderTopRightRadius={0}
        borderBottomRightRadius={0}
        isDisabled={isAdding || isDisabled}
        minWidth={16}
        borderRightStyle="none"
        borderColor="gray.700"
        placeholder="Select a property to add"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      >
        {properties?.map((comparison) => (
          <option value={comparison}>{comparison}</option>
        ))}
      </Select>
      <IconButton
        size="sm"
        borderTopLeftRadius="0"
        borderBottomLeftRadius={0}
        icon={<AddIcon />}
        isDisabled={isAdding || isDisabled || !value}
        aria-label="Add comparison"
        isLoading={isAdding || isLoading}
        onClick={onClickAdd}
      />
    </Flex>
  );
};
