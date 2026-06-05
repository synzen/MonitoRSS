import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useRef,
  ReactNode,
  useEffect,
} from "react";
import { useTranslation } from "react-i18next";
import {
  AddableComponentType,
  Component,
  ComponentType,
  SectionComponent,
  MessageComponentRoot,
  LegacyEmbedComponent,
  LegacyEmbedContainerComponent,
} from "./types";
import {
  useUserFeedArticles,
  useUserFeedContext,
  useUserFeedConnectionContext,
} from "@/features/feed";
import createNewMessageBuilderComponent from "./utils/createNewMessageBuilderComponent";
import { useGetUserFeedArticlesError } from "@/features/feedConnections";
import { useNavigableTreeContext } from "./contexts/NavigableTreeContext";
import { FeedDiscordChannelConnection } from "@/types";
import { convertConnectionToMessageBuilderState } from "./utils/convertConnectionToMessageBuilderState";
import getMessageBuilderComponentParentIds from "./utils/getMessageBuilderComponentParentIds";
import { notifyInfo } from "@/utils/notifyInfo";
import { MessageBuilderStateProvider, useMessageBuilderStateContext } from "./state";

interface MessageBuilderContextType {
  addChildComponent: (
    parentId: string,
    childType: AddableComponentType,
    isAccessory?: boolean,
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
  const { messageComponent, serverMessageComponent, dispatch } = useMessageBuilderStateContext();
  const { currentSelectedId, setCurrentFocusedId, setCurrentSelectedId, setExpandedIds } =
    useNavigableTreeContext();
  const { t } = useTranslation();

  const [currentArticleId, setCurrentArticleId] = useState<string>();
  const feedId = userFeed.id;

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
      formatOptions: {
        ...articleFormatOptions,
        customPlaceholders: connection.customPlaceholders,
      },
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

  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (!connection) {
      return;
    }

    const newFormState = convertConnectionToMessageBuilderState(connection);

    if (newFormState.messageComponent) {
      dispatch({
        type: "SET_MESSAGE_COMPONENT",
        messageComponent: newFormState.messageComponent,
      });
    }

    if (!hasInitializedRef.current && newFormState.messageComponent?.id) {
      setCurrentSelectedId(newFormState.messageComponent.id);
      hasInitializedRef.current = true;
    }
  }, [connection]);

  const addChildComponent: MessageBuilderContextType["addChildComponent"] = useCallback(
    (parentId, childType, isAccessory = false) => {
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

          if (childType === ComponentType.LegacyEmbedContainer) {
            newComponent = createNewMessageBuilderComponent(
              childType,
              parentId,
              0,
            ) as LegacyEmbedContainerComponent;

            indexToAddAt = 1;
            const childEmbed = createNewMessageBuilderComponent(
              ComponentType.LegacyEmbed,
              newComponent.id,
              0,
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

      dispatch({ type: "SET_MESSAGE_COMPONENT", messageComponent: newRoot });
      setExpandedIds((ids) => new Set([...ids, ...idsToExpand]));

      return newComponent;
    },
    [messageComponent, dispatch],
  );

  const deleteComponent: MessageBuilderContextType["deleteComponent"] = useCallback(
    (componentId) => {
      if (!messageComponent) return;

      if (componentId === messageComponent.id) return;

      let newSelectedId: string | null = null;

      const removeFromTree = (component: Component): Component | null => {
        if (component.type === ComponentType.V2Section && component.accessory?.id === componentId) {
          newSelectedId = component.id;

          return {
            ...component,
            accessory: undefined,
          } as SectionComponent;
        }

        if (component.children) {
          const childIndex = component.children.findIndex((child) => child.id === componentId);

          if (childIndex !== -1) {
            if (childIndex < component.children.length - 1) {
              newSelectedId = component.children[childIndex + 1].id;
            } else if (childIndex === component.children.length - 1 && childIndex > 0) {
              newSelectedId = component.children[childIndex - 1].id;
            } else {
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

        return component.id === componentId ? null : component;
      };

      const updatedComponent = removeFromTree(messageComponent);

      if (updatedComponent) {
        dispatch({
          type: "SET_MESSAGE_COMPONENT",
          messageComponent: updatedComponent as MessageComponentRoot,
        });

        if (newSelectedId) {
          setCurrentSelectedId(newSelectedId);
          setCurrentFocusedId(newSelectedId);
        }

        notifyInfo(`Successfully removed component`);
      }
    },
    [messageComponent, dispatch, setCurrentSelectedId, setCurrentFocusedId],
  );

  const moveComponentUp: MessageBuilderContextType["moveComponentUp"] = useCallback(
    (componentId) => {
      dispatch({ type: "MOVE_COMPONENT_UP", componentId });
      setCurrentSelectedId(componentId);
      setCurrentFocusedId(componentId);
    },
    [dispatch, setCurrentSelectedId, setCurrentFocusedId],
  );

  const moveComponentDown: MessageBuilderContextType["moveComponentDown"] = useCallback(
    (componentId) => {
      dispatch({ type: "MOVE_COMPONENT_DOWN", componentId });
      setCurrentSelectedId(componentId);
      setCurrentFocusedId(componentId);
    },
    [dispatch, setCurrentSelectedId, setCurrentFocusedId],
  );

  const resetMessage: MessageBuilderContextType["resetMessage"] = useCallback(() => {
    dispatch({ type: "RESET", snapshot: serverMessageComponent });
  }, [dispatch, serverMessageComponent]);

  const updateCurrentlySelectedComponent: MessageBuilderContextType["updateCurrentlySelectedComponent"] =
    useCallback(
      (newComponent) => {
        if (!currentSelectedId) {
          return;
        }

        dispatch({
          type: "UPDATE_COMPONENT",
          componentId: currentSelectedId,
          component: newComponent,
        });
      },
      [currentSelectedId, dispatch],
    );

  const navigateToComponentId: MessageBuilderContextType["navigateToComponentId"] = useCallback(
    (id) => {
      setCurrentSelectedId(id);
      const parentIds = getMessageBuilderComponentParentIds(messageComponent, id);

      if (parentIds) {
        setExpandedIds((prev) => new Set([...prev, ...parentIds]));
      }
    },
    [messageComponent],
  );

  const switchRootType: MessageBuilderContextType["switchRootType"] = useCallback(
    (targetType: ComponentType.LegacyRoot | ComponentType.V2Root) => {
      dispatch({ type: "SWITCH_ROOT_TYPE", targetType });

      // After dispatch, we need to select the new root. The reducer will produce
      // a new root, so we need to know its ID. Since createNewMessageBuilderComponent
      // generates a deterministic ID based on type + parentId + index, we can compute it.
      const expectedNewId = createNewMessageBuilderComponent(targetType, "", 0).id;

      setCurrentSelectedId(expectedNewId);
      setCurrentFocusedId(expectedNewId);
      setExpandedIds(() => new Set([expectedNewId]));
    },
    [dispatch, setCurrentSelectedId, setCurrentFocusedId, setExpandedIds],
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
      addChildComponent,
      deleteComponent,
      resetMessage,
      moveComponentUp,
      moveComponentDown,
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
    ],
  );

  return (
    <MessageBuilderContext.Provider value={contextValue}>{children}</MessageBuilderContext.Provider>
  );
};

export const MessageBuilderProvider: React.FC<{
  defaultValues?: { messageComponent?: MessageComponentRoot };
  children: ReactNode;
}> = ({ children, defaultValues }) => {
  const { connection } = useUserFeedConnectionContext<FeedDiscordChannelConnection>();
  const serverMessageComponent = useMemo(
    () => convertConnectionToMessageBuilderState(connection).messageComponent,
    [connection],
  );

  return (
    <MessageBuilderStateProvider
      initialMessageComponent={defaultValues?.messageComponent}
      serverMessageComponent={serverMessageComponent}
    >
      <MessageBuilderInternalProvider>{children}</MessageBuilderInternalProvider>
    </MessageBuilderStateProvider>
  );
};
