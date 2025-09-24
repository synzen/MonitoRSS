import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from "react";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useTranslation } from "react-i18next";
import { v4 as uuidv4 } from "uuid";
import {
  Component,
  ComponentType,
  V2MessageComponentRoot,
  SectionComponent,
  MessageComponentRoot,
} from "./types";
import createPreviewerComponentSchema from "./utils/createPreviewerComponentSchema";
import { useUserFeedArticles } from "../../features/feed/hooks";
import { useUserFeedContext } from "../../contexts/UserFeedContext";
import createNewPreviewerComponent from "./utils/createNewPreviewComponent";
import { useGetUserFeedArticlesError } from "../../features/feedConnections";
import getPreviewerComponentLabel from "./utils/getPreviewerComponentLabel";
import PreviewerFormState from "./types/PreviewerFormState";
import { useUserFeedConnectionContext } from "../../contexts/UserFeedConnectionContext";
import { FeedDiscordChannelConnection } from "../../types";
import getPreviewerComponentFormPathById from "./utils/getPreviewerComponentFormPathsById";
import { useNavigableTreeContext } from "../../contexts/NavigableTreeContext";

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
      | ComponentType.LegacyActionRow
      | ComponentType.LegacyButton
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
  updateCurrentlySelectedComponent: <T extends Component>(newVal: T) => void;
  currentArticleId: string | undefined;
  currentArticle?: Record<string, string>;
  isLoading: boolean;
  error: string | null;
  setCurrentArticleId: (id: string) => void;
  hasNoArticles?: boolean;
  isFetchingDifferentArticle: boolean;
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
  const { userFeed, articleFormatOptions } = useUserFeedContext();
  const { connection } = useUserFeedConnectionContext<FeedDiscordChannelConnection>();
  const { setValue, getValues } = useFormContext<PreviewerFormState>();
  const { currentSelectedId } = useNavigableTreeContext();
  const { t } = useTranslation();

  // Article preview state
  const [currentArticleId, setCurrentArticleId] = useState<string>();
  const feedId = userFeed.id;

  // Use the actual hook to fetch articles
  const {
    data: articlesResponse,
    status,
    error,
    fetchStatus,
    refetch,
  } = useUserFeedArticles({
    feedId,
    data: {
      skip: 0,
      limit: 1,
      formatOptions: articleFormatOptions,
      selectProperties: ["*"],
      filters: currentArticleId
        ? {
            articleId: currentArticleId,
          }
        : undefined,
    },
  });
  const firstArticleId = articlesResponse?.result.articles?.[0]?.id;
  const hasNoArticles = articlesResponse?.result.articles.length === 0;
  const { messageRef } = useGetUserFeedArticlesError({
    getUserFeedArticlesStatus: status,
    getUserFeedArticlesError: error,
    getUserFeedArticlesOutput: articlesResponse,
  });

  const articles: Record<string, string>[] =
    (articlesResponse?.result?.articles as Record<string, string>[]) || [];

  const isLoading = status === "loading";
  const isFetchingDifferentArticle = fetchStatus === "fetching";

  const fetchArticles = useCallback(async () => {
    await refetch();
  }, [refetch]);

  useEffect(() => {
    if (status === "success") {
      setCurrentArticleId(firstArticleId);
    }
  }, [firstArticleId, status]);

  const addChildComponent: PreviewerContextType["addChildComponent"] = (
    parentId,
    childType,
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

    setValue("messageComponent", updateComponentTree(messageComponent) as MessageComponentRoot, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  const deleteComponent: PreviewerContextType["deleteComponent"] = (componentId) => {
    const messageComponent = getValues("messageComponent");

    if (!messageComponent) return;

    if (componentId === messageComponent.id) return;

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
      setValue("messageComponent", updatedComponent as MessageComponentRoot, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  };

  const moveComponentUp: PreviewerContextType["moveComponentUp"] = (componentId) => {
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

  const moveComponentDown: PreviewerContextType["moveComponentDown"] = (componentId) => {
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

  const resetMessage: PreviewerContextType["resetMessage"] = () => {
    const isForumChannel = connection?.details?.channel?.type === "forum";

    setValue(
      "messageComponent",
      {
        id: uuidv4(),
        type: ComponentType.V2Root,
        name: getPreviewerComponentLabel(ComponentType.V2Root),
        children: [],
        isForumChannel,
      },
      { shouldValidate: true }
    );
  };

  const updateCurrentlySelectedComponent: PreviewerContextType["updateCurrentlySelectedComponent"] =
    (newComponent) => {
      if (!currentSelectedId) {
        return;
      }

      const { messageComponent } = getValues();

      if (!messageComponent) {
        return;
      }

      const formPath = getPreviewerComponentFormPathById(messageComponent, currentSelectedId);

      if (formPath) {
        setValue(formPath as any, newComponent);
      }
    };

  const currentArticle = articlesResponse?.result.articles?.[0];

  const contextValue: PreviewerContextType = useMemo(
    () => ({
      addChildComponent,
      deleteComponent,
      resetMessage,
      moveComponentUp,
      moveComponentDown,
      currentArticleId,
      isLoading,
      error: messageRef ? t(messageRef) : null,
      setCurrentArticleId,
      currentArticle,
      hasNoArticles,
      isFetchingDifferentArticle,
      updateCurrentlySelectedComponent,
    }),
    [
      articles,
      currentArticleId,
      isLoading,
      messageRef,
      fetchArticles,
      currentArticle,
      t,
      hasNoArticles,
      isFetchingDifferentArticle,
      updateCurrentlySelectedComponent,
    ]
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
