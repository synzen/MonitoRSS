import { Alert, HStack } from "@chakra-ui/react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { CloseButton } from "@/components/ui/close-button";

interface Props {
  status: "success" | "error" | "info";
  title?: ReactNode;
  description?: ReactNode;
  focusOnMount?: boolean;
  onClosed?: () => void;
}

export const DismissableAlert = ({ status, description, title, focusOnMount, onClosed }: Props) => {
  const [isOpen, setIsOpen] = useState(true);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusOnMount || !isOpen) {
      return undefined;
    }

    const frame = requestAnimationFrame(() => alertRef.current?.focus());

    return () => cancelAnimationFrame(frame);
  }, [focusOnMount, isOpen]);

  const onClose = () => {
    setIsOpen(false);
    onClosed?.();
  };

  return (
    <Alert.Root
      ref={alertRef}
      role="alert"
      status={status}
      hidden={!isOpen}
      alignItems={description ? "flex-start" : "center"}
      tabIndex={focusOnMount ? -1 : undefined}
    >
      <Alert.Indicator />
      <HStack
        justifyContent="space-between"
        w="100%"
        alignItems={description ? "flex-start" : "center"}
      >
        <Alert.Content>
          <Alert.Title>{title}</Alert.Title>
          {description && <Alert.Description>{description}</Alert.Description>}
        </Alert.Content>
        <CloseButton size="sm" pos="relative" top="-2" insetEnd="-2" onClick={onClose} />
      </HStack>
    </Alert.Root>
  );
};
