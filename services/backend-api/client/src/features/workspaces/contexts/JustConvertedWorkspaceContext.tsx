import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";

interface JustConvertedWorkspaceContextValue {
  // True from the moment an owner confirms a personal-plan conversion until the
  // feeds page shows (and the user dismisses) the "plan moved here" banner.
  justConverted: boolean;
  markConverted: () => void;
  clearConverted: () => void;
}

const JustConvertedWorkspaceContext = createContext<JustConvertedWorkspaceContextValue>({
  justConverted: false,
  markConverted: () => {},
  clearConverted: () => {},
});

/**
 * Carries the one-shot "a conversion was just confirmed" signal from the convert
 * dialog (in the dormant activation empty state) to the feeds page, which shows a
 * success banner once the workspace activates.
 *
 * In-memory and provided at the scope layout, which outlives the empty state: the
 * dialog and the banner live in the same render tree, so no cross-page persistence
 * is needed. The signal naturally resets on a real navigation away (the workspace
 * is already active by then, so there is nothing left to confirm).
 */
export const JustConvertedWorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const [justConverted, setJustConverted] = useState(false);

  const markConverted = useCallback(() => setJustConverted(true), []);
  const clearConverted = useCallback(() => setJustConverted(false), []);

  const value = useMemo(
    () => ({ justConverted, markConverted, clearConverted }),
    [justConverted, markConverted, clearConverted],
  );

  return (
    <JustConvertedWorkspaceContext.Provider value={value}>
      {children}
    </JustConvertedWorkspaceContext.Provider>
  );
};

export const useJustConvertedWorkspace = () => useContext(JustConvertedWorkspaceContext);
