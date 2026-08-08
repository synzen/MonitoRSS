import { Popover as ChakraPopover, Portal } from "@chakra-ui/react";
import * as React from "react";
import { CloseButton } from "./close-button";

interface PopoverContentProps extends ChakraPopover.ContentProps {
  portalled?: boolean;
  portalRef?: React.RefObject<HTMLElement | null>;
}

export const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  function PopoverContent(props, ref) {
    const { portalled = true, portalRef, ...rest } = props;

    return (
      <Portal disabled={!portalled} container={portalRef}>
        <ChakraPopover.Positioner>
          <ChakraPopover.Content ref={ref} {...rest} />
        </ChakraPopover.Positioner>
      </Portal>
    );
  },
);

export const PopoverArrow = React.forwardRef<HTMLDivElement, ChakraPopover.ArrowProps>(
  function PopoverArrow(props, ref) {
    return (
      <ChakraPopover.Arrow {...props} ref={ref}>
        <ChakraPopover.ArrowTip />
      </ChakraPopover.Arrow>
    );
  },
);

export const PopoverCloseTrigger = React.forwardRef<
  HTMLButtonElement,
  ChakraPopover.CloseTriggerProps
>(function PopoverCloseTrigger(props, ref) {
  return (
    <ChakraPopover.CloseTrigger
      position="absolute"
      top="1"
      insetEnd="1"
      {...props}
      asChild
      ref={ref}
    >
      <CloseButton size="sm" />
    </ChakraPopover.CloseTrigger>
  );
});

export const PopoverTitle = ChakraPopover.Title;
export const PopoverDescription = ChakraPopover.Description;
export const PopoverFooter = ChakraPopover.Footer;
export const PopoverHeader = ChakraPopover.Header;
export const PopoverRoot = ChakraPopover.Root;

export const NestedPopoverRoot = (props: ChakraPopover.RootProps) => {
  const {
    closeOnEscape = true,
    defaultOpen = false,
    onOpenChange,
    open: controlledOpen,
    ...rest
  } = props;
  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const openRef = React.useRef(open);
  openRef.current = open;

  const handleOpenChange = React.useCallback(
    (details: ChakraPopover.OpenChangeDetails) => {
      openRef.current = details.open;
      if (!isControlled) setUncontrolledOpen(details.open);
      onOpenChange?.(details);
    },
    [isControlled, onOpenChange],
  );

  React.useLayoutEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!openRef.current || !closeOnEscape || event.key !== "Escape" || event.isComposing) {
        return;
      }

      // Zag defers registering a popover's dismissable layer by one animation frame.
      // Capturing on window prevents a parent dialog's document listener from winning
      // that gap and dismissing both overlays.
      event.preventDefault();
      event.stopImmediatePropagation();
      handleOpenChange({ open: false });
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [closeOnEscape, handleOpenChange]);

  return (
    <ChakraPopover.Root
      {...rest}
      closeOnEscape={closeOnEscape}
      open={open}
      onOpenChange={handleOpenChange}
    />
  );
};

export const PopoverBody = ChakraPopover.Body;
export const PopoverTrigger = ChakraPopover.Trigger;
