import { Box, BoxProps } from "@chakra-ui/react";
import { forwardRef } from "react";

/**
 * Semantic intent for the top accent stripe — callers express MEANING, not a color, so no call site
 * names a palette. `Panel` maps each intent to the right token in one place (below). `brand` points
 * at the semantic `brandSolid` accent role (theme.ts), so re-skinning the accent is a one-line theme
 * edit, not a change here. `info`/`error` use Chakra's built-in status border roles.
 */
export type PanelAccent = "brand" | "info" | "error";

const ACCENT_TOKEN: Record<PanelAccent, string> = {
  brand: "brandSolid",
  info: "border.info",
  error: "border.error",
};

type PanelSurface = "panel" | "subtle" | "transparent";

const SURFACE_BG: Record<PanelSurface, string> = {
  panel: "bg.panel",
  subtle: "bg.subtle",
  transparent: "transparent",
};

export interface PanelProps extends BoxProps {
  /**
   * Which surface token the panel paints. `panel` (default) is the standard card; `subtle` is for a
   * nested/raised section (same dark value — separation comes from the border, per the elevation
   * ladder in docs/adr/007-styling-roles-tiers-contrast.md); `transparent` is a bordered card that inherits
   * the surface behind it (e.g. a list box sitting directly on a dialog panel, or a tab body).
   */
  surface?: PanelSurface;
  /**
   * Optional accent stripe along the top edge (the "active preview" / status-banner pattern). Pass a
   * semantic intent (`brand` / `info` / `error`), not a color. Omit for a plain card.
   */
  accent?: PanelAccent;
}

/**
 * The single home for "what an app container card looks like": surface + 1px border + md radius +
 * padding. The `Panel` container encoding (docs/adr/007-styling-roles-tiers-contrast.md) — adopt
 * this instead of repeating `bg`/`borderColor`/`borderRadius` props per container. Editing the look
 * here re-skins every panel at once. `TabContentContainer` is a thin alias of the default variant.
 */
export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ surface = "panel", accent, children, ...rest }, ref) => {
    return (
      <Box
        ref={ref}
        bg={SURFACE_BG[surface]}
        borderWidth="1px"
        borderColor="border"
        borderRadius="l3"
        {...(accent ? { borderTopWidth: "4px", borderTopColor: ACCENT_TOKEN[accent] } : {})}
        {...rest}
      >
        {children}
      </Box>
    );
  },
);

Panel.displayName = "Panel";
