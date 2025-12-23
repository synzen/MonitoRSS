import type { Meta, StoryObj } from "@storybook/react-vite";
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
} satisfies Meta<typeof FeedLevelStateDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

// HTTP Errors

export const Http404NotFound: Story = {
  args: {
    feedState: createFeedState404(),
  },
};

export const Http403Forbidden: Story = {
  args: {
    feedState: createFeedState403(),
  },
};

export const Http429RateLimited: Story = {
  args: {
    feedState: createFeedState429(),
  },
};

export const Http5xxServerError: Story = {
  args: {
    feedState: createFeedState5xx(),
  },
};

// Fetch Errors (non-HTTP)

export const FetchTimeout: Story = {
  args: {
    feedState: createFetchTimeout(),
  },
};

export const FetchFailed: Story = {
  args: {
    feedState: createFetchFailed(),
  },
};

export const FetchInternalError: Story = {
  args: {
    feedState: createFetchInternalError(),
  },
};

// Parse Errors

export const ParseTimeout: Story = {
  args: {
    feedState: createParseTimeout(),
  },
};

export const ParseInvalidFormat: Story = {
  args: {
    feedState: createParseInvalidFormat(),
  },
};
