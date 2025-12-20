import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import {
  ArticleStatusPresentational,
  ArticleStatusPresentationalProps,
} from "../../features/feed/components/UserFeedLogs/ArticleStatus";
import { UserFeedContext } from "../../contexts/UserFeedContext";
import { UserFeed } from "../../features/feed/types";
import {
  createNormalDeliveryArticles,
  createLearningPhaseArticles,
  createRateLimitedArticles,
  createAllProcessedArticles,
  createFeedUnchangedArticles,
  createFeedState404,
  mockUserFeed,
  mockConnections,
} from "./mockFactories";

// Mock UserFeed context provider
const MockUserFeedProvider = ({ children }: { children: React.ReactNode }) => (
  <UserFeedContext.Provider
    value={{
      userFeed: { ...mockUserFeed, connections: mockConnections } as unknown as UserFeed,
      articleFormatOptions: {
        externalProperties: [],
        formatTables: false,
        stripImages: false,
      },
    }}
  >
    {children}
  </UserFeedContext.Provider>
);

const defaultArgs: Partial<ArticleStatusPresentationalProps> = {
  feedId: "feed-123",
  refreshRateSeconds: 600,
  addConnectionUrl: "/feeds/feed-123?tab=connections",
  lastCheckedFormatted: "just now",
};

const meta = {
  title: "Feed/ArticleStatus/ArticleStatus",
  component: ArticleStatusPresentational,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    (Story: React.ComponentType) => (
      <MemoryRouter>
        <MockUserFeedProvider>
          <Story />
        </MockUserFeedProvider>
      </MemoryRouter>
    ),
  ],
  args: defaultArgs,
} satisfies Meta<typeof ArticleStatusPresentational>;

export default meta;
type Story = StoryObj<typeof meta>;

// Container States

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};

export const ErrorState: Story = {
  args: {
    error: new Error("Failed to fetch article diagnostics. Please try again later."),
  },
};

export const NoConnections: Story = {
  args: {
    hasNoConnections: true,
    results: [],
  },
};

export const NoArticles: Story = {
  args: {
    results: [],
    total: 0,
  },
};

// Success States with Pattern Alerts

export const NormalDelivery: Story = {
  args: {
    results: createNormalDeliveryArticles(),
    total: 5,
    hasMore: false,
  },
};

export const LearningPhase: Story = {
  args: {
    results: createLearningPhaseArticles(),
    total: 10,
    hasMore: false,
  },
};

export const RateLimited: Story = {
  args: {
    results: createRateLimitedArticles(),
    total: 10,
    hasMore: false,
  },
};

export const AllProcessed: Story = {
  args: {
    results: createAllProcessedArticles(),
    total: 10,
    hasMore: false,
  },
};

export const FeedUnchanged: Story = {
  args: {
    results: createFeedUnchangedArticles(),
    total: 5,
    hasMore: false,
  },
};

// Feed-Level Errors

export const FeedError: Story = {
  args: {
    feedState: createFeedState404(),
    results: [],
    total: 0,
  },
};
