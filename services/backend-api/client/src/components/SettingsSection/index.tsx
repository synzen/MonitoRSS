import { ReactNode } from "react";
import { Heading, SimpleGrid, Stack, Text } from "@chakra-ui/react";

interface Props {
  title: string;
  description?: ReactNode;
  headingId?: string;
  children: ReactNode;
}

/**
 * A full-width settings row: the title and explanatory prose anchor the left third,
 * controls fill the right two-thirds. Collapses to a single column on smaller
 * screens. Rendered as a named region so each section is individually addressable
 * by assistive technology.
 */
export const SettingsSection = ({ title, description, headingId, children }: Props) => (
  <SimpleGrid
    as="section"
    aria-label={title}
    columns={{ base: 1, lg: 3 }}
    gap={{ base: 5, lg: 12 }}
  >
    <Stack gap={2}>
      <Heading as="h2" size="md" id={headingId}>
        {title}
      </Heading>
      {description ? (
        <Text color="fg.muted" fontSize="sm">
          {description}
        </Text>
      ) : null}
    </Stack>
    <Stack gridColumn={{ lg: "span 2" }} gap={4} minW={0}>
      {children}
    </Stack>
  </SimpleGrid>
);
