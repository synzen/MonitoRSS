/* eslint-disable react/no-unstable-nested-components */
import { Avatar, HStack, Text, useColorModeValue } from "@chakra-ui/react";
import Select, { AriaOnFocusProps, GroupBase, StylesConfig, components } from "react-select";
import { ChevronDownIcon } from "@chakra-ui/icons";
import StateManagedSelect from "react-select/dist/declarations/src/stateManager";
import { REACT_SELECT_STYLES } from "@/constants/reactSelectStyles";

const { Option, DropdownIndicator } = components;

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
  selectProps?: React.ComponentProps<typeof StateManagedSelect>;
  inputRef?: React.ComponentProps<typeof Select>["ref"];
  isInvalid: boolean;
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
  selectProps,
  inputRef,
  isInvalid,
}: Props<T>) => {
  // @ts-ignore
  const styles = useColorModeValue<SelectStyles, SelectStyles>({}, REACT_SELECT_STYLES);
  const selectedOption = options.find((option) => option.value === value);

  const onFocus = ({ focused }: AriaOnFocusProps<SelectOption<T>, GroupBase<SelectOption<T>>>) => {
    const msg = `You are currently focused on option ${focused.label}`;

    return msg;
  };

  return (
    <Select
      id={id}
      isDisabled={isDisabled}
      isLoading={loading}
      options={options}
      onBlur={onBlur}
      name={name}
      aria-invalid={isInvalid}
      ariaLiveMessages={{ onFocus: onFocus as never }}
      placeholder={placeholder}
      isClearable={isClearable}
      ref={inputRef}
      menuPosition="fixed"
      // @ts-ignore
      styles={styles}
      value={selectedOption || ""}
      onChange={(option: any) => {
        onChange((option as SelectOption<T>)?.value || "", (option as SelectOption<T>)?.data);
      }}
      components={{
        Option: IconOption as never,
        NoOptionsMessage: (props: any) => (
          <components.NoOptionsMessage {...props}>
            <span>No results found</span>
          </components.NoOptionsMessage>
        ),
        DropdownIndicator: ChakraDropdownIndicator as never,
      }}
      onInputChange={(input: any) => onInputChange?.(input)}
      {...selectProps}
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
          <Avatar aria-hidden src={castedData.icon} name={castedData.value} size="xs" />
        )}
        {typeof castedData.icon === "object" && castedData.icon}
        <Text>{castedData.label}</Text>
      </HStack>
    </Option>
  );
};

const ChakraDropdownIndicator = (props: Parameters<typeof DropdownIndicator>[0]) => {
  return (
    <components.DropdownIndicator {...props}>
      <ChevronDownIcon fontSize="lg" />
    </components.DropdownIndicator>
  );
};
