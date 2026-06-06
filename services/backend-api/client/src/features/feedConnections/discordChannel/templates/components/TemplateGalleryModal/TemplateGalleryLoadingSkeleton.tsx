import { Box, Skeleton, VStack, Text } from "@chakra-ui/react";

import { Panel } from "@/components/Panel";
import { TemplateGalleryLayout } from "./TemplateGalleryLayout";

/**
 * Loading skeleton for the TemplateGalleryModal that matches the final layout structure.
 */
export const TemplateGalleryLoadingSkeleton = () => {
  return (
    <Box>
      <TemplateGalleryLayout
        templateList={
          <VStack gap={3} align="stretch" p={1}>
            <Skeleton height="72px" borderRadius="l3" />
            <Skeleton height="72px" borderRadius="l3" />
            <Skeleton height="72px" borderRadius="l3" />
            <Skeleton height="72px" borderRadius="l3" />
          </VStack>
        }
        preview={
          <Panel surface="subtle" p={4} minH={{ base: "200px", lg: "400px" }}>
            <Text fontSize="sm" color="fg.muted" mb={3}>
              Preview
            </Text>
            <Skeleton height="32px" borderRadius="l3" mb={4} />
            <Skeleton height="300px" borderRadius="l3" />
          </Panel>
        }
      />
    </Box>
  );
};
