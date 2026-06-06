import { PropsWithChildren } from "react";
import { Panel } from "@/components/Panel";

/**
 * Tab-body card. A thin alias of {@link Panel} with the tab-specific padding and a TRANSPARENT
 * surface: the tab body recedes to the page so a dense form doesn't become one continuous slab —
 * structure comes from the genuine sub-cards (`<Panel>`) inside it, which carry the fill. Kept as a
 * named component because ~15 call sites use it; new containers use `<Panel>` directly. See
 * docs/adr/007-styling-roles-tiers-contrast.md.
 */
export const TabContentContainer = ({ children }: PropsWithChildren) => {
  return (
    <Panel surface="transparent" py={4} px={[2, 4, 6]}>
      {children}
    </Panel>
  );
};
