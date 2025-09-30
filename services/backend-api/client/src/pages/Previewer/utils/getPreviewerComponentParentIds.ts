import { Component, ComponentType } from "../types";

const getPreviewerComponentParentIds = (
  component: Component | undefined,
  targetId: string,
  parents: string[] = []
): string[] | null => {
  if (!component) return null;

  if (component.id === targetId) {
    return parents;
  }

  if (component.children) {
    for (let i = 0; i < component.children.length; i += 1) {
      const child = component.children[i];
      const result = getPreviewerComponentParentIds(child, targetId, [...parents, component.id]);
      if (result) return result;
    }
  }

  if (component.type === ComponentType.V2Section && component.accessory) {
    const result = getPreviewerComponentParentIds(component.accessory, targetId, [
      ...parents,
      component.id,
    ]);
    if (result) return result;
  }

  return null;
};

export default getPreviewerComponentParentIds;
