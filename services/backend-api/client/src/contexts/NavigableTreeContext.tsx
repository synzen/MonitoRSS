import { ReactNode, createContext, useContext, useMemo, useState } from "react";

type ContextProps = {
  currentFocusedId?: string | null;
  setCurrentFocusedId: (id: string | null) => void;
  currentSelectedId?: string | null;
  setCurrentSelectedId: (id: string | null) => void;
  expandedIds: Set<string>;
  setExpandedIds: (ids: (prev: Set<string>) => Set<string>) => void;
};

export const NavigableTreeContext = createContext<ContextProps>({
  setCurrentFocusedId: () => {},
  setCurrentSelectedId: () => {},
  setExpandedIds: () => {},
  expandedIds: new Set(),
});

export const NavigableTreeProvider = ({
  children,
  defaultExpandedIds,
}: {
  children: ReactNode;
  defaultExpandedIds?: Set<string>;
}) => {
  const [currentFocusedId, setCurrentFocusedId] = useState<string | null>(null);
  const [currentSelectedId, setCurrentSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(defaultExpandedIds || new Set());

  const contextValue = useMemo(() => {
    return {
      currentFocusedId,
      setCurrentFocusedId,
      currentSelectedId,
      setCurrentSelectedId,
      expandedIds,
      setExpandedIds,
    };
  }, [
    currentFocusedId,
    setCurrentFocusedId,
    currentSelectedId,
    setCurrentSelectedId,
    expandedIds,
    setExpandedIds,
  ]);

  return (
    <NavigableTreeContext.Provider value={contextValue}>{children}</NavigableTreeContext.Provider>
  );
};

export const useNavigableTreeContext = () => {
  const contextData = useContext(NavigableTreeContext);

  return contextData;
};
