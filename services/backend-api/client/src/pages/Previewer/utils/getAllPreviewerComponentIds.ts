import { Component } from "../types";

function getAllPreviewerComponentIds(component?: Component): Set<string> {
  if (!component) {
    return new Set();
  }

  const toReturn = new Set([component.id]);

  component.children?.forEach((c) => {
    const childIds = getAllPreviewerComponentIds(c);
    childIds.forEach((id) => toReturn.add(id));
  });

  return toReturn;
}

export default getAllPreviewerComponentIds;
