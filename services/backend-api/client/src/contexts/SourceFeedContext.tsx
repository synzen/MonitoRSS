import React, { createContext, useMemo, useState } from "react";

// Define a type for the source feed data
export interface SourceFeedData {
  id: string;
  title: string;
  url: string;
}

export interface SourceFeedContextValue {
  sourceFeed: SourceFeedData | null;
  setSourceFeed: (feed: SourceFeedData | null) => void;
}

// Create a context for sharing the selected source feed across components
export const SourceFeedContext = createContext<SourceFeedContextValue>({
  sourceFeed: null,
  setSourceFeed: () => {},
});

export const SourceFeedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sourceFeed, setSourceFeedState] = useState<SourceFeedData | null>(null);

  // Create memoized context value to prevent unnecessary re-renders
  const contextValue: SourceFeedContextValue = useMemo(
    () => ({
      sourceFeed,
      setSourceFeed: (feed: SourceFeedData | null) => setSourceFeedState(feed),
      // Computed properties for backward compatibility
      sourceFeedId: sourceFeed?.id || null,
      setSourceFeedId: (id: string | null) => {
        if (!id) {
          setSourceFeedState(null);
        }
        // Note: When setting just the ID, the title and URL will need to be filled
        // by the consumer that calls this method, typically via another API call
        else if (!sourceFeed || sourceFeed.id !== id) {
          setSourceFeedState({
            id,
            title: "", // Placeholder until actual data is loaded
            url: "", // Placeholder until actual data is loaded
          });
        }
      },
    }),
    [sourceFeed],
  );

  return <SourceFeedContext.Provider value={contextValue}>{children}</SourceFeedContext.Provider>;
};

// Custom hook for easier use of the context
export const useSourceFeed = (): SourceFeedContextValue => {
  const context = React.useContext(SourceFeedContext);

  if (!context) {
    throw new Error("useSourceFeed must be used within a SourceFeedProvider");
  }

  return context;
};

// Helper hook for components that need to update the source feed with complete data
export const useSetSourceFeedWithData = () => {
  const { setSourceFeed } = useSourceFeed();

  return (data: SourceFeedData | null): void => {
    setSourceFeed(data);
  };
};
