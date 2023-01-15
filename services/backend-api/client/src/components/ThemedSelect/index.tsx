/* eslint-disable react/no-unstable-nested-components */
import { Avatar, HStack, Text, useColorModeValue } from "@chakra-ui/react";
import Select, { GroupBase, StylesConfig, components } from "react-select";
import { REACT_SELECT_STYLES } from "@/constants/reactSelectStyles";

const { Option } = components;

interface SelectOption {
  value: string;
  label: string | React.ReactNode;
  icon?: string | React.ReactNode;
}
type SelectStyles = StylesConfig<SelectOption, false, GroupBase<SelectOption>> | undefined;

interface Props {
  value?: string;
  options: SelectOption[];
  loading?: boolean;
  isDisabled?: boolean;
  id?: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
  name?: string;
  isClearable?: boolean;
  onInputChange?: (value: string) => void;
  placeholder?: string | React.ReactNode;
}

export const ThemedSelect: React.FC<Props> = ({
  value,
  options,
  loading,
  onChange,
  onBlur,
  id,
  isDisabled,
  name,
  isClearable,
  placeholder,
  onInputChange,
}) => {
  // @ts-ignore
  const styles = useColorModeValue<SelectStyles, SelectStyles>({}, REACT_SELECT_STYLES);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <Select
      id={id}
      inputV
      isDisabled={isDisabled}
      isLoading={loading}
      options={options}
      onBlur={onBlur}
      name={name}
      placeholder={placeholder}
      isClearable={isClearable}
      // @ts-ignore
      styles={styles}
      value={selectedOption || ""}
      onChange={(option) => {
        onChange((option as SelectOption)?.value || "");
      }}
      components={{
        Option: IconOption,
        NoOptionsMessage: (props) => (
          <components.NoOptionsMessage {...props}>
            <span>No results found</span>
          </components.NoOptionsMessage>
        ),
      }}
      onInputChange={(input) => onInputChange?.(input)}
    />
  );
};

type IconOptionProps = Parameters<typeof Option>[0];

const IconOption: React.FC<IconOptionProps> = (props) => {
  const { data } = props;

  const castedData = data as SelectOption;

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <Option {...props}>
      <HStack alignItems="center">
        {typeof castedData.icon === "string" && (
          <Avatar src={castedData.icon} name={castedData.value} size="xs" />
        )}
        {typeof castedData.icon === "object" && castedData.icon}
        <Text>{castedData.label}</Text>
      </HStack>
    </Option>
  );
};
