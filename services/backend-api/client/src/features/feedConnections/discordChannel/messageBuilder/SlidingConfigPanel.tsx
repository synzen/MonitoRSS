import React from "react";
import { Button } from "@chakra-ui/react";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogCloseTrigger,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { ComponentPropertiesPanel } from "./ComponentPropertiesPanel";
import getMessageBuilderComponentLabel from "./utils/getMessageBuilderComponentLabel";
import { useNavigableTreeContext } from "./contexts/NavigableTreeContext";
import findMessageBuilderComponentById from "./utils/findMessageBuilderComponentById";
import { useMessageBuilderStateContext } from "./state";

interface SlidingConfigPanelProps {
  onClose: () => void;
  isOpen: boolean;
}

export const SlidingConfigPanel: React.FC<SlidingConfigPanelProps> = ({ onClose, isOpen }) => {
  const { messageComponent } = useMessageBuilderStateContext();
  const { currentSelectedId } = useNavigableTreeContext();
  const { target: component } = currentSelectedId
    ? findMessageBuilderComponentById(messageComponent, currentSelectedId)
    : { target: null };

  const onDeleted = () => {
    onClose();
  };

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) onClose();
      }}
      size="full"
    >
      <DialogContent
        borderTop="1px solid"
        borderTopRadius="xl"
        borderColor="border"
        height="55vh"
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        shadow="2xl"
        boxShadow="0 -4px 25px 0 rgba(0, 0, 0, 0.4)"
        margin={0}
      >
        <DialogHeader
          py={2}
          px={4}
          borderBottom="1px solid"
          borderColor="border"
          fontSize="md"
          fontWeight="semibold"
          color="fg"
        >
          <DialogTitle>
            Configure {component ? getMessageBuilderComponentLabel(component.type) : "Component"}
          </DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger color="fg.muted" _hover={{ color: "fg", bg: "bg.emphasized" }} />
        <DialogBody p={4} height="calc(100% - 120px)" overflowY="auto">
          {component && (
            <ComponentPropertiesPanel
              hideTitle
              selectedComponentId={component.id}
              onDeleted={onDeleted}
            />
          )}
        </DialogBody>
        <DialogFooter borderTop="1px solid" borderColor="border" p={4}>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
