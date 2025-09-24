import { Component, ComponentType, SectionComponent } from "../types";

function findPreviewerComponentById(root: Component, id: string): Component | null {
  if (root.id === id) {
    return root;
  }

  if (root.children) {
    for (let i = 0; i < root.children.length; i += 1) {
      const child = root.children[i];
      const result = findPreviewerComponentById(child, id);
      if (result) return result;
    }
  }

  // Handle accessory for sections
  if (root.type === ComponentType.V2Section && (root as SectionComponent).accessory) {
    const accessory = (root as SectionComponent).accessory as Component;
    const result = findPreviewerComponentById(accessory, id);
    if (result) return result;
  }

  return null;
}

export default findPreviewerComponentById;
