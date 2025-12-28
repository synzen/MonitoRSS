import { Box, Grid, GridItem, Skeleton, VStack, Text } from "@chakra-ui/react";

/**
 * Loading skeleton for the TemplateGalleryModal that matches the final layout structure.
 */
export const TemplateGalleryLoadingSkeleton = () => {
  return (
    <Box>
      <Skeleton height="20px" width="70%" mb={4} />
      <Grid templateColumns={{ base: "1fr", lg: "1fr 400px" }} gap={6}>
        <GridItem maxH={{ lg: "60vh" }} overflowY={{ lg: "auto" }}>
          <VStack spacing={3} align="stretch" p={1}>
            <Skeleton height="72px" borderRadius="md" />
            <Skeleton height="72px" borderRadius="md" />
            <Skeleton height="72px" borderRadius="md" />
            <Skeleton height="72px" borderRadius="md" />
          </VStack>
        </GridItem>
        <GridItem>
          <Box bg="gray.900" borderRadius="md" p={4} minH={{ base: "200px", lg: "400px" }}>
            <Text fontSize="sm" color="gray.400" mb={3}>
              Preview
            </Text>
            <Skeleton height="32px" borderRadius="md" mb={4} />
            <Skeleton height="300px" borderRadius="md" />
          </Box>
        </GridItem>
      </Grid>
    </Box>
  );
};
