import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { useNavigableTreeContext } from "./NavigableTreeContext";

// https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values
enum KeyboardNavKey {
  End = "End",
  Home = "Home",
  ArrowLeft = "ArrowLeft",
  ArrowUp = "ArrowUp",
  ArrowRight = "ArrowRight",
  ArrowDown = "ArrowDown",
}

type ContextProps = {
  isExpanded: boolean;
  onCollapsed: () => void;
  onExpanded: () => void;
  isFocused: boolean;
  isSelected: boolean;
  onFocused: () => void;
  onBlurred: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  setIsExpanded: (expanded: boolean) => void;
  id: string | null;
};

function getTreeItemSibling(treeItem: HTMLElement, dir: "next" | "previous"): HTMLElement | null {
  if (!treeItem) {
    return null;
  }

  const parentGroup = treeItem.parentElement?.closest(
    '.navigable-tree-group[role="group"]',
  ) as HTMLElement;

  if (!parentGroup) {
    // is the direct parent the tree itself?
    if (treeItem.parentElement?.getAttribute("role") === "tree") {
      const treeItems = Array.from(treeItem.parentElement.children) as HTMLElement[];
      const currentIndex = treeItems.indexOf(treeItem);

      if (dir === "next") {
        if (currentIndex < treeItems.length - 1) {
          return treeItems[currentIndex + 1];
        }
      }

      if (currentIndex > 0) {
        return treeItems[currentIndex - 1];
      }
    }

    return null;
  }

  const treeItems = Array.from(parentGroup.children) as HTMLElement[];
  const currentIndex = treeItems.indexOf(treeItem);

  if (dir === "next") {
    if (currentIndex < treeItems.length - 1) {
      return treeItems[currentIndex + 1];
    }
  } else if (currentIndex > 0) {
    return treeItems[currentIndex - 1];
  }

  return null;
}

function getLastTreeItemFromTreeItem(currentTreeItem?: HTMLElement | null): HTMLElement | null {
  if (!currentTreeItem) {
    return null;
  }

  const groupChildElem = currentTreeItem.querySelector('.navigable-tree-group[role="group"]');

  if (!groupChildElem) {
    return currentTreeItem;
  }

  const isNotExpanded = currentTreeItem.getAttribute("aria-expanded") !== "true";

  if (isNotExpanded) {
    return currentTreeItem;
  }

  const treeItems = Array.from(groupChildElem.children) as HTMLElement[];

  return getLastTreeItemFromTreeItem(treeItems[treeItems.length - 1]);
}

function getDeepestFirstTreeItemFromTreeItem(
  currentTreeItem?: HTMLElement | null,
): HTMLElement | null {
  if (!currentTreeItem) {
    return null;
  }

  const groupChildElem = currentTreeItem.querySelector('.navigable-tree-group[role="group"]');

  if (!groupChildElem) {
    return currentTreeItem;
  }

  const treeItems = Array.from(groupChildElem.children) as HTMLElement[];

  return getDeepestFirstTreeItemFromTreeItem(treeItems[0]);
}

function getFirstChildTreeItemFromTreeItem(
  currentTreeItem?: HTMLElement | null,
): HTMLElement | null {
  // is this a group?
  const groupChildElem = currentTreeItem?.querySelector('.navigable-tree-group[role="group"]');

  if (!groupChildElem) {
    return null;
  }

  const firstChildTreeItem = groupChildElem.querySelector('[role="treeitem"]') as HTMLElement;

  return firstChildTreeItem;
}

function getPreviousTreeItemFromTreeItem(currentTreeItem: HTMLElement) {
  const previousSibling = getTreeItemSibling(currentTreeItem, "previous");

  if (previousSibling) {
    return getLastTreeItemFromTreeItem(previousSibling);
  }

  const parentTreeItem = currentTreeItem.parentElement?.closest('[role="treeitem"]') as HTMLElement;

  return parentTreeItem;
}

function getNextTreeItemFromTreeItem(currentTreeItem?: HTMLElement | null): HTMLElement | null {
  if (!currentTreeItem) {
    return null;
  }

  const isExpanded = currentTreeItem.getAttribute("aria-expanded") === "true";

  // Check if this is an expanded parent tree item - if so, get the first child
  const groupChildElem = currentTreeItem.querySelector('.navigable-tree-group[role="group"]');

  const shouldTryToGetChild = !!(isExpanded && groupChildElem);

  if (shouldTryToGetChild) {
    const firstChildTreeItem = groupChildElem.querySelector('[role="treeitem"]') as HTMLElement;

    if (firstChildTreeItem) {
      return firstChildTreeItem;
    }

    return null;
  }

  // Check if there is a next sibling
  const nextTreeItem = getTreeItemSibling(currentTreeItem, "next");

  if (nextTreeItem) {
    return nextTreeItem;
  }

  // this is the last treeitem in its group - get the group's parent treeitem
  const parentGroup = currentTreeItem.parentElement?.closest(
    '.navigable-tree-group[role="group"]',
  ) as HTMLElement; // this is the role="group" element
  const parentTreeItem = parentGroup?.parentElement?.closest('[role="treeitem"]') as HTMLElement; // this is the parent tree item
  const nextSiblingOfParentTreeItem = getTreeItemSibling(parentTreeItem, "next");

  return getDeepestFirstTreeItemFromTreeItem(nextSiblingOfParentTreeItem);
}

