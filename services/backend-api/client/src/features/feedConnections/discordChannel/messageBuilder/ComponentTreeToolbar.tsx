import React from "react";
import { Box, HStack, VStack, Button, Text } from "@chakra-ui/react";
import { VscCollapseAll } from "react-icons/vsc";
import { useNavigableTreeContext } from "./contexts/NavigableTreeContext";
import { useIsMessageBuilderDesktop } from "./hooks";
import { useMessageBuilderStateContext } from "./state";

export const ComponentTreeToolbar: React.FC = () => {
  const { setExpandedIds } = useNavigableTreeContext();
  const { messageComponent } = useMessageBuilderStateContext();
  const isDesktop = useIsMessageBuilderDesktop();

  const handleCollapseAll = () => {
    setExpandedIds(() => new Set());
  };

  if (!isDesktop) {
    return null;
  }

  return (
    <Box p={3} borderBottom="1px" borderColor="border">
      <HStack justify="space-between" align="center" flexWrap="wrap">
        <VStack align="start" gap={1}>
          <Text fontSize="md" fontWeight="bold" color="fg" as="h2">
            Components
          </Text>
        </VStack>
        <HStack gap={2} flexWrap="wrap">
          <Button variant="ghost" onClick={handleCollapseAll} disabled={!messageComponent}>
            <VscCollapseAll />
            Collapse all
          </Button>
        </HStack>
      </HStack>
    </Box>
  );
};
