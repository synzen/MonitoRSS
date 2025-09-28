import { useCallback, useState } from "react";

const TOUR_STORAGE_KEY = "previewer-tour-completed";

export const usePreviewerTour = () => {
  const [resetTrigger, setResetTrigger] = useState(0);

  const hasCompletedTour = useCallback(() => {
    try {
      return localStorage.getItem(TOUR_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }, []);

  const resetTour = useCallback(() => {
    try {
      localStorage.removeItem(TOUR_STORAGE_KEY);
      // Trigger a re-render to restart the tour programmatically
      setResetTrigger((prev) => prev + 1);
    } catch {
      // Silently fail if localStorage is not available
    }
  }, []);

  const markTourCompleted = useCallback(() => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
    } catch {
      // Silently fail if localStorage is not available
    }
  }, []);

  return {
    hasCompletedTour: hasCompletedTour(),
    resetTour,
    markTourCompleted,
    resetTrigger,
  };
};
