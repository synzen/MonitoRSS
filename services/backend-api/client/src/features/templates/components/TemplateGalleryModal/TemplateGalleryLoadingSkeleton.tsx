import { Box, Skeleton, VStack, Text } from "@chakra-ui/react";

import { TemplateGalleryLayout } from "./TemplateGalleryLayout";

/**
 * Loading skeleton for the TemplateGalleryModal that matches the final layout structure.
 */
export const TemplateGalleryLoadingSkeleton = () => {
  return (
    <Box>
      <Skeleton height="20px" width="70%" mb={4} />
      <TemplateGalleryLayout
        templateList={
          <VStack spacing={3} align="stretch" p={1}>
            <Skeleton height="72px" borderRadius="md" />
            <Skeleton height="72px" borderRadius="md" />
            <Skeleton height="72px" borderRadius="md" />
            <Skeleton height="72px" borderRadius="md" />
          </VStack>
        }
        preview={
          <Box bg="gray.900" borderRadius="md" p={4} minH={{ base: "200px", lg: "400px" }}>
            <Text fontSize="sm" color="gray.400" mb={3}>
              Preview
            </Text>
            <Skeleton height="32px" borderRadius="md" mb={4} />
            <Skeleton height="300px" borderRadius="md" />
          </Box>
        }
      />
    </Box>
  );
};
