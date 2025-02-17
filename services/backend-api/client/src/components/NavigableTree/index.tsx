import {
  ComponentProps,
  HTMLAttributes,
  MouseEvent,
  PropsWithChildren,
  ReactElement,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  NavigableTreeProvider,
  useNavigableTreeContext,
} from "../../contexts/NavigableTreeContext";
import {
  NavigableTreeItemContext,
  NavigableTreeItemProvider,
  useNavigableTreeItemContext,
} from "../../contexts/NavigableTreeItemContext";
import { chakra, SystemStyleObject } from "@chakra-ui/react";
import getChakraColor from "../../utils/getChakraColor";

interface TreeProps extends PropsWithChildren {
  accessibleLabel: string;
}

const NavigableTree = ({ children, accessibleLabel }: TreeProps) => {
  return (
    <NavigableTreeProvider>
      <div role="tree" aria-label={accessibleLabel}>
        {children}
      </div>
    </NavigableTreeProvider>
  );
};

export const NavigableTreeItemGroup = (props: ComponentProps<typeof chakra.div>) => {
  const { isExpanded } = useNavigableTreeItemContext();
  return (
    <chakra.div
      role="group"
      className={"navigable-tree-group"}
      display={isExpanded ? "block" : "none"}
      {...props}
    ></chakra.div>
  );
};

interface TreeItemProps extends PropsWithChildren {
  id: string;
  isRootItem?: boolean;
  onActivate?: () => void;
  onEscape?: () => void;
  ariaLabel?: string;
}

export const NavigableTreeItem = ({
  id,
  children,
  isRootItem,
  onActivate,
  onEscape,
  ariaLabel,
}: TreeItemProps) => {
  const { currentSelectedId } = useNavigableTreeContext();
  const treeItemRef = useRef<HTMLDivElement>(null);
  const [hasGroup, setHasGroup] = useState(false);

  let tabIndex: 0 | -1 = -1;

  if (currentSelectedId) {
    if (currentSelectedId === id) {
      tabIndex = 0;
    }
  } else if (isRootItem) {
    tabIndex = 0;
  }

  useEffect(() => {
    if (!treeItemRef.current) {
      return;
    }

    const hasGroup = treeItemRef.current.querySelector('.navigable-tree-group[role="group"]');

    setHasGroup(!!hasGroup);
  }, [treeItemRef.current]);

  return (
    <NavigableTreeItemProvider id={id} isExpanded={isRootItem}>
      <NavigableTreeItemContext.Consumer>
        {({ isExpanded, onFocused, onKeyDown, onBlurred }) => {
          return (
            <div
              aria-label={ariaLabel}
              ref={treeItemRef}
              role="treeitem"
              data-id={id}
              onFocus={(e) => {
                // const focusedElem = document.activeElement as HTMLElement;
                // if (focusedElem !== treeItemRef.current) {
                //   return;
                // }
                e.stopPropagation();
                onFocused();
              }}
              tabIndex={tabIndex}
              onBlur={(e) => {
                e.stopPropagation();
                onBlurred();
              }}
              onKeyDown={(e) => {
                // if current div is not focused, do nothing
                // const focusedElem = document.activeElement as HTMLElement;
                // if (focusedElem !== treeItemRef.current) {
                //   return;
                // }

                // if enter or space
                if (e.key === "Enter" || e.key === " ") {
                  onActivate?.();
                } else if (e.key === "Escape") {
                  onEscape?.();
                } else {
                  onKeyDown(e);
                }
              }}
              aria-selected={currentSelectedId === id}
              aria-expanded={hasGroup ? isExpanded : undefined}
              style={{
                outline: "none",
              }}
            >
              {children}
            </div>
          );
        }}
      </NavigableTreeItemContext.Consumer>
    </NavigableTreeItemProvider>
  );
};

interface ButtonProps<T> {
  children: (p: {
    onClick: (e: MouseEvent<T>) => void;
    isFocused: boolean;
    isExpanded: boolean;
  }) => ReactElement;
}

export const NavigableTreeItemExpandButton = <T,>({ children }: ButtonProps<T>) => {
  const { isExpanded, onCollapsed, onExpanded, onFocused, isFocused } =
    useNavigableTreeItemContext();

  return children({
    isExpanded,
    isFocused,
    onClick: (e) => {
      e.stopPropagation();

      onFocused();
      isExpanded ? onCollapsed() : onExpanded();
    },
  });
};

export default NavigableTree;
