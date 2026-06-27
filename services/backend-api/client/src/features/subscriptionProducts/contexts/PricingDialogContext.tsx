import { PropsWithChildren, createContext, useEffect, useMemo, useState } from "react";
import { useDisclosure } from "@chakra-ui/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PricingDialog } from "../components/PricingDialog";
import { pages } from "@/constants";

// Where the pricing dialog should land when opened. "workspace" scrolls/focuses
// the workspace region (used by the personal feed-limit wall, which points users
// at workspaces for more capacity). Omitted means open at the top as before.
export type PricingDialogTarget = "workspace";

interface ContextProps {
  onOpen: (target?: PricingDialogTarget) => void;
}

export const PricingDialogContext = createContext<ContextProps>({
  onOpen: () => {},
});

export const PricingDialogProvider = ({ children }: PropsWithChildren<{}>) => {
  const [searchParams] = useSearchParams();
  const priceId = searchParams.get("priceId");
  const { open, onOpen: onOpenDisclosure, onClose } = useDisclosure();
  const [target, setTarget] = useState<PricingDialogTarget | undefined>();
  const navigate = useNavigate();

  useEffect(() => {
    if (priceId) {
      navigate(pages.checkout(priceId));
    }
  }, [priceId]);

  const value = useMemo(
    () => ({
      onOpen: (nextTarget?: PricingDialogTarget) => {
        setTarget(nextTarget);
        onOpenDisclosure();
      },
    }),
    [onOpenDisclosure],
  );

  // Clear the target on close so an internal reopen (e.g. a cancellation flow
  // that reopens the dialog) starts at the top instead of re-scrolling to the
  // workspace region from a stale target.
  const handleClose = () => {
    setTarget(undefined);
    onClose();
  };

  return (
    <PricingDialogContext.Provider value={value}>
      <PricingDialog
        isOpen={open}
        onOpen={onOpenDisclosure}
        onClose={handleClose}
        target={target}
      />
      {children}
    </PricingDialogContext.Provider>
  );
};
