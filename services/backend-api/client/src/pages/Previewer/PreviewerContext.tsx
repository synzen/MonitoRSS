import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import {
  Component,
  ComponentType,
  MESSAGE_ROOT_ID,
  MessageComponent,
  ButtonStyle,
  SectionComponent,
} from "./types";

export enum ValidationProblemCode {
  TooManyTotalComponents = "TooManyTotalComponents",
}

interface ValidationProblem {
  code?: ValidationProblemCode;
  message: string;
  path: string;
  componentId: string;
}

interface PreviewerContextType {
  messageComponent: MessageComponent;
  problems: ValidationProblem[];
  addChildComponent: (
    parentId: string,
    childType:
      | ComponentType.TextDisplay
      | ComponentType.ActionRow
      | ComponentType.Button
      | ComponentType.Section
      | ComponentType.Divider,
    isAccessory?: boolean
  ) => void;
  updateComponent: (id: string, updates: Partial<Component>) => void;
  deleteComponent: (id: string) => void;
  resetMessage: () => void;
  moveComponentUp: (componentId: string) => void;
  moveComponentDown: (componentId: string) => void;
}

const PreviewerContext = createContext<PreviewerContextType | undefined>(undefined);

export const usePreviewerContext = () => {
  const context = useContext(PreviewerContext);

  if (!context) {
    throw new Error("usePreviewerContext must be used within a PreviewerProvider");
  }

  return context;
};

const countTotalComponents = (comp: Component): number => {
  const stack = [comp];
  let count = 0;

  while (stack.length > 0) {
    const current = stack.pop()!;
    count += 1;

    if (current.children) {
      stack.push(...current.children);
    }

    // Count accessory component for Section types
    if (current.type === ComponentType.Section && "accessory" in current && current.accessory) {
      stack.push(current.accessory);
    }
  }

  return count;
};

