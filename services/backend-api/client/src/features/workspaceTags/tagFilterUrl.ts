export const WORKSPACE_TAG_FILTER_PARAM = "tags";

function uniqueTagIds(tagIds: string[]): string[] {
  return [...new Set(tagIds.map((tagId) => tagId.trim()).filter(Boolean))];
}

export function readWorkspaceTagFilter(searchParams: URLSearchParams): string[] {
  return uniqueTagIds(
    searchParams.getAll(WORKSPACE_TAG_FILTER_PARAM).flatMap((value) => value.split(",")),
  );
}

export function writeWorkspaceTagFilter(
  searchParams: URLSearchParams,
  tagIds: string[],
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.delete(WORKSPACE_TAG_FILTER_PARAM);

  const normalizedTagIds = uniqueTagIds(tagIds);

  if (normalizedTagIds.length > 0) {
    next.set(WORKSPACE_TAG_FILTER_PARAM, normalizedTagIds.join(","));
  }

  return next;
}

export function filterWorkspaceTagIdsByCatalog(
  tagIds: string[],
  catalog: Array<{ id: string }>,
): string[] {
  const availableIds = new Set(catalog.map((tag) => tag.id));

  return uniqueTagIds(tagIds).filter((tagId) => availableIds.has(tagId));
}
