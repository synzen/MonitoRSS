import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { system } from "@/utils/theme";
import { CapacityPicker } from "./CapacityPicker";

const renderPicker = (initialValue = 70, onChange = vi.fn()) => {
  const Picker = () => {
    const [value, setValue] = useState(initialValue);

    return (
      <CapacityPicker
        value={value}
        onChange={(nextValue) => {
          setValue(nextValue);
          onChange(nextValue);
        }}
      />
    );
  };

  return render(
    <ChakraProvider value={system}>
      <Picker />
    </ChakraProvider>,
  );
};

describe("CapacityPicker", () => {
  it("offers presets in one labelled keyboard-operable radio group", async () => {
    const user = userEvent.setup();
    renderPicker();

    const group = screen.getByRole("radiogroup", { name: "Feed capacity" });
    const base = screen.getByRole("radio", { name: "70 feeds" });
    const nextPreset = screen.getByRole("radio", { name: "140 feeds" });

    expect(base).toBeChecked();
    expect(screen.getByRole("radio", { name: "2,000 feeds" })).toBeInTheDocument();
    expect(screen.queryByText("Quick picks")).not.toBeInTheDocument();

    base.focus();
    await user.keyboard("{ArrowDown}");

    expect(nextPreset).toBeChecked();
    expect(group).toContainElement(nextPreset);
  });

  it("selects a preset when an exact custom value matches one", async () => {
    const user = userEvent.setup();
    renderPicker();

    const input = screen.getByRole("spinbutton", { name: "Or enter an exact feed capacity" });
    await user.clear(input);
    await user.type(input, "300");
    await user.keyboard("{Enter}");

    expect(screen.getByRole("radio", { name: "300 feeds" })).toBeChecked();
    expect(input).toHaveAttribute("aria-valuetext", "300 feeds");
  });

  it("commits non-preset exact values without changing the preset radio focus", async () => {
    const user = userEvent.setup();
    renderPicker();

    const input = screen.getByRole("spinbutton", { name: "Or enter an exact feed capacity" });
    await user.clear(input);
    await user.type(input, "837");
    await user.keyboard("{Enter}");

    expect(input).toHaveAttribute("aria-valuetext", "837 feeds");
    expect(screen.queryByRole("radio", { checked: true })).not.toBeInTheDocument();
  });

  it("clamps direct entry and follows the maximum preset", async () => {
    const user = userEvent.setup();
    renderPicker();

    const input = screen.getByRole("spinbutton", { name: "Or enter an exact feed capacity" });
    await user.clear(input);
    await user.type(input, "2100");
    await user.keyboard("{Enter}");

    expect(input).toHaveValue(2000);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("radio", { name: "2,000 feeds" })).toBeChecked();
    expect(screen.getByText(/choose a whole number from 70 to 2,000 feeds/i)).toBeInTheDocument();
  });

  it("seeds a non-preset value without firing an update", () => {
    const onChange = vi.fn();
    renderPicker(837, onChange);

    expect(screen.queryByRole("radio", { checked: true })).not.toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Or enter an exact feed capacity" })).toHaveValue(837);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not increment the exact input with arrow keys", async () => {
    const user = userEvent.setup();
    renderPicker(837);

    const input = screen.getByRole("spinbutton", { name: "Or enter an exact feed capacity" });
    await user.click(input);
    await user.keyboard("{ArrowUp}{ArrowDown}");

    expect(input).toHaveValue(837);
  });
});
