import type { IUserFeed } from "../../repositories/interfaces/user-feed.types";
import {
  type WorkspaceTagColor,
  type WorkspaceTagSummary,
  type WorkspaceTagMongooseRepository,
} from "./workspace-tags.repository";
import {
  UserFeedTagLimitReachedError,
  WorkspaceTagInvalidAssignmentError,
  WorkspaceTagNameInvalidError,
  WorkspaceTagsPersonalFeedUnsupportedError,
} from "./workspace-tags.errors";

const MAX_WORKSPACE_TAGS = 100;
const MAX_FEED_TAGS = 10;
const NON_PRINTABLE_CHARACTERS = /[\p{Cc}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}]/u;
const FORMAT_CHARACTER = /\p{Cf}/u;
const ALLOWED_FORMAT_CHARACTERS = new Set(["\u200c", "\u200d"]);

export function normalizeWorkspaceTagName(name: string): {
  name: string;
  normalizedName: string;
} {
  const displayName = name.trim();
  const characters = Array.from(displayName);
  const characterCount = characters.length;
  const hasInvalidFormatCharacter = characters.some(
    (character) =>
      FORMAT_CHARACTER.test(character) &&
      !ALLOWED_FORMAT_CHARACTERS.has(character),
  );
  const hasVisibleCharacter = characters.some(
    (character) => !FORMAT_CHARACTER.test(character),
  );

  if (
    characterCount < 1 ||
    characterCount > 40 ||
    NON_PRINTABLE_CHARACTERS.test(displayName) ||
    hasInvalidFormatCharacter ||
    !hasVisibleCharacter
  ) {
    throw new WorkspaceTagNameInvalidError();
  }

  return {
    name: displayName,
    normalizedName: displayName
      .normalize("NFKC")
      .toUpperCase()
      .toLowerCase()
      .replaceAll("ß", "ss"),
  };
}

export function toWorkspaceTagSummary(tag: {
  id: string;
  name: string;
  color?: WorkspaceTagColor;
}): WorkspaceTagSummary {
  return { id: tag.id, name: tag.name, color: tag.color };
}

export class WorkspaceTagsService {
  constructor(private readonly repository: WorkspaceTagMongooseRepository) {}

  async create(input: {
    workspaceId: string;
    name: string;
    color?: WorkspaceTagColor;
  }): Promise<WorkspaceTagSummary> {
    const normalized = normalizeWorkspaceTagName(input.name);
    const tag = await this.repository.createWithLimit({
      workspaceId: input.workspaceId,
      ...normalized,
      color: input.color,
      limit: MAX_WORKSPACE_TAGS,
    });

    return toWorkspaceTagSummary(tag);
  }

  async validateCompleteFeedTagSet(
    feed: Pick<IUserFeed, "workspaceId">,
    tagIds: string[],
  ): Promise<void> {
    if (!feed.workspaceId) {
      throw new WorkspaceTagsPersonalFeedUnsupportedError();
    }

    if (tagIds.length > MAX_FEED_TAGS) {
      throw new UserFeedTagLimitReachedError();
    }

    if (
      new Set(tagIds).size !== tagIds.length ||
      !this.repository.areAllValidIds(tagIds)
    ) {
      throw new WorkspaceTagInvalidAssignmentError();
    }

    const tags = await this.repository.findByIdsForWorkspace(
      feed.workspaceId,
      tagIds,
    );

    if (tags.length !== tagIds.length) {
      throw new WorkspaceTagInvalidAssignmentError();
    }
  }

  async resolveFeedTags(
    feed: Pick<IUserFeed, "workspaceId" | "tagIds">,
  ): Promise<WorkspaceTagSummary[]> {
    if (!feed.workspaceId || !feed.tagIds?.length) {
      return [];
    }

    const tags = await this.repository.findByIdsForWorkspace(
      feed.workspaceId,
      feed.tagIds,
    );
    return tags.map(toWorkspaceTagSummary);
  }

  async resolveFeedTagMap(
    workspaceId: string | undefined,
    feeds: Array<{ id: string; tagIds?: string[] }>,
  ): Promise<Map<string, WorkspaceTagSummary[]>> {
    const result = new Map<string, WorkspaceTagSummary[]>();

    if (!workspaceId) {
      for (const feed of feeds) {
        result.set(feed.id, []);
      }
      return result;
    }

    const tagIds = [...new Set(feeds.flatMap((feed) => feed.tagIds ?? []))];
    const tags = await this.repository.findByIdsForWorkspace(
      workspaceId,
      tagIds,
    );
    const tagsById = new Map(
      tags.map((tag) => [tag.id, toWorkspaceTagSummary(tag)]),
    );

    for (const feed of feeds) {
      const summaries = (feed.tagIds ?? [])
        .map((id) => tagsById.get(id))
        .filter((tag): tag is WorkspaceTagSummary => !!tag)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        );
      result.set(feed.id, summaries);
    }

    return result;
  }

  async resolveValidFilterTagIds(
    workspaceId: string,
    tagIds: string[],
  ): Promise<string[]> {
    const validIds = tagIds.filter((id) =>
      this.repository.areAllValidIds([id]),
    );

    if (validIds.length === 0) {
      return [];
    }

    const tags = await this.repository.findByIdsForWorkspace(
      workspaceId,
      validIds,
    );

    return tags.map((tag) => tag.id);
  }
}
