import { Component, ComponentType, SectionComponent } from "../types";

function getPreviewerComponentFormPathsById(
  root: Component,
  id: string,
  basePath: string = "messageComponent"
): string | null {
  if (root.id === id) {
    return basePath;
  }

  if (root.children) {
    for (let i = 0; i < root.children.length; i += 1) {
      const child = root.children[i];
      const childPath = getPreviewerComponentFormPathsById(child, id, `${basePath}.children.${i}`);
      if (childPath) return childPath;
    }
  }

  // Handle accessory for sections
  if (root.type === ComponentType.V2Section && (root as SectionComponent).accessory) {
    const accessory = (root as any).accessory as Component;
    const accessoryPath = getPreviewerComponentFormPathsById(
      accessory,
      id,
      `${basePath}.accessory`
    );
    if (accessoryPath) return accessoryPath;
  }

  return null;
}

export default getPreviewerComponentFormPathsById;
