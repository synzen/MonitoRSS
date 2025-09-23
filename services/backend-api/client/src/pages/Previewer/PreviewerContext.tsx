import React, { createContext, useContext, useMemo, useState, useCallback, ReactNode } from "react";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import {
  Component,
  ComponentType,
  MESSAGE_ROOT_ID,
  V2MessageComponentRoot,
  SectionComponent,
  PreviewerFormState,
} from "./types";
import createPreviewerComponentSchema from "./utils/createPreviewerComponentSchema";
import { useUserFeedArticles } from "../../features/feed/hooks";
import { useUserFeedContext } from "../../contexts/UserFeedContext";
import createNewPreviewerComponent from "./utils/createNewPreviewComponent";

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
  articles: Record<string, string>[];
  currentArticleId: string | undefined;
  isLoading: boolean;
  error: string | null;
  fetchArticles: () => Promise<void>;
  setCurrentArticleId: (id: string) => void;
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
  const { userFeed } = useUserFeedContext();
  const { setValue, getValues } = useFormContext<PreviewerFormState>();

  // Article preview state
  const [currentArticleId, setCurrentArticleId] = useState<string>();
  const feedId = userFeed.id;

  // Use the actual hook to fetch articles
  const {
    data: articlesResponse,
    status,
    error,
    refetch,
  } = useUserFeedArticles({
    feedId,
    data: {
      skip: 0,
      limit: 10,
      selectProperties: ["title", "publishedAt"],
      formatOptions: {
        customPlaceholders: [],
        externalProperties: [],
        dateFormat: "YYYY-MM-DD",
        dateTimezone: "UTC",
        disableImageLinkPreviews: false,
        formatTables: false,
        ignoreNewLines: false,
        stripImages: false,
      },
    },
  });

  // Transform API response to match Article interface
  const articles: Record<string, string>[] =
    (articlesResponse?.result?.articles as Record<string, string>[]) || [];

  const isLoading = status === "loading";

  // Fetch articles function that calls refetch
  const fetchArticles = useCallback(async () => {
    await refetch();
  }, [refetch]);

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
    const messageComponent = getValues("messageComponent");
    const newComponent = createNewPreviewerComponent(childType);

    const updateComponentTree = (component?: Component): Component => {
      if (!component) {
        return newComponent;
      }

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

    if (!messageComponent) return;

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

    if (!messageComponent) return;

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

    if (!messageComponent) return;

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
      currentArticleId,
      isLoading,
      error: error?.message || null,
      fetchArticles,
      setCurrentArticleId,
    }),
    [articles, currentArticleId, isLoading, error, fetchArticles]
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
