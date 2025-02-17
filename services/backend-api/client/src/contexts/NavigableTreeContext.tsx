import { ReactNode, createContext, useContext, useMemo, useState } from "react";

type ContextProps = {
  currentFocusedId?: string | null;
  setCurrentFocusedId: (id: string | null) => void;
  currentSelectedId?: string | null;
  setCurrentSelectedId: (id: string | null) => void;
};

export const NavigableTreeContext = createContext<ContextProps>({
  setCurrentFocusedId: () => {},
  setCurrentSelectedId: () => {},
});

export const NavigableTreeProvider = ({ children }: { children: ReactNode }) => {
  const [currentFocusedId, setCurrentFocusedId] = useState<string | null>(null);
  const [currentSelectedId, setCurrentSelectedId] = useState<string | null>(null);

  const contextValue = useMemo(() => {
    return {
      currentFocusedId,
      setCurrentFocusedId,
      currentSelectedId,
      setCurrentSelectedId,
    };
  }, [currentFocusedId, setCurrentFocusedId, currentSelectedId, setCurrentSelectedId]);

  return (
    <NavigableTreeContext.Provider value={contextValue}>{children}</NavigableTreeContext.Provider>
  );
};

export const useNavigableTreeContext = () => {
  const contextData = useContext(NavigableTreeContext);

  return contextData;
};
