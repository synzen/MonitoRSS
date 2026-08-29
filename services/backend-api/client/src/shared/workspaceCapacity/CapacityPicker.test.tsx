import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { system } from "@/utils/theme";
import { CapacityPicker } from "./CapacityPicker";

const renderPicker = (initialValue = 70, onChange = vi.fn(), withNextFocusTarget = false) => {
  const Picker = () => {
    const [value, setValue] = useState(initialValue);

    return (
      <>
        <CapacityPicker
          value={value}
          onChange={(nextValue) => {
            setValue(nextValue);
            onChange(nextValue);
          }}
        />
        {withNextFocusTarget && <button type="button">Continue</button>}
      </>
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
    expect(screen.getByRole("radio", { name: "Custom" })).toBeInTheDocument();
    expect(screen.queryByText("Quick picks")).not.toBeInTheDocument();

    base.focus();
    await user.keyboard("{ArrowDown}");

    expect(nextPreset).toBeChecked();
    expect(group).toContainElement(nextPreset);
  });

  it("nests the exact input inside Custom - hidden for presets, visible for Custom", async () => {
    const user = userEvent.setup();
    renderPicker(70);

    expect(screen.queryByRole("spinbutton", { name: "Or enter an exact feed capacity" })).not.toBeInTheDocument();
    expect(screen.queryByText(/choose a whole number from 70 to 2,000 feeds/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Custom" }));

    expect(screen.getByRole("spinbutton", { name: "Or enter an exact feed capacity" })).toBeInTheDocument();
    expect(screen.getByText(/choose a whole number from 70 to 2,000 feeds/i)).toBeInTheDocument();
  });

  it("keeps keyboard focus on Custom when arrowing into it", async () => {
    const user = userEvent.setup();
    renderPicker(70);

    const lastPreset = screen.getByRole("radio", { name: "2,000 feeds" });
    const custom = screen.getByRole("radio", { name: "Custom" });

    lastPreset.focus();
    await user.keyboard("{ArrowRight}");

    expect(custom).toBeChecked();
    expect(custom).toHaveFocus();
    expect(screen.getByRole("spinbutton", { name: "Or enter an exact feed capacity" })).toBeVisible();
  });

  it("keeps Custom selected and expanded after moving from a preset", async () => {
    const user = userEvent.setup();
    renderPicker(70);

    await user.click(screen.getByRole("radio", { name: "140 feeds" }));
    await user.click(screen.getByRole("radio", { name: "Custom" }));

    const custom = screen.getByRole("radio", { name: "Custom" });
    expect(custom).toBeChecked();
    expect(screen.getByRole("spinbutton", { name: "Or enter an exact feed capacity" })).toBeVisible();

    await user.click(custom);

    expect(custom).toBeChecked();
    expect(screen.getByRole("spinbutton", { name: "Or enter an exact feed capacity" })).toBeVisible();
  });

  it("keeps Custom selected when an exact value matches a preset", async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole("radio", { name: "Custom" }));
    const input = screen.getByRole("spinbutton", { name: "Or enter an exact feed capacity" });
    await user.clear(input);
    await user.type(input, "300");
    await user.keyboard("{Enter}");

    expect(screen.getByRole("radio", { name: "Custom" })).toBeChecked();
    expect(screen.getByRole("spinbutton", { name: "Or enter an exact feed capacity" })).toBeVisible();
  });

  it("tabs forward after committing a preset-matching custom value", async () => {
    const user = userEvent.setup();
    renderPicker(70, vi.fn(), true);

    await user.click(screen.getByRole("radio", { name: "Custom" }));
    const input = screen.getByRole("spinbutton", { name: "Or enter an exact feed capacity" });
    await user.clear(input);
    await user.type(input, "300");
    await user.tab();

    expect(screen.getByRole("button", { name: "Continue" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Custom" })).toBeChecked();
    expect(screen.getByRole("spinbutton", { name: "Or enter an exact feed capacity" })).toBeVisible();
  });

  it("commits non-preset exact values without changing the preset radio focus", async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole("radio", { name: "Custom" }));
    const input = screen.getByRole("spinbutton", { name: "Or enter an exact feed capacity" });
    await user.clear(input);
    await user.type(input, "837");
    await user.keyboard("{Enter}");

    expect(screen.getByRole("spinbutton", { name: "Or enter an exact feed capacity" })).toHaveAttribute(
      "aria-valuetext",
      "837 feeds",
    );
    expect(screen.getByRole("radio", { name: "Custom" })).toBeChecked();
  });

  it("clamps direct entry without leaving Custom", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker(70, onChange);

    await user.click(screen.getByRole("radio", { name: "Custom" }));
    const input = screen.getByRole("spinbutton", { name: "Or enter an exact feed capacity" });
    await user.clear(input);
    await user.type(input, "2100");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenLastCalledWith(2000);
    expect(screen.getByRole("radio", { name: "Custom" })).toBeChecked();
    expect(screen.getByRole("spinbutton", { name: "Or enter an exact feed capacity" })).toHaveValue(2000);
  });

  it("seeds a non-preset value without firing an update", () => {
    const onChange = vi.fn();
    renderPicker(837, onChange);

    expect(screen.getByRole("radio", { name: "Custom" })).toBeChecked();
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
