import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import {
  Component,
  ComponentType,
  MESSAGE_ROOT_ID,
  V2MessageComponentRoot,
  ButtonStyle,
  SectionComponent,
  PreviewerFormState,
} from "./types";
import createPreviewerComponentSchema from "./utils/createPreviewerComponentSchema";

// Article type
interface Article {
  id: string;
  title: string;
  publishedAt?: string;
}

// Mock article data
const mockArticles: Article[] = [
  {
    id: "1",
    title: "Breaking: New JavaScript Framework Released",
    publishedAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "2",
    title: "Climate Change: Latest Research Findings",
    publishedAt: "2024-01-16T14:20:00Z",
  },
  {
    id: "3",
    title: "Space Exploration Milestone Achieved",
    publishedAt: "2024-01-17T09:15:00Z",
  },
];

// Simulate error state for testing
const SIMULATE_ERROR = false; // Change to true to test error state

const validationSchema = yup.object({
  messageComponent: createPreviewerComponentSchema().optional(),
});

interface PreviewerContextType {
  addChildComponent: (
    parentId: string,
    childType:
      | ComponentType.LegacyText
      | ComponentType.LegacyEmbed
      | ComponentType.LegacyEmbedAuthor
      | ComponentType.LegacyEmbedTitle
      | ComponentType.LegacyEmbedDescription
      | ComponentType.LegacyEmbedImage
      | ComponentType.LegacyEmbedThumbnail
      | ComponentType.LegacyEmbedFooter
      | ComponentType.LegacyEmbedField
      | ComponentType.LegacyEmbedTimestamp
      | ComponentType.V2TextDisplay
      | ComponentType.V2ActionRow
      | ComponentType.V2Button
      | ComponentType.V2Section
      | ComponentType.V2Divider,
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
  const { setValue, getValues } = useFormContext<{ messageComponent: V2MessageComponentRoot }>();

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
      | ComponentType.LegacyText
      | ComponentType.LegacyEmbed
      | ComponentType.LegacyEmbedAuthor
      | ComponentType.LegacyEmbedTitle
      | ComponentType.LegacyEmbedDescription
      | ComponentType.LegacyEmbedImage
      | ComponentType.LegacyEmbedThumbnail
      | ComponentType.LegacyEmbedFooter
      | ComponentType.LegacyEmbedField
      | ComponentType.LegacyEmbedTimestamp
      | ComponentType.V2TextDisplay
      | ComponentType.V2ActionRow
      | ComponentType.V2Button
      | ComponentType.V2Section
      | ComponentType.V2Divider,
    isAccessory = false
  ) => {
    const createNewComponent = (type: typeof childType): Component => {
      switch (type) {
        case ComponentType.LegacyText:
          return {
            id: `legacy-text-${Date.now()}`,
            type: ComponentType.LegacyText,
            name: `Legacy Text`,
            content: "Hello from legacy Discord message!",
          };
        case ComponentType.LegacyEmbed:
          return {
            id: `legacy-embed-${Date.now()}`,
            type: ComponentType.LegacyEmbed,
            name: `Legacy Embed`,
            children: [],
          };

        case ComponentType.LegacyEmbedAuthor:
          return {
            id: `embed-author-${Date.now()}`,
            type: ComponentType.LegacyEmbedAuthor,
            name: `Embed Author`,
            authorName: "",
            authorUrl: "",
            authorIconUrl: "",
          };
        case ComponentType.LegacyEmbedTitle:
          return {
            id: `embed-title-${Date.now()}`,
            type: ComponentType.LegacyEmbedTitle,
            name: `Embed Title`,
            title: "",
            titleUrl: "",
          };
        case ComponentType.LegacyEmbedDescription:
          return {
            id: `embed-description-${Date.now()}`,
            type: ComponentType.LegacyEmbedDescription,
            name: `Embed Description`,
            description: "",
          };
        case ComponentType.LegacyEmbedImage:
          return {
            id: `embed-image-${Date.now()}`,
            type: ComponentType.LegacyEmbedImage,
            name: `Embed Image`,
            imageUrl: "",
          };
        case ComponentType.LegacyEmbedThumbnail:
          return {
            id: `embed-thumbnail-${Date.now()}`,
            type: ComponentType.LegacyEmbedThumbnail,
            name: `Embed Thumbnail`,
            thumbnailUrl: "",
          };
        case ComponentType.LegacyEmbedFooter:
          return {
            id: `embed-footer-${Date.now()}`,
            type: ComponentType.LegacyEmbedFooter,
            name: `Embed Footer`,
            footerText: "",
            footerIconUrl: "",
          };
        case ComponentType.LegacyEmbedField:
          return {
            id: `embed-field-${Date.now()}`,
            type: ComponentType.LegacyEmbedField,
            name: `Embed Field`,
            fieldName: "",
            fieldValue: "",
            inline: false,
          };
        case ComponentType.LegacyEmbedTimestamp:
          return {
            id: `embed-timestamp-${Date.now()}`,
            type: ComponentType.LegacyEmbedTimestamp,
            name: `Embed Timestamp`,
            timestamp: "",
          };
        case ComponentType.V2TextDisplay:
          return {
            id: `text-${Date.now()}`,
            type: ComponentType.V2TextDisplay,
            name: `Text Display`,
            content: "Hello, Discord!",
          };
        case ComponentType.V2ActionRow:
          return {
            id: `actionrow-${Date.now()}`,
            type: ComponentType.V2ActionRow,
            name: `Action Row`,
            children: [],
          };
        case ComponentType.V2Button:
          return {
            id: `button-${Date.now()}`,
            type: ComponentType.V2Button,
            name: `Button`,
            label: "New Button",
            style: ButtonStyle.Primary,
            disabled: false,
            href: "",
          };
        case ComponentType.V2Section:
          return {
            id: `section-${Date.now()}`,
            type: ComponentType.V2Section,
            name: `Section`,
            children: [],
          };
        case ComponentType.V2Divider:
          return {
            id: `divider-${Date.now()}`,
            type: ComponentType.V2Divider,
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
        if (isAccessory && component.type === ComponentType.V2Section) {
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

    setValue("messageComponent", updateComponentTree(messageComponent) as V2MessageComponentRoot, {
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
      if (component.type === ComponentType.V2Section && component.accessory?.id === componentId) {
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
      setValue("messageComponent", updatedComponent as V2MessageComponentRoot, {
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

    setValue("messageComponent", updateTree(messageComponent) as V2MessageComponentRoot);
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

    setValue("messageComponent", updateTree(messageComponent) as V2MessageComponentRoot);
  };

  const resetMessage = () => {
    setValue(
      "messageComponent",
      {
        id: MESSAGE_ROOT_ID,
        type: ComponentType.V2Root,
        name: ComponentType.V2Root,
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

export const PreviewerProvider: React.FC<{
  defaultValues?: PreviewerFormState;
  children: ReactNode;
}> = ({ children, defaultValues }) => {
  const formMethods = useForm<PreviewerFormState>({
    mode: "onChange",
    resolver: yupResolver(validationSchema),
    defaultValues,
  });

  return (
    <FormProvider {...formMethods}>
      <PreviewerInternalProvider>{children}</PreviewerInternalProvider>
    </FormProvider>
  );
};
