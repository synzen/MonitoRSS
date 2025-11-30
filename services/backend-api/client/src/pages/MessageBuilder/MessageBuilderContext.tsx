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
  LegacyMessageComponentRoot,
} from "./types";
import createMessageBuilderComponentSchema from "./utils/createMessageBuilderComponentSchema";
import { useUserFeedArticles } from "../../features/feed/hooks";
import { useUserFeedContext } from "../../contexts/UserFeedContext";
import createNewMessageBuilderComponent from "./utils/createNewMessageBuilderComponent";
import { useGetUserFeedArticlesError } from "../../features/feedConnections";
import MessageBuilderFormState from "./types/MessageBuilderFormState";
import getMessageBuilderComponentFormPathById from "./utils/getMessageBuilderComponentFormPathsById";
import { useNavigableTreeContext } from "../../contexts/NavigableTreeContext";
import { useUserFeedConnectionContext } from "../../contexts/UserFeedConnectionContext";
import { FeedDiscordChannelConnection } from "../../types";
import { convertConnectionToMessageBuilderState } from "./utils/convertConnectionToMessageBuilderState";
import getMessageBuilderComponentParentIds from "./utils/getMessageBuilderComponentParentIds";
import { notifyInfo } from "../../utils/notifyInfo";

const validationSchema = yup.object({
  messageComponent: createMessageBuilderComponentSchema().optional(),
});

interface MessageBuilderContextType {
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
  switchRootType: (targetType: ComponentType.LegacyRoot | ComponentType.V2Root) => void;
}

const MessageBuilderContext = createContext<MessageBuilderContextType | undefined>(undefined);

export const useMessageBuilderContext = () => {
  const context = useContext(MessageBuilderContext);

  if (!context) {
    throw new Error("useMessageBuilderContext must be used within a MessageBuilderProvider");
  }

  return context;
};

const MessageBuilderInternalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userFeed, articleFormatOptions } = useUserFeedContext();
  const { connection } = useUserFeedConnectionContext<FeedDiscordChannelConnection>();
  const { setValue, getValues, reset, trigger } = useFormContext<MessageBuilderFormState>();
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

    const newFormState = convertConnectionToMessageBuilderState(connection);

    reset(newFormState);

    if (!currentSelectedId && newFormState.messageComponent?.id) {
      setCurrentSelectedId(newFormState.messageComponent.id);
    }
  }, [connection]);

  const addChildComponent: MessageBuilderContextType["addChildComponent"] = useCallback(
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
            newComponent = createNewMessageBuilderComponent(childType, `${parentId}-accessory`, 0);
            idsToExpand.push(newComponent.id);

            return {
              ...component,
              accessory: newComponent,
            } as SectionComponent;
          }

          let indexToAddAt = component.children?.length || 0;

          // The order of legacy components are fixed
          if (childType === ComponentType.LegacyEmbedContainer) {
            newComponent = createNewMessageBuilderComponent(
              childType,
              parentId,
              0
            ) as LegacyEmbedContainerComponent;

            indexToAddAt = 1;
            const childEmbed = createNewMessageBuilderComponent(
              ComponentType.LegacyEmbed,
              newComponent.id,
              0
            ) as LegacyEmbedComponent;
            newComponent.children.push(childEmbed);
            idsToExpand.push(childEmbed.id);
          } else if (childType === ComponentType.LegacyText) {
            newComponent = createNewMessageBuilderComponent(childType, parentId, 0);
            indexToAddAt = 0;
          } else {
            newComponent = createNewMessageBuilderComponent(childType, parentId, indexToAddAt);
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

      // Validation does not trigger automatically otherwise for some reason
      trigger("messageComponent");

      return newComponent;
    },
    [getValues, setValue]
  );

  const deleteComponent: MessageBuilderContextType["deleteComponent"] = useCallback(
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

  const moveComponentUp: MessageBuilderContextType["moveComponentUp"] = useCallback(
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

  const moveComponentDown: MessageBuilderContextType["moveComponentDown"] = useCallback(
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

  const resetMessage: MessageBuilderContextType["resetMessage"] = useCallback(() => {
    reset();
  }, [reset]);

  const updateCurrentlySelectedComponent: MessageBuilderContextType["updateCurrentlySelectedComponent"] =
    useCallback(
      (newComponent) => {
        if (!currentSelectedId) {
          return;
        }

        const { messageComponent } = getValues();

        if (!messageComponent) {
          return;
        }

        const formPath = getMessageBuilderComponentFormPathById(
          messageComponent,
          currentSelectedId
        );

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

  const navigateToComponentId: MessageBuilderContextType["navigateToComponentId"] = useCallback(
    (id) => {
      const { messageComponent } = getValues();

      setCurrentSelectedId(id);
      const parentIds = getMessageBuilderComponentParentIds(messageComponent, id);

      if (parentIds) {
        setExpandedIds((prev) => new Set([...prev, ...parentIds]));
      }
    },
    []
  );

  const switchRootType: MessageBuilderContextType["switchRootType"] = useCallback(
    (targetType) => {
      const messageComponent = getValues("messageComponent");

      if (!messageComponent || messageComponent.type === targetType) {
        return;
      }

      // Preserve shared properties between root types
      const sharedProperties = {
        forumThreadTitle: messageComponent.forumThreadTitle,
        forumThreadTags: messageComponent.forumThreadTags,
        isForumChannel: messageComponent.isForumChannel,
        channelNewThreadTitle: messageComponent.channelNewThreadTitle,
        channelNewThreadExcludesPreview: messageComponent.channelNewThreadExcludesPreview,
        mentions: messageComponent.mentions,
        placeholderLimits: messageComponent.placeholderLimits,
        // Text content settings
        formatTables: (messageComponent as LegacyMessageComponentRoot).formatTables,
        stripImages: (messageComponent as LegacyMessageComponentRoot).stripImages,
        ignoreNewLines: (messageComponent as LegacyMessageComponentRoot).ignoreNewLines,
        enablePlaceholderFallback: (messageComponent as LegacyMessageComponentRoot)
          .enablePlaceholderFallback,
      };

      let newRoot: MessageComponentRoot;

      if (targetType === ComponentType.LegacyRoot) {
        newRoot = {
          ...(createNewMessageBuilderComponent(
            ComponentType.LegacyRoot,
            "",
            0
          ) as LegacyMessageComponentRoot),
          ...sharedProperties,
          children: [],
        };
      } else {
        newRoot = {
          ...(createNewMessageBuilderComponent(
            ComponentType.V2Root,
            "",
            0
          ) as V2MessageComponentRoot),
          ...sharedProperties,
          children: [],
        };
      }

      setValue("messageComponent", newRoot, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });

      // Select the new root
      setCurrentSelectedId(newRoot.id);
      setCurrentFocusedId(newRoot.id);
      setExpandedIds(() => new Set([newRoot.id]));
    },
    [getValues, setValue, setCurrentSelectedId, setCurrentFocusedId, setExpandedIds]
  );

  const currentArticle = articlesResponse?.result.articles?.[0];

  const contextValue: MessageBuilderContextType = useMemo(
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
      switchRootType,
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
      switchRootType,
    ]
  );

  return (
    <MessageBuilderContext.Provider value={contextValue}>{children}</MessageBuilderContext.Provider>
  );
};

export const MessageBuilderProvider: React.FC<{
  defaultValues?: MessageBuilderFormState;
  children: ReactNode;
}> = ({ children, defaultValues }) => {
  const formMethods = useForm<MessageBuilderFormState>({
    mode: "onChange",
    resolver: yupResolver(validationSchema),
    defaultValues,
  });

  return (
    <FormProvider {...formMethods}>
      <MessageBuilderInternalProvider>{children}</MessageBuilderInternalProvider>
    </FormProvider>
  );
};
