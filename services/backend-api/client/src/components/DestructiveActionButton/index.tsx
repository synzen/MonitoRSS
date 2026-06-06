import { Button, ButtonProps } from "@chakra-ui/react";
import { forwardRef } from "react";

/**
 * A destructive action button (delete, discard, remove, cancel-subscription). Owns the destructive
 * look so call sites express the ROLE instead of stacking `variant="outline" colorPalette="red"` —
 * the same Tier-2 move `PrimaryActionButton` makes for the accent. It overrides the border to the
 * palette's `fg` (the same soft red as the label) because the global `outline` button recipe pins
 * every outline border to the neutral `controlBorder` (theme.ts), which left red-labelled outline
 * buttons sitting in a grey box; matching the border to the text keeps the two tones cohesive
 * instead of pairing pale text with a vivid `solid` edge. The red status hue lives in the `red`
 * palette; reskin it there, not at the call site. For the loud final confirm inside a dialog a solid
 * `<Button colorPalette="red">` still fits.
 */
export const DestructiveActionButton = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => (
  <Button
    ref={ref}
    variant="outline"
    colorPalette="red"
    color="colorPalette.fg"
    borderColor="colorPalette.fg"
    _hover={{ bg: "colorPalette.subtle" }}
    {...props}
  />
));

DestructiveActionButton.displayName = "DestructiveActionButton";
