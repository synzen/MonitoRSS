import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { FeedLevelStateDisplay } from "../../features/feed/components/UserFeedLogs/DeliveryPreview/FeedLevelStateDisplay";
import {
  createFeedState404,
  createFeedState403,
  createFeedState429,
  createFeedState5xx,
  createFetchTimeout,
  createFetchFailed,
  createFetchInternalError,
  createParseTimeout,
  createParseInvalidFormat,
} from "./mockFactories";

const meta = {
  title: "Feed/DeliveryPreview/FeedLevelStateDisplay",
  component: FeedLevelStateDisplay,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    (Story: React.ComponentType) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof FeedLevelStateDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

// HTTP Errors

export const Http404NotFound: Story = {
  args: {
    feedState: createFeedState404(),
    feedId: "feed-123",
  },
};

export const Http403Forbidden: Story = {
  args: {
    feedState: createFeedState403(),
    feedId: "feed-123",
  },
};

export const Http429RateLimited: Story = {
  args: {
    feedState: createFeedState429(),
    feedId: "feed-123",
  },
};

export const Http5xxServerError: Story = {
  args: {
    feedState: createFeedState5xx(),
    feedId: "feed-123",
  },
};

// Fetch Errors (non-HTTP)

export const FetchTimeout: Story = {
  args: {
    feedState: createFetchTimeout(),
    feedId: "feed-123",
  },
};

export const FetchFailed: Story = {
  args: {
    feedState: createFetchFailed(),
    feedId: "feed-123",
  },
};

export const FetchInternalError: Story = {
  args: {
    feedState: createFetchInternalError(),
    feedId: "feed-123",
  },
};

// Parse Errors

export const ParseTimeout: Story = {
  args: {
    feedState: createParseTimeout(),
    feedId: "feed-123",
  },
};

export const ParseInvalidFormat: Story = {
  args: {
    feedState: createParseInvalidFormat(),
    feedId: "feed-123",
  },
};
