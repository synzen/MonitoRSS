/* eslint-disable no-nested-ternary */
import { GroupBase, StylesConfig } from "react-select";
import getChakraColor from "@/utils/getChakraColor";

interface SelectOption {
  value: string;
  label: string;
  icon?: string | React.ReactNode;
}

type SelectStyles = StylesConfig<SelectOption, false, GroupBase<SelectOption>> | undefined;

export const REACT_SELECT_STYLES: SelectStyles = {
  menu: (provided) => ({
    ...provided,
    backgroundColor: getChakraColor("gray.700"),
    height: "40px",
  }),
  indicatorSeparator: (provided) => ({
    ...provided,
    color: "green",
    background: getChakraColor("gray.600"),
  }),
  control: (provided, state) => ({
    ...provided,
    background: getChakraColor("gray.800"),
    // backgrounf: 'green',
    color: "white",
    height: "40px",
    paddingLeft: "8px",
    borderWidth: "1px",
    borderColor: state.isFocused ? getChakraColor("gray.600") : getChakraColor("gray.700"),
    "&:hover": {
      borderColor: getChakraColor("gray.600"),
    },
    borderRadius: "4px",
    // background: 'green',
  }),
  input: (provided) => ({
    ...provided,
    color: getChakraColor("gray.50"),
  }),
  singleValue: (provided, state) => ({
    ...provided,
    color: state.isDisabled ? getChakraColor("gray.500") : getChakraColor("gray.50"),
  }),
  option: (provided, state) => ({
    ...provided,
    color: "rgba(255,255,255,0.92)",
    background:
      state.isFocused && !state.isSelected
        ? getChakraColor("gray.600")
        : state.isSelected
        ? getChakraColor("blue.500")
        : getChakraColor("gray.800"),
    // background: 'green',
  }),
  container: (provided) => ({
    ...provided,
    borderWidth: "1px",
    // background: 'green',
    borderRadius: "4px",
  }),
  menuList: (provided) => ({
    ...provided,
    borderWidth: "1px",
    background: getChakraColor("gray.800"),
  }),
  placeholder: (provided) => ({
    ...provided,
    color: getChakraColor("gray.400"),
  }),
};
