import { PropsWithChildren, createContext, useEffect, useMemo } from "react";
import { useDisclosure } from "@chakra-ui/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PricingDialog } from "../components/PricingDialog";
import { pages } from "../constants";

interface ContextProps {
  onOpen: () => void;
}

export const PricingDialogContext = createContext<ContextProps>({
  onOpen: () => {},
});

export const PricingDialogProvider = ({ children }: PropsWithChildren<{}>) => {
  const [searchParams] = useSearchParams();
  const priceId = searchParams.get("priceId");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const navigate = useNavigate();

  useEffect(() => {
    if (priceId) {
      navigate(pages.checkout(priceId));
    }
  }, [priceId]);

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
