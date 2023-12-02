import { PropsWithChildren, createContext, useMemo } from "react";
import { useDisclosure } from "@chakra-ui/react";
import { PricingDialog } from "../components/PricingDialog";

interface ContextProps {
  onOpen: () => void;
}

export const PricingDialogContext = createContext<ContextProps>({
  onOpen: () => {},
});

export const PricingDialogProvider = ({ children }: PropsWithChildren<{}>) => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const value = useMemo(
    () => ({
      onOpen,
    }),
    [onOpen]
  );

  return (
    <PricingDialogContext.Provider value={value}>
      <PricingDialog isOpen={isOpen} onOpen={onOpen} onClose={onClose} />
      {children}
    </PricingDialogContext.Provider>
  );
};
