function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function generateUserFeedSearchFilters(search: string) {
  return {
    $or: [
      { title: new RegExp(escapeRegExp(search), "i") },
      { url: new RegExp(escapeRegExp(search), "i") },
    ],
  };
}