function getClosestTreeItemParent(treeItem: HTMLElement) {
  return treeItem.parentElement?.closest('[role="treeitem"]') as HTMLElement;
}

function getLastExpandedTreeItem(treeItem: HTMLElement) {
  const tree = treeItem.closest('[role="tree"]') as HTMLElement;
  const treeItems = Array.from(tree.children) as HTMLElement[];
  const lastTreeItem = treeItems[treeItems.length - 1];

  if (lastTreeItem.getAttribute("aria-expanded") === "true") {
    return getLastTreeItemFromTreeItem(lastTreeItem);
  }

  return lastTreeItem;
}

export const NavigableTreeItemContext = createContext<ContextProps>({
  isExpanded: false,
  onCollapsed: () => {},
  onExpanded: () => {},
  isFocused: false,
  isSelected: false,
  onFocused: () => {},
  onBlurred: () => {},
  onKeyDown: () => {},
  setIsExpanded: () => {},
  id: null,
});

export const NavigableTreeItemProvider = ({
  id,
  children,
  isExpanded: defaultIsExpanded,
}: {
  id: string;
  children: ReactNode;
  isExpanded?: boolean;
}) => {
  const {
    currentSelectedId,
    currentFocusedId,
    setCurrentFocusedId,
    setCurrentSelectedId,
    expandedIds,
    setExpandedIds,
  } = useNavigableTreeContext();
  const isExpanded = expandedIds.has(id);
  const thisItemIsFocused = currentFocusedId === id;
  const thisItemIsSelected = currentSelectedId === id;

  const setIsExpanded = useCallback(
    (expanded: boolean) => {
      if (expanded) {
        setExpandedIds((prev) => new Set(prev).add(id));
      } else {
        setExpandedIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);

          return newSet;
        });
      }
    },
    [id, setExpandedIds],
  );

  const onFocused = useCallback(() => {
    setCurrentFocusedId(id);
    setCurrentSelectedId(id);
  }, [id, setCurrentFocusedId]);

  const onBlurred = useCallback(() => {
    setCurrentFocusedId(null);
  }, [setCurrentFocusedId]);

  const onExpanded = useCallback(() => {
    setIsExpanded(true);
  }, [setIsExpanded]);

  const onCollapsed = useCallback(() => {
    setIsExpanded(false);
  }, [setIsExpanded]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let preventKeyDefault = false;

      if (!thisItemIsFocused) {
        return;
      }

      switch (e.key) {
        case KeyboardNavKey.ArrowRight:
          if (!isExpanded) {
            onExpanded();
          } else {
            getFirstChildTreeItemFromTreeItem(e.currentTarget as HTMLElement)?.focus();
          }

          preventKeyDefault = true;
          break;
        case KeyboardNavKey.ArrowLeft:
          if (isExpanded) {
            onCollapsed();
          } else {
            getClosestTreeItemParent(e.currentTarget as HTMLElement)?.focus();
          }

          preventKeyDefault = true;
          break;

        case KeyboardNavKey.ArrowDown: {
          const next = getNextTreeItemFromTreeItem(e.currentTarget as HTMLElement);
          next?.focus();

          if (next?.getAttribute("data-id")) {
            setCurrentFocusedId(next.getAttribute("data-id"));
          }

          preventKeyDefault = true;
          break;
        }

        case KeyboardNavKey.ArrowUp: {
          const previousSibling = getPreviousTreeItemFromTreeItem(e.currentTarget as HTMLElement);
          previousSibling?.focus();

          if (previousSibling?.getAttribute("data-id")) {
            setCurrentFocusedId(previousSibling.getAttribute("data-id"));
          }

          preventKeyDefault = true;
          break;
        }

        case KeyboardNavKey.Home: {
          (
            e.currentTarget
              .closest('[role="tree"]')
              ?.querySelector('[role="treeitem"]') as HTMLElement
          )?.focus();
          preventKeyDefault = true;
          break;
        }

        case KeyboardNavKey.End:
          getLastExpandedTreeItem(e.currentTarget as HTMLElement)?.focus();
          preventKeyDefault = true;
          break;
        default:
          break;
      }

      if (preventKeyDefault) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [thisItemIsFocused, onCollapsed, onExpanded, isExpanded],
  );

  useEffect(() => {
    if (defaultIsExpanded !== undefined) {
      setIsExpanded(defaultIsExpanded);
    }
  }, [defaultIsExpanded, setIsExpanded]);

  const contextValue = useMemo(() => {
    return {
      isFocused: thisItemIsFocused,
      isSelected: thisItemIsSelected,
      onFocused,
      onBlurred,
      isExpanded,
      setIsExpanded,
      onKeyDown,
      onCollapsed,
      onExpanded,
      id,
    };
  }, [
    thisItemIsFocused,
    thisItemIsSelected,
    onFocused,
    onBlurred,
    isExpanded,
    setIsExpanded,
    onCollapsed,
    onExpanded,
    onKeyDown,
    id,
  ]);

  return (
    <NavigableTreeItemContext.Provider value={contextValue}>
      {children}
    </NavigableTreeItemContext.Provider>
  );
};

export const useNavigableTreeItemContext = () => {
  const contextData = useContext(NavigableTreeItemContext);

  return contextData;
};
