/* eslint-disable no-nested-ternary */
import { GroupBase, StylesConfig } from "react-select";
import { theme } from "@chakra-ui/react";
import getChakraColor from "@/utils/getChakraColor";

export interface SelectOption {
  value: string;
  label: string;
  icon?: string | React.ReactNode;
  description?: string;
}

type SelectStyles = StylesConfig<SelectOption, false, GroupBase<SelectOption>> | undefined;

export const REACT_SELECT_STYLES: SelectStyles = {
  menu: (provided) => ({
    ...provided,
    backgroundColor: getChakraColor("gray.700"),
    height: "40px",
  }),
  indicatorSeparator: (provided) => {
    return {
      ...provided,
      // color: "green",
      background: getChakraColor("gray.600"),
    };
  },
  dropdownIndicator: (provided, state) => {
    return {
      ...provided,
      color: state.isFocused ? "gray.500" : "gray.400",
      "&:hover": {
        color: "gray.400",
      },
    };
  },
  control: (provided, state) => ({
    ...provided,
    background: getChakraColor("gray.800"),
    color: "white",
    height: "40px",
    paddingLeft: "8px",
    borderWidth: "1px",
    borderColor: state.isFocused ? theme.colors.blue[300] : "none",
    borderRadius: theme.radii.md,
    "&:hover": {
      borderColor: "whiteAlpha.400",
    },
    boxShadow: state.isFocused ? `0 0 0 1px ${theme.colors.blue[300]}` : "none",
  }),
  input: (provided) => ({
    ...provided,
    color: getChakraColor("gray.50"),
    minWidth: "200px",
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
  }),
  container: (provided) => ({
    ...provided,
    borderStyle: "none",
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
