/* eslint-disable react/no-unstable-nested-components */
import { Avatar, HStack, Text, useColorModeValue } from "@chakra-ui/react";
import Select, { GroupBase, StylesConfig, components } from "react-select";
import { FilterOptionOption } from "react-select/dist/declarations/src/filters";
import { REACT_SELECT_STYLES } from "@/constants/reactSelectStyles";

const { Option } = components;

interface SelectOption<T> {
  value: string;
  label: string | React.ReactNode;
  icon?: string | React.ReactNode;
  data: T;
}
type SelectStyles<T> = StylesConfig<SelectOption<T>, false, GroupBase<SelectOption<T>>> | undefined;

interface Props<T> {
  value?: string;
  options: SelectOption<T>[];
  loading?: boolean;
  isDisabled?: boolean;
  id?: string;
  onBlur?: () => void;
  onChange: (value: string, data: T) => void;
  name?: string;
  isClearable?: boolean;
  onInputChange?: (value: string) => void;
  placeholder?: string | React.ReactNode;
  filterFunction?: (option: FilterOptionOption<string | SelectOption<T>>, input: string) => boolean;
}

export const ThemedSelect = <T,>({
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
  filterFunction,
}: Props<T>) => {
  // @ts-ignore
  const styles = useColorModeValue<SelectStyles, SelectStyles>({}, REACT_SELECT_STYLES);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <Select
      id={id}
      isDisabled={isDisabled}
      isLoading={loading}
      options={options}
      onBlur={onBlur}
      name={name}
      placeholder={placeholder}
      isClearable={isClearable}
      filterOption={filterFunction}
      // @ts-ignore
      styles={styles}
      value={selectedOption || ""}
      onChange={(option) => {
        onChange((option as SelectOption<T>)?.value || "", (option as SelectOption<T>)?.data);
      }}
      components={{
        Option: IconOption as never,
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

const IconOption = <T,>(props: IconOptionProps) => {
  const { data } = props;

  const castedData = data as SelectOption<T>;

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
