/* eslint-disable no-nested-ternary */
import { GroupBase, StylesConfig } from "react-select";

export interface SelectOption {
  value: string;
  label: string;
  icon?: string | React.ReactNode;
  description?: string;
}

type SelectStyles = StylesConfig<SelectOption, false, GroupBase<SelectOption>> | undefined;

export const REACT_SELECT_STYLES: (opts?: { invertBg?: boolean }) => SelectStyles = (opts) => ({
  menu: (provided) => ({
    ...provided,
    backgroundColor: "var(--app-bg-panel)",
    height: "40px",
  }),
  indicatorSeparator: (provided) => {
    return {
      ...provided,
      background: "var(--app-border)",
    };
  },
  dropdownIndicator: (provided, state) => {
    return {
      ...provided,
      color: state.isFocused ? "var(--app-fg)" : "var(--app-fg-muted)",
      "&:hover": {
        color: "var(--app-fg)",
      },
    };
  },
  control: (provided, state) => ({
    ...provided,
    width: "100%",
    background: opts?.invertBg ? "var(--app-bg-emphasized)" : "transparent",
    color: "var(--app-fg)",
    height: "40px",
    paddingLeft: "8px",
    borderWidth: "1px",
    // Parity with native inputs: the control edge uses the controlBorder role (>=3:1), not the quiet
    // divider border. Mirrors the Chakra input/select recipe override (see
    // docs/adr/007-styling-roles-tiers-contrast.md — the --app-* boundary keeps react-select in lockstep).
    borderColor: state.isFocused ? "var(--app-accent-focus-ring)" : "var(--app-control-border)",
    borderRadius: "var(--chakra-radii-md)",
    "&:hover": {
      borderColor: "var(--app-control-border)",
    },
    boxShadow: state.isFocused ? "0 0 0 1px var(--app-accent-focus-ring)" : "none",
  }),
  input: (provided) => ({
    ...provided,
    color: "var(--app-fg)",
  }),
  singleValue: (provided, state) => ({
    ...provided,
    color: state.isDisabled ? "var(--app-fg-subtle)" : "var(--app-fg)",
  }),
  option: (provided, state) => ({
    ...provided,
    color: "var(--app-fg)",
    background:
      state.isFocused && !state.isSelected
        ? "var(--app-bg-emphasized)"
        : state.isSelected
          ? "var(--app-accent-solid)"
          : "var(--app-bg-panel)",
  }),
  container: (provided) => ({
    ...provided,
    borderStyle: "none",
    width: "100%",
  }),
  menuList: (provided) => ({
    ...provided,
    borderWidth: "1px",
    background: "var(--app-bg-panel)",
  }),
  placeholder: (provided) => ({
    ...provided,
    color: "var(--app-fg-muted)",
  }),
});