export const PreviewerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messageComponent, setMessageComponent] = useState<MessageComponent>(() => ({
    id: MESSAGE_ROOT_ID,
    type: ComponentType.Message,
    name: "Discord Message",
    children: [],
  }));

  const [problems, setProblems] = useState<ValidationProblem[]>([]);

  // Validation logic
  const validateComponent = useCallback(
    (component: Component, path: string[] = []): ValidationProblem[] => {
      const validationProblems: ValidationProblem[] = [];
      const currentPath = [...path, component.name];

      // Check for too many total components (only for root message)
      if (component.type === ComponentType.Message) {
        const totalComponents = countTotalComponents(component);

        if (totalComponents > 40) {
          validationProblems.push({
            message: "Message has too many total components (maximum 40 allowed)",
            path: currentPath.join(" > "),
            componentId: component.id,
            code: ValidationProblemCode.TooManyTotalComponents,
          });
        }
      }

      if (component.type === ComponentType.ActionRow && !component.children.length) {
        validationProblems.push({
          message: "Action Row expects at least one child component",
          path: currentPath.join(" > "),
          componentId: component.id,
        });
      }

      // Check for empty text displays
      if (
        component.type === ComponentType.TextDisplay &&
        (!component.content || component.content.trim() === "")
      ) {
        validationProblems.push({
          message: `Text Display content is expected`,
          path: currentPath.join(" > "),
          componentId: component.id,
        });
      }

      // Check for empty button labels
      if (
        component.type === ComponentType.Button &&
        (!component.label || component.label.trim() === "")
      ) {
        validationProblems.push({
          message: "Button label is expected",
          path: currentPath.join(" > "),
          componentId: component.id,
        });
      }

      // Check for link buttons without URLs
      if (
        component.type === ComponentType.Button &&
        component.style === ButtonStyle.Link &&
        (!component.href || component.href.trim() === "")
      ) {
        validationProblems.push({
          message: "Link Button URL is expected",
          path: currentPath.join(" > "),
          componentId: component.id,
        });
      } // Section-specific validations

      if (component.type === ComponentType.Section) {
        const sectionComponent = component as SectionComponent;

        // Check if accessory is missing (required)
        if (!sectionComponent.accessory) {
          validationProblems.push({
            message: "Section accessory is expected",
            path: currentPath.join(" > "),
            componentId: component.id,
          });
        }

        // Check if too many children (max 3)
        if (sectionComponent.children && sectionComponent.children.length > 3) {
          validationProblems.push({
            message: "Section can have maximum 3 child components",
            path: currentPath.join(" > "),
            componentId: component.id,
          });
        }
      }

      // Recursively check children
      if (component.children) {
        component.children.forEach((child) => {
          validationProblems.push(...validateComponent(child, currentPath));
        });
      }

      // Check accessory for sections
      if (
        component.type === ComponentType.Section &&
        "accessory" in component &&
        component.accessory
      ) {
        validationProblems.push(...validateComponent(component.accessory, currentPath));
      }

      return validationProblems;
    },
    []
  );

  // Update validation when component changes
  useEffect(() => {
    const newProblems = validateComponent(messageComponent);
    setProblems(newProblems);
  }, [messageComponent, validateComponent]);

  const findComponentById = useCallback((component: Component, id: string): Component | null => {
    if (component.id === id) {
      return component;
    }

    if (component.children) {
      const found = component.children
        .map((child) => findComponentById(child, id))
        .find((result) => result !== null);

      if (found) return found;
    }

    // Check accessory for sections
    if (
      component.type === ComponentType.Section &&
      "accessory" in component &&
      component.accessory
    ) {
      return findComponentById(component.accessory, id);
    }

    return null;
  }, []);

  const addChildComponent = useCallback(
    (
      parentId: string,
      childType:
        | ComponentType.TextDisplay
        | ComponentType.ActionRow
        | ComponentType.Button
        | ComponentType.Section
        | ComponentType.Divider,
      isAccessory = false
    ) => {
      const createNewComponent = (type: typeof childType): Component => {
        switch (type) {
          case ComponentType.TextDisplay:
            return {
              id: `text-${Date.now()}`,
              type: ComponentType.TextDisplay,
              name: `Text Display`,
              content: "Hello, Discord!",
            };
          case ComponentType.ActionRow:
            return {
              id: `actionrow-${Date.now()}`,
              type: ComponentType.ActionRow,
              name: `Action Row`,
              children: [],
            };
          case ComponentType.Button:
            return {
              id: `button-${Date.now()}`,
              type: ComponentType.Button,
              name: `Button`,
              label: "New Button",
              style: ButtonStyle.Primary,
              disabled: false,
              href: "",
            };
          case ComponentType.Section:
            return {
              id: `section-${Date.now()}`,
              type: ComponentType.Section,
              name: `Section`,
              children: [],
            };
          case ComponentType.Divider:
            return {
              id: `divider-${Date.now()}`,
              type: ComponentType.Divider,
              name: `Divider`,
              visual: true,
              spacing: 1,
              children: [],
            };
          default:
            throw new Error(`Unknown child type: ${childType}`);
        }
      };

      const newComponent = createNewComponent(childType);

      const updateComponentTree = (component: Component): Component => {
        if (component.id === parentId) {
          if (isAccessory && component.type === ComponentType.Section) {
            return {
              ...component,
              accessory: newComponent,
            } as SectionComponent;
          }

          return {
            ...component,
            children: [...(component.children || []), newComponent],
          } as Component;
        }

        if (component.children) {
          return {
            ...component,
            children: component.children.map(updateComponentTree),
          } as Component;
        }

        return component;
      };

      setMessageComponent(updateComponentTree(messageComponent) as MessageComponent);
    },
    [messageComponent]
  );

  const updateComponent = useCallback(
    (id: string, updates: Partial<Component>) => {
      const updateInTree = (component: Component): Component => {
        if (component.id === id) {
          return { ...component, ...updates } as Component;
        }

        if (component.children) {
          return {
            ...component,
            children: component.children.map(updateInTree),
          } as Component;
        }

        return component;
      };

      setMessageComponent(updateInTree(messageComponent) as MessageComponent);
    },
    [messageComponent]
  );

  const deleteComponent = useCallback(
    (id: string) => {
      if (id === MESSAGE_ROOT_ID) return; // Can't delete root

      const removeFromTree = (component: Component): Component | null => {
        // Remove from accessory if it matches
        if (component.type === ComponentType.Section && component.accessory?.id === id) {
          return {
            ...component,
            accessory: undefined,
          } as SectionComponent;
        }

        if (component.children) {
          const filteredChildren = component.children
            .map(removeFromTree)
            .filter((child): child is Component => child !== null);

          return {
            ...component,
            children: filteredChildren,
          } as Component;
        }

        return component.id === id ? null : component;
      };

      const updatedComponent = removeFromTree(messageComponent);

      if (updatedComponent) {
        setMessageComponent(updatedComponent as MessageComponent);
      }
    },
    [messageComponent]
  );

  const resetMessage = useCallback(() => {
    setMessageComponent({
      id: MESSAGE_ROOT_ID,
      type: ComponentType.Message,
      name: "Discord Message",
      children: [],
    });
  }, []);

  const moveComponentUp = useCallback(
    (componentId: string) => {
      const updateTree = (component: Component): Component => {
        if (component.children) {
          const childIndex = component.children.findIndex((child) => child.id === componentId);

          if (childIndex > 0) {
            const newChildren = [...component.children];
            const componentToMove = newChildren[childIndex];
            const componentAbove = newChildren[childIndex - 1];
            newChildren[childIndex - 1] = componentToMove;
            newChildren[childIndex] = componentAbove;

            return {
              ...component,
              children: newChildren,
            } as Component;
          }

          return {
            ...component,
            children: component.children.map(updateTree),
          } as Component;
        }

        return component;
      };

      setMessageComponent(updateTree(messageComponent) as MessageComponent);
    },
    [messageComponent]
  );

  const moveComponentDown = useCallback(
    (componentId: string) => {
      const updateTree = (component: Component): Component => {
        if (component.children) {
          const childIndex = component.children.findIndex((child) => child.id === componentId);

          if (childIndex >= 0 && childIndex < component.children.length - 1) {
            const newChildren = [...component.children];
            const componentToMove = newChildren[childIndex];
            const componentBelow = newChildren[childIndex + 1];
            newChildren[childIndex] = componentBelow;
            newChildren[childIndex + 1] = componentToMove;

            return {
              ...component,
              children: newChildren,
            } as Component;
          }

          return {
            ...component,
            children: component.children.map(updateTree),
          } as Component;
        }

        return component;
      };

      setMessageComponent(updateTree(messageComponent) as MessageComponent);
    },
    [messageComponent]
  );

  const contextValue: PreviewerContextType = useMemo(
    () => ({
      messageComponent,
      problems,
      addChildComponent,
      updateComponent,
      deleteComponent,
      resetMessage,
      moveComponentUp,
      moveComponentDown,
    }),
    [
      messageComponent,
      problems,
      addChildComponent,
      updateComponent,
      deleteComponent,
      resetMessage,
      moveComponentUp,
      moveComponentDown,
    ]
  );

  return <PreviewerContext.Provider value={contextValue}>{children}</PreviewerContext.Provider>;
};
