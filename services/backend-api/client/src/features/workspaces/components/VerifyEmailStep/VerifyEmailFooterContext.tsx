import { createContext, useContext, useMemo, useState } from "react";

/**
 * Lets a dialog host render VerifyEmailStep's primary action (Send code /
 * Verify) inside its own DialogFooter — a sibling of DialogBody, so it gets the
 * native edge-to-edge footer divider — while the step keeps ownership of the
 * button's label, loading state, and form association.
 *
 * The step publishes its current primary button here; the host renders
 * <VerifyEmailFooterActions /> inside its DialogFooter to consume it. A full-page
 * host (the invite page) sets up no context, so the step falls back to rendering
 * the button in the body.
 */
const VerifyEmailFooterContext = createContext<{
  hasHost: boolean;
  setPrimaryButton: (button: React.ReactNode) => void;
  primaryButton: React.ReactNode;
} | null>(null);

export const useVerifyEmailFooter = () => useContext(VerifyEmailFooterContext);

/**
 * Wrap a dialog host's DialogBody + DialogFooter so the step (inside the body)
 * can publish its primary action up to <VerifyEmailFooterActions /> (inside the
 * footer). Establishes the host context that switches the step from body-button
 * to footer-button mode.
 */
export const VerifyEmailFooterHost = ({ children }: { children: React.ReactNode }) => {
  const [primaryButton, setPrimaryButton] = useState<React.ReactNode>(null);
  const value = useMemo(
    () => ({ hasHost: true, primaryButton, setPrimaryButton }),
    [primaryButton],
  );

  return <VerifyEmailFooterContext.Provider value={value}>{children}</VerifyEmailFooterContext.Provider>;
};

/**
 * Render inside a host's DialogFooter (after the host's Cancel button) to place
 * the step's current primary action there. Renders nothing until the step has
 * published a button.
 */
export const VerifyEmailFooterActions = () => {
  const ctx = useContext(VerifyEmailFooterContext);

  return <>{ctx?.primaryButton ?? null}</>;
};
