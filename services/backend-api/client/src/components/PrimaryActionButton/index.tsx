import { ButtonProps } from "@chakra-ui/react";
import { forwardRef } from "react";
import { SafeLoadingButton } from "@/components/SafeLoadingButton";

/**
 * The app's primary call-to-action button. Owns the accent so call sites express the ROLE ("this is
 * the primary action") instead of naming a color — the same Tier-2 move `Panel` makes for cards. The
 * accent color lives in the `brand` palette (theme.ts), so re-skinning it is a one-line theme edit,
 * not a sweep across every call site. Use this instead of `<Button colorPalette="blue">` for the
 * main action of a form/dialog/page. For secondary actions use a plain `<Button variant="ghost">`;
 * for destructive or status actions keep an explicit status `colorPalette` (`red`/`green`/…) — those
 * are per-instance intent, not the app accent.
 */
export const PrimaryActionButton = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => (
  <SafeLoadingButton ref={ref} variant="solid" colorPalette="brand" {...props} />
));

PrimaryActionButton.displayName = "PrimaryActionButton";
