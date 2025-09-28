import { useCallback } from "react";

const TOUR_STORAGE_KEY = "previewer-tour-completed";

export const usePreviewerTour = () => {
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
      // Reload the page to trigger the tour again
      window.location.reload();
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
  };
};