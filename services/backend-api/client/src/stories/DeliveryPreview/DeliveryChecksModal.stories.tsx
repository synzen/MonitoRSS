import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { DeliveryChecksModal } from "../../features/feed/components/UserFeedLogs/DeliveryPreview/DeliveryChecksModal";
import { UserFeedContext } from "../../contexts/UserFeedContext";
import { UserFeed } from "../../features/feed/types";
import { ArticleDeliveryOutcome } from "../../features/feed/types/DeliveryPreview";
import {
  createLearningArticle,
  createBlockedByFiltersArticle,
  createRateLimitedArticle,
  createArticleResult,
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

const meta = {
  title: "Feed/DeliveryPreview/DeliveryChecksModal",
  component: DeliveryChecksModal,
  parameters: {
    layout: "centered",
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
} satisfies Meta<typeof DeliveryChecksModal>;

export default meta;
type Story = StoryObj<typeof meta>;

// Special Centered States

export const LearningPhase: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    result: createLearningArticle(),
  },
};

export const FeedUnchanged: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    result: createArticleResult(ArticleDeliveryOutcome.FeedUnchanged, {
      articleTitle: "Feed Content Unchanged Example",
      connectionIds: [],
    }),
  },
};

export const FeedError: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    result: createArticleResult(ArticleDeliveryOutcome.FeedError, {
      articleTitle: "Feed Error Example",
      connectionIds: [],
    }),
  },
};

// Stage Failure Examples

export const FailedAtFilter: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    result: createBlockedByFiltersArticle(),
  },
};

export const FailedAtRateLimit: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    result: createRateLimitedArticle(),
  },
};
