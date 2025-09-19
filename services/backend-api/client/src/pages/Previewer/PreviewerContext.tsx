import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { Component, ComponentType, MESSAGE_ROOT_ID, MessageComponent, ButtonStyle } from "./types";

interface ValidationProblem {
  message: string;
  path: string;
}

interface PreviewerContextType {
  messageComponent: MessageComponent;
  problems: ValidationProblem[];
  addChildComponent: (
    parentId: string,
    childType: ComponentType.TextDisplay | ComponentType.ActionRow | ComponentType.Button
  ) => void;
  updateComponent: (id: string, updates: Partial<Component>) => void;
  deleteComponent: (id: string) => void;
  resetMessage: () => void;
}

const PreviewerContext = createContext<PreviewerContextType | undefined>(undefined);

export const usePreviewerContext = () => {
  const context = useContext(PreviewerContext);

  if (!context) {
    throw new Error("usePreviewerContext must be used within a PreviewerProvider");
  }

  return context;
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

      // Check for empty text displays
      if (
        component.type === ComponentType.TextDisplay &&
        (!component.content || component.content.trim() === "")
      ) {
        validationProblems.push({
          message: "Text Display component has no content",
          path: currentPath.join(" > "),
        });
      }

      // Check for empty button labels
      if (
        component.type === ComponentType.Button &&
        (!component.label || component.label.trim() === "")
      ) {
        validationProblems.push({
          message: "Button has no label",
          path: currentPath.join(" > "),
        });
      }

      // Check for link buttons without URLs
      if (
        component.type === ComponentType.Button &&
        component.style === ButtonStyle.Link &&
        (!component.href || component.href.trim() === "")
      ) {
        validationProblems.push({
          message: "Link button has no URL specified",
          path: currentPath.join(" > "),
        });
      }

      // Recursively check children
      if (component.children) {
        component.children.forEach((child) => {
          validationProblems.push(...validateComponent(child, currentPath));
        });
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

      return found || null;
    }

    return null;
  }, []);

  const addChildComponent = useCallback(
    (
      parentId: string,
      childType: ComponentType.TextDisplay | ComponentType.ActionRow | ComponentType.Button
    ) => {
      const newComponent = (() => {
        switch (childType) {
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
          default:
            throw new Error(`Unknown child type: ${childType}`);
        }
      })();

      const updateComponentTree = (component: Component): Component => {
        if (component.id === parentId) {
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

  const contextValue: PreviewerContextType = useMemo(
    () => ({
      messageComponent,
      problems,
      addChildComponent,
      updateComponent,
      deleteComponent,
      resetMessage,
    }),
    [messageComponent, problems, addChildComponent, updateComponent, deleteComponent, resetMessage]
  );

  return <PreviewerContext.Provider value={contextValue}>{children}</PreviewerContext.Provider>;
};
