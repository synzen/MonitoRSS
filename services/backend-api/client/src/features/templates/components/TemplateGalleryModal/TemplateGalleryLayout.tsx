import { Grid, GridItem } from "@chakra-ui/react";
import React from "react";

interface TemplateGalleryLayoutProps {
  /** Content for the left column (template list) */
  templateList: React.ReactNode;
  /** Content for the right column (preview) */
  preview: React.ReactNode;
}

/**
 * Shared layout component for TemplateGalleryModal and its loading skeleton.
 * Using a shared component ensures the skeleton layout never drifts from the actual modal.
 */
export const TemplateGalleryLayout: React.FC<TemplateGalleryLayoutProps> = ({
  templateList,
  preview,
}) => {
  return (
    <Grid templateColumns={{ base: "1fr", lg: "1fr minmax(0, 650px)" }} gap={6}>
      <GridItem maxH={{ lg: "60vh" }} overflowY={{ lg: "auto" }}>
        {templateList}
      </GridItem>
      <GridItem>{preview}</GridItem>
    </Grid>
  );
};
