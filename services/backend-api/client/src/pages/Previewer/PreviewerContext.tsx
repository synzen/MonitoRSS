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
import {
  Component,
  ComponentType,
  V2MessageComponentRoot,
  SectionComponent,
  MessageComponentRoot,
  LegacyEmbedComponent,
} from "./types";
import createPreviewerComponentSchema from "./utils/createPreviewerComponentSchema";
import { useUserFeedArticles } from "../../features/feed/hooks";
import { useUserFeedContext } from "../../contexts/UserFeedContext";
import createNewPreviewerComponent from "./utils/createNewPreviewComponent";
import { useGetUserFeedArticlesError } from "../../features/feedConnections";
import PreviewerFormState from "./types/PreviewerFormState";
import getPreviewerComponentFormPathById from "./utils/getPreviewerComponentFormPathsById";
import { useNavigableTreeContext } from "../../contexts/NavigableTreeContext";
import { useUserFeedConnectionContext } from "../../contexts/UserFeedConnectionContext";
import { FeedDiscordChannelConnection } from "../../types";
import { convertConnectionToPreviewerState } from "./utils/convertConnectionToPreviewerState";

const validationSchema = yup.object({
  messageComponent: createPreviewerComponentSchema().optional(),
});

interface PreviewerContextType {
  addChildComponent: (
    parentId: string,
    childType:
      | ComponentType.LegacyText
      | ComponentType.LegacyEmbedContainer
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
  const { setValue, getValues, reset } = useFormContext<PreviewerFormState>();
  const { currentSelectedId, setCurrentFocusedId, setCurrentSelectedId, setExpandedIds } =
    useNavigableTreeContext();
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

  useEffect(() => {
    if (!connection) {
      return;
    }

    const newFormState = convertConnectionToPreviewerState(connection);

    reset(newFormState);
  }, [connection]);

  const addChildComponent: PreviewerContextType["addChildComponent"] = useCallback(
    (parentId, childType, isAccessory = false) => {
      const messageComponent = getValues("messageComponent");
      const newComponent = createNewPreviewerComponent(childType);
      const idsToExpand: string[] = [parentId, newComponent.id];

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

          let indexToAddAt = component.children?.length || 0;

          // The order of legacy components are fixed
          if (newComponent.type === ComponentType.LegacyEmbedContainer) {
            indexToAddAt = 1;
            const childEmbed = createNewPreviewerComponent(
              ComponentType.LegacyEmbed
            ) as LegacyEmbedComponent;
            newComponent.children.push(childEmbed);
            idsToExpand.push(childEmbed.id);
          } else if (newComponent.type === ComponentType.LegacyText) {
            indexToAddAt = 0;
          }

          const childrenClone = [...(component.children || [])];

          childrenClone.splice(indexToAddAt, 0, newComponent);

          return {
            ...component,
            children: childrenClone,
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
      setExpandedIds((ids) => new Set([...ids, ...idsToExpand]));
      const lastIdToExpand = idsToExpand[idsToExpand.length - 1];

      if (lastIdToExpand) {
        setCurrentFocusedId(lastIdToExpand);
        setCurrentSelectedId(lastIdToExpand);
      }
    },
    [getValues, setValue]
  );

  const deleteComponent: PreviewerContextType["deleteComponent"] = useCallback(
    (componentId) => {
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
    },
    [getValues, setValue]
  );

  const moveComponentUp: PreviewerContextType["moveComponentUp"] = useCallback(
    (componentId) => {
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
    },
    [getValues, setValue]
  );

  const moveComponentDown: PreviewerContextType["moveComponentDown"] = useCallback(
    (componentId) => {
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
    },
    [getValues, setValue]
  );

  const resetMessage: PreviewerContextType["resetMessage"] = useCallback(() => {
    reset();
  }, [reset]);

  const updateCurrentlySelectedComponent: PreviewerContextType["updateCurrentlySelectedComponent"] =
    useCallback(
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
      },
      [currentSelectedId, getValues, setValue]
    );

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
