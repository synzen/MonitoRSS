import { Component, ComponentType, SectionComponent } from "../types";

function findMessageBuilderComponentById(
  root: Component | undefined,
  id: string,
): { parent: Component | null; target: Component | null } {
  if (!root) {
    return {
      parent: null,
      target: null,
    };
  }

  let parentSoFar: Component | null = null;
  const stack: Component[] = [root];

  while (stack.length > 0) {
    const current = stack.pop()!;

    if (current.id === id) {
      return { parent: parentSoFar, target: current };
    }

    // Add children to stack (in reverse order to maintain traversal order)
    parentSoFar = current;

    if (current.children) {
      for (let i = current.children.length - 1; i >= 0; i -= 1) {
        stack.push(current.children[i]);
      }
    }

    // Handle accessory for sections
    if (current.type === ComponentType.V2Section && (current as SectionComponent).accessory) {
      const accessory = (current as SectionComponent).accessory as Component;
      stack.push(accessory);
    }
  }

  return {
    parent: null,
    target: null,
  };
}

export default findMessageBuilderComponentById;
