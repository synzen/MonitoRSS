import { Component, ComponentType } from "../types";
import getMessageBuilderComponentLabel from "./getMessageBuilderComponentLabel";

const getComponentPath = (
  component: Component,
  targetId: string,
  currentPath = "",
): string | null => {
  interface StackItem {
    component: Component;
    path: string;
  }

  const stack: StackItem[] = [
    { component, path: currentPath || getMessageBuilderComponentLabel(component.type) },
  ];

  while (stack.length > 0) {
    const { component: currentComponent, path } = stack.pop()!;

    if (currentComponent.id === targetId) {
      return path;
    }

    // Add accessory to stack (will be processed first due to stack LIFO nature)
    if (currentComponent.type === ComponentType.V2Section && currentComponent.accessory) {
      const accessoryPath = `${path} > ${getMessageBuilderComponentLabel(
        currentComponent.type,
      )} (accessory)`;
      stack.push({ component: currentComponent.accessory, path: accessoryPath });
    }

    // Add children to stack in reverse order to maintain left-to-right processing
    if (currentComponent.children) {
      for (let i = currentComponent.children.length - 1; i >= 0; i -= 1) {
        const child = currentComponent.children[i];
        const childPath = `${path} > ${getMessageBuilderComponentLabel(child.type)}`;
        stack.push({ component: child, path: childPath });
      }
    }
  }

  return null;
};

export default getComponentPath;
