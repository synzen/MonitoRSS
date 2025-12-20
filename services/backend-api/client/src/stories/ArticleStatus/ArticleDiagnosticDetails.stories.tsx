import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { ArticleDiagnosticDetails } from "../../features/feed/components/UserFeedLogs/ArticleStatus/ArticleDiagnosticDetails";
import { UserFeedContext } from "../../contexts/UserFeedContext";
import { UserFeed } from "../../features/feed/types";
import {
  createWouldDeliverArticle,
  createMultipleConnectionsArticle,
  createDeletedConnectionArticle,
  mockUserFeed,
  mockConnections,
} from "./mockFactories";

// Mock UserFeed context provider
const MockUserFeedProvider = ({
  children,
  connections = mockConnections,
}: {
  children: React.ReactNode;
  connections?: typeof mockConnections;
}) => (
  <UserFeedContext.Provider
    value={{
      userFeed: { ...mockUserFeed, connections } as unknown as UserFeed,
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
  title: "Feed/ArticleStatus/ArticleDiagnosticDetails",
  component: ArticleDiagnosticDetails,
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
} satisfies Meta<typeof ArticleDiagnosticDetails>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleConnection: Story = {
  args: {
    result: createWouldDeliverArticle(),
  },
};

export const MultipleConnections: Story = {
  args: {
    result: createMultipleConnectionsArticle(),
  },
};

export const DeletedConnection: Story = {
  args: {
    result: createDeletedConnectionArticle(),
  },
};
