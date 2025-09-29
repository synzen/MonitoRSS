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
  LegacyEmbedContainerComponent,
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
import getPreviewerComponentParentIds from "./utils/getPreviewerComponentParentIds";
import { notifyInfo } from "../../utils/notifyInfo";

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
  ) => Component | null;
  deleteComponent: (componentId: string) => void;
  resetMessage: () => void;
  moveComponentUp: (componentId: string) => void;
  moveComponentDown: (componentId: string) => void;
  updateCurrentlySelectedComponent: <T extends Component>(newVal: T) => void;
  currentArticleId: string | undefined;
  currentArticle?: Record<string, string>;
  isLoading: boolean;
  error: string | null;
  errorDescription?: string | null;
  setCurrentArticleId: (id: string) => void;
  hasNoArticles?: boolean;
  isFetchingDifferentArticle: boolean;
  navigateToComponentId: (componentId: string) => void;
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
  const { messageRef, description } = useGetUserFeedArticlesError({
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

    if (!currentSelectedId && newFormState.messageComponent?.id) {
      setCurrentSelectedId(newFormState.messageComponent.id);
    }
  }, [connection]);

  const addChildComponent: PreviewerContextType["addChildComponent"] = useCallback(
    (parentId, childType, isAccessory = false) => {
      const messageComponent = getValues("messageComponent");

      if (!messageComponent) {
        return null;
      }

      const idsToExpand: string[] = [parentId];
      let newComponent: Component | null = null;

      const updateComponentTree = (component: Component): Component => {
        if (component.id === parentId) {
          if (isAccessory && component.type === ComponentType.V2Section) {
            newComponent = createNewPreviewerComponent(childType, `${parentId}-accessory`, 0);
            idsToExpand.push(newComponent.id);

            return {
              ...component,
              accessory: newComponent,
            } as SectionComponent;
          }

          let indexToAddAt = component.children?.length || 0;

          // The order of legacy components are fixed
          if (childType === ComponentType.LegacyEmbedContainer) {
            newComponent = createNewPreviewerComponent(
              childType,
              parentId,
              0
            ) as LegacyEmbedContainerComponent;

            indexToAddAt = 1;
            const childEmbed = createNewPreviewerComponent(
              ComponentType.LegacyEmbed,
              newComponent.id,
              0
            ) as LegacyEmbedComponent;
            newComponent.children.push(childEmbed);
            idsToExpand.push(childEmbed.id);
          } else if (childType === ComponentType.LegacyText) {
            newComponent = createNewPreviewerComponent(childType, parentId, 0);
            indexToAddAt = 0;
          } else {
            newComponent = createNewPreviewerComponent(childType, parentId, indexToAddAt);
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
            children: component.children.map((c) => updateComponentTree(c)),
          } as Component;
        }

        return component;
      };

      const newRoot = updateComponentTree(messageComponent) as MessageComponentRoot;

      setValue("messageComponent", newRoot, {
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

      return newComponent;
    },
    [getValues, setValue]
  );

  const deleteComponent: PreviewerContextType["deleteComponent"] = useCallback(
    (componentId) => {
      const messageComponent = getValues("messageComponent");

      if (!messageComponent) return;

      if (componentId === messageComponent.id) return;

      let newSelectedId: string | null = null;

      const removeFromTree = (component: Component): Component | null => {
        // Handle section accessory removal
        if (component.type === ComponentType.V2Section && component.accessory?.id === componentId) {
          newSelectedId = component.id; // Set parent as selected

          return {
            ...component,
            accessory: undefined,
          } as SectionComponent;
        }

        // Handle children removal
        if (component.children) {
          const childIndex = component.children.findIndex((child) => child.id === componentId);

          if (childIndex !== -1) {
            // Found the component to delete in this parent's children
            if (childIndex < component.children.length - 1) {
              // There's a next sibling, select it
              newSelectedId = component.children[childIndex + 1].id;
            } else if (childIndex === component.children.length - 1 && childIndex > 0) {
              // There's a previous sibling, select it
              newSelectedId = component.children[childIndex - 1].id;
            } else {
              // No next sibling, select the parent
              newSelectedId = component.id;
            }
          }

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

        if (newSelectedId) {
          setCurrentSelectedId(newSelectedId);
          setCurrentFocusedId(newSelectedId);
        }

        notifyInfo(`Successfully removed component`);
      }
    },
    [getValues, setValue, setCurrentSelectedId, setCurrentFocusedId]
  );

  const moveComponentUp: PreviewerContextType["moveComponentUp"] = useCallback(
    (componentId) => {
      const messageComponent = getValues("messageComponent");

      if (!messageComponent) return;

      const updateTree = (component: Component): Component => {
        if (component.children) {
          const childIndex = component.children.findIndex((child) => child.id === componentId);

          if (childIndex > 0) {
            // IDs must also be updated since IDs are position-based
            const newChildren = [...component.children];
            const temp = newChildren[childIndex - 1];
            const tempId = newChildren[childIndex - 1].id;
            newChildren[childIndex - 1] = { ...newChildren[childIndex], id: tempId };
            newChildren[childIndex] = { ...temp, id: newChildren[childIndex].id };
            setCurrentSelectedId(tempId);
            setCurrentFocusedId(tempId);

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
            // IDs must also be updated since IDs are position-based
            const newChildren = [...component.children];
            const temp = newChildren[childIndex + 1];
            const tempId = newChildren[childIndex + 1].id;
            newChildren[childIndex + 1] = { ...newChildren[childIndex], id: tempId };
            newChildren[childIndex] = { ...temp, id: newChildren[childIndex].id };
            setCurrentSelectedId(tempId);
            setCurrentFocusedId(tempId);

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
          setValue(formPath as any, newComponent, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          });
        }
      },
      [currentSelectedId, getValues, setValue]
    );

  const navigateToComponentId: PreviewerContextType["navigateToComponentId"] = useCallback((id) => {
    const { messageComponent } = getValues();

    setCurrentSelectedId(id);
    const parentIds = getPreviewerComponentParentIds(messageComponent, id);

    if (parentIds) {
      setExpandedIds((prev) => new Set([...prev, ...parentIds]));
    }
  }, []);

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
      errorDescription: description,
      setCurrentArticleId,
      currentArticle,
      hasNoArticles,
      isFetchingDifferentArticle,
      updateCurrentlySelectedComponent,
      navigateToComponentId,
    }),
    [
      articles,
      currentArticleId,
      isLoading,
      messageRef,
      description,
      fetchArticles,
      currentArticle,
      t,
      hasNoArticles,
      isFetchingDifferentArticle,
      updateCurrentlySelectedComponent,
      navigateToComponentId,
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
