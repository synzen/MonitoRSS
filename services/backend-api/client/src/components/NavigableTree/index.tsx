import {
  ComponentProps,
  MouseEvent,
  PropsWithChildren,
  ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";
import { chakra } from "@chakra-ui/react";
import {
  NavigableTreeProvider,
  useNavigableTreeContext,
} from "../../contexts/NavigableTreeContext";
import {
  NavigableTreeItemContext,
  NavigableTreeItemProvider,
  useNavigableTreeItemContext,
} from "../../contexts/NavigableTreeItemContext";

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
      className="navigable-tree-group"
      // Use hidden attribute instead of display:none so child nodes exist in the DOM on
      // initial render. Google Translate only processes nodes present when it first runs;
      // display:none prevents the nodes from existing, while hidden keeps them in the tree.
      {...(isExpanded ? {} : { hidden: true })}
      {...props}
    />
  );
};

interface TreeItemProps extends PropsWithChildren {
  id: string;
  isRootItem?: boolean;
  onActivate?: () => void;
  onEscape?: () => void;
  ariaLabel?: string;
  withoutProvider?: boolean;
}

export const NavigableTreeItem = ({
  id,
  children,
  isRootItem,
  onActivate,
  onEscape,
  ariaLabel,
  withoutProvider,
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

    const thisHasGroup = treeItemRef.current.querySelector('.navigable-tree-group[role="group"]');

    setHasGroup(!!thisHasGroup);
  }, [treeItemRef.current]);

  const content = (
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
              // React synthetic events from Portals (e.g. Chakra Menu) bubble
              // through the React tree, not the DOM tree. Ignore key events
              // that originate from elements inside a Portal (like MenuItems)
              // so they don't interfere with the Portal's own keyboard handling.
              if (document.activeElement !== treeItemRef.current) {
                return;
              }

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
  );

  if (withoutProvider) {
    return content;
  }

  return (
    <NavigableTreeItemProvider id={id} isExpanded={isRootItem}>
      {content}
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

      if (isExpanded) {
        onCollapsed();
      } else {
        onExpanded();
      }
    },
  });
};

export default NavigableTree;
