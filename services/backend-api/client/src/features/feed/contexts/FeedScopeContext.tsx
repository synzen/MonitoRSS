import { createContext, useContext } from "react";

/**
 * The scope the feeds UI operates in.
 *
 * The default (empty) value is the personal scope. When a workspace-scoped page
 * provides a value, every feed query, mutation, and link inside it becomes
 * workspace-scoped — a single chokepoint that lets the personal feeds UI be reused
 * verbatim in workspace scope without threading `workspaceId` through every component.
 *
 * Lives in the `feed` feature (not `workspaces`) so feed hooks can consume it
 * without importing `workspaces`, which would create a circular dependency.
 */
export interface FeedScope {
  /** The current workspace's id; undefined in personal scope. */
  workspaceId?: string;
  /** The current workspace's slug, for building workspace-scoped route links. */
  workspaceSlug?: string;
  /** The current workspace's feed limit, for the feed-limit bar. */
  maxFeeds?: number;
  /**
   * True when billing is enabled on this instance and the workspace has no
   * active subscription: feeds are disabled and feed creation is rejected, so
   * the feed UI shows activation prompts instead. Always false/undefined in
   * personal scope and on self-hosted instances without Paddle.
   */
  workspaceDormant?: boolean;
  /**
   * The workspace's Reddit connection state. In workspace scope, Reddit gates resolve
   * against this (the workspace's connection) instead of the caller's personal account;
   * null means the workspace has no connection record.
   */
  redditConnection?: {
    status: "ACTIVE" | "REVOKED";
    connectedByUserId?: string;
    connectedByDiscordUserId?: string | null;
  } | null;
  /** Re-fetches the workspace so a just-completed connect/disconnect is reflected. */
  refreshRedditConnection?: () => void;
}

const FeedScopeContext = createContext<FeedScope>({});

export const FeedScopeProvider = FeedScopeContext.Provider;

export const useFeedScope = () => useContext(FeedScopeContext);
