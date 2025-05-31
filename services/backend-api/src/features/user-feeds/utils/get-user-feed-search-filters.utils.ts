import _ from "lodash";

export function generateUserFeedSearchFilters(search: string) {
  return {
    $or: [
      {
        title: new RegExp(_.escapeRegExp(search), "i"),
      },
      {
        url: new RegExp(_.escapeRegExp(search), "i"),
      },
    ],
  };
}
