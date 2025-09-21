import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import {
  Component,
  ComponentType,
  MESSAGE_ROOT_ID,
  MessageComponent,
  ButtonStyle,
  SectionComponent,
} from "./types";

// Article type
interface Article {
  id: string;
  title: string;
}

// Mock article data
const mockArticles: Article[] = [
  {
    id: "1",
    title: "Breaking: New JavaScript Framework Released",
  },
  {
    id: "2",
    title: "Climate Change: Latest Research Findings",
  },
  {
    id: "3",
    title: "Space Exploration Milestone Achieved",
  },
];

// Simulate error state for testing
const SIMULATE_ERROR = true; // Change to true to test error state

// Recursive schema for component validation
const createComponentSchema = (): yup.Lazy<any, yup.AnyObject, any> => {
  return yup.lazy((value: Component | undefined) => {
    if (!value || !value.type) {
      return yup.object();
    }

    const baseSchema = yup.object({
      id: yup.string().required(),
      type: yup.string().required(),
      name: yup.string().required(),
    });

    const buttonSchema = baseSchema.shape({
      label: yup
        .string()
        .required("Button label cannot be empty")
        .min(1, "Button label cannot be empty")
        .max(80, "Button label cannot exceed 80 characters"),
    });

    const textDisplaySchema = baseSchema.shape({
      content: yup
        .string()
        .required("Text display content cannot be empty")
        .min(1, "Text display content cannot be empty")
        .max(2000, "Text display content cannot exceed 2000 characters"),
    });

    switch (value.type) {
      case ComponentType.TextDisplay:
        return textDisplaySchema;
      case ComponentType.ActionRow:
        return baseSchema.shape({
          children: yup
            .array()
            .of(createComponentSchema())
            .min(1, "Action Row must have at least one child component")
            .max(5, "Action Row can have at most 5 child components")
            .required("Action Row must have at least one child component"),
        });
      case ComponentType.Message:
        return baseSchema.shape({
          children: yup.array().of(createComponentSchema()).default([]),
        });
      case ComponentType.Section:
        return baseSchema.shape({
          children: yup
            .array()
            .of(createComponentSchema())
            .default([])
            .min(1, "Section must have at least 1 child component")
            .max(3, "Section can have at most 3 child components"),
          accessory: buttonSchema.required(),
        });
      case ComponentType.Divider:
        return baseSchema;
      case ComponentType.Button:
        return buttonSchema;
      default:
        return baseSchema;
    }
  });
};

const validationSchema = yup.object({
  messageComponent: createComponentSchema(),
});

interface PreviewerContextType {
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
  deleteComponent: (componentId: string) => void;
  resetMessage: () => void;
  moveComponentUp: (componentId: string) => void;
  moveComponentDown: (componentId: string) => void;
  // Article preview functionality
  articles: Article[];
  currentArticleIndex: number;
  isLoading: boolean;
  error: string | null;
  fetchArticles: () => Promise<void>;
  setCurrentArticleIndex: (index: number) => void;
}

const PreviewerContext = createContext<PreviewerContextType | undefined>(undefined);

export const usePreviewerContext = () => {
  const context = useContext(PreviewerContext);

  if (!context) {
    throw new Error("usePreviewerContext must be used within a PreviewerProvider");
  }

  return context;
};

const PreviewerInternalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setValue, getValues } = useFormContext<{ messageComponent: MessageComponent }>();

  // Article preview state
  const [articles, setArticles] = useState<Article[]>([]);
  const [currentArticleIndex, setCurrentArticleIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simulate fetching articles
  const fetchArticles = useCallback(async () => {
    setIsLoading(true);
    setError(null); // Clear any previous errors

    try {
      // Simulate network delay
      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });

      if (SIMULATE_ERROR) {
        throw new Error(
          "Failed to fetch articles from RSS feed. Please check your internet connection and try again."
        );
      }

      setArticles(mockArticles);
      setCurrentArticleIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      setArticles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch articles on mount
  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const addChildComponent = (
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

    const messageComponent = getValues("messageComponent");
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

    setValue("messageComponent", updateComponentTree(messageComponent) as MessageComponent, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  const deleteComponent = (componentId: string) => {
    if (componentId === MESSAGE_ROOT_ID) return;

    const messageComponent = getValues("messageComponent");

    const removeFromTree = (component: Component): Component | null => {
      // Handle section accessory removal
      if (component.type === ComponentType.Section && component.accessory?.id === componentId) {
        return {
          ...component,
          accessory: undefined,
        } as SectionComponent;
      }

      // Handle children removal
      if (component.children) {
        const updatedChildren = component.children
          .filter((child) => child.id !== componentId)
          .map(removeFromTree)
          .filter((child): child is Component => child !== null);

        return {
          ...component,
          children: updatedChildren,
        } as Component;
      }

      // If this is the component to delete and it has no children, return null
      return component.id === componentId ? null : component;
    };

    const updatedComponent = removeFromTree(messageComponent);

    if (updatedComponent) {
      setValue("messageComponent", updatedComponent as MessageComponent, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  };

  const moveComponentUp = (componentId: string) => {
    const messageComponent = getValues("messageComponent");

    const updateTree = (component: Component): Component => {
      if (component.children) {
        const childIndex = component.children.findIndex((child) => child.id === componentId);

        if (childIndex > 0) {
          const newChildren = [...component.children];
          [newChildren[childIndex - 1], newChildren[childIndex]] = [
            newChildren[childIndex],
            newChildren[childIndex - 1],
          ];

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

    setValue("messageComponent", updateTree(messageComponent) as MessageComponent);
  };

  const moveComponentDown = (componentId: string) => {
    const messageComponent = getValues("messageComponent");

    const updateTree = (component: Component): Component => {
      if (component.children) {
        const childIndex = component.children.findIndex((child) => child.id === componentId);

        if (childIndex >= 0 && childIndex < component.children.length - 1) {
          const newChildren = [...component.children];
          [newChildren[childIndex], newChildren[childIndex + 1]] = [
            newChildren[childIndex + 1],
            newChildren[childIndex],
          ];

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

    setValue("messageComponent", updateTree(messageComponent) as MessageComponent);
  };

  const resetMessage = () => {
    setValue(
      "messageComponent",
      {
        id: MESSAGE_ROOT_ID,
        type: ComponentType.Message,
        name: "Discord Message",
        children: [],
      },
      { shouldValidate: true }
    );
  };

  const contextValue: PreviewerContextType = useMemo(
    () => ({
      addChildComponent,
      deleteComponent,
      resetMessage,
      moveComponentUp,
      moveComponentDown,
      // Article preview functionality
      articles,
      currentArticleIndex,
      isLoading,
      error,
      fetchArticles,
      setCurrentArticleIndex,
    }),
    [articles, currentArticleIndex, isLoading, error, fetchArticles]
  );

  return <PreviewerContext.Provider value={contextValue}>{children}</PreviewerContext.Provider>;
};

export const PreviewerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const formMethods = useForm<{ messageComponent: MessageComponent }>({
    mode: "onChange",
    resolver: yupResolver(validationSchema),
    defaultValues: {
      messageComponent: {
        id: MESSAGE_ROOT_ID,
        type: ComponentType.Message,
        name: "Discord Message",
        children: [],
      },
    },
  });

  return (
    <FormProvider {...formMethods}>
      <PreviewerInternalProvider>{children}</PreviewerInternalProvider>
    </FormProvider>
  );
};
