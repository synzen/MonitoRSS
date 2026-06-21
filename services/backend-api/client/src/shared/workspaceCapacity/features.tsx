import { FaCheck, FaXmark } from "react-icons/fa6";
import { FiHelpCircle } from "react-icons/fi";
import { Button, Flex, HStack, Icon, Text, VisuallyHidden } from "@chakra-ui/react";
import {
  PopoverArrow,
  PopoverBody,
  PopoverCloseTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverRoot,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EXTERNAL_PROPERTIES_MAX_ARTICLES } from "@/constants/externalPropertiesMaxArticles";

// "External properties" is the in-product/jargon name; on the buy screen we lead
// with the benefit instead of the mechanism. The how-it-works and the (rarely
// relevant) article-count caveat live in an info popover rather than a bullet or
// an orphaned footnote, so the always-visible copy stays plain and honest.
const EXTERNAL_PROPERTIES_LABEL = "Rich content from article pages";
const EXTERNAL_PROPERTIES_INFO_TITLE = "Rich content from article pages";
const EXTERNAL_PROPERTIES_INFO_BODY =
  "Pull extra images, links, or thumbnails from the linked article's own webpage " +
  `into your Discord message. Available on feeds with fewer than ${EXTERNAL_PROPERTIES_MAX_ARTICLES} articles.`;

interface WorkspaceFeature {
  label: string;
  // When present, the row renders a keyboard-focusable info popover next to the
  // label (used for features whose benefit needs a one-line explanation).
  info?: { title: string; body: string };
}

// The canonical workspace benefits copy, shared by the buy moment (pricing
// dialog) and the manage moment (billing activation) so the two surfaces never
// drift. Capacity and collaboration lead; external properties is a <0.1%-of-feeds
// capability per prod data, so it sits last as an "and also". "Workspace" never
// appears as a bullet.
export const WORKSPACE_FEATURES: WorkspaceFeature[] = [
  { label: "Everything in Personal" },
  { label: "One shared bill for everyone" },
  { label: "Invite members to co-manage feeds" },
  {
    label: EXTERNAL_PROPERTIES_LABEL,
    info: { title: EXTERNAL_PROPERTIES_INFO_TITLE, body: EXTERNAL_PROPERTIES_INFO_BODY },
  },
];

// A keyboard-focusable "more info" disclosure for a feature row. Built on the
// shared Popover (not a hover tooltip) so the explanation is reachable by
// keyboard and touch, dismissible with Escape, and returns focus to the trigger.
const FeatureInfoPopover = ({ title, body }: { title: string; body: string }) => (
  <PopoverRoot positioning={{ placement: "top" }}>
    <PopoverTrigger asChild>
      <Button
        variant="plain"
        color="text.link"
        minW="6"
        h="6"
        px="1"
        aria-label={`About ${title.toLowerCase()}`}
      >
        <Icon as={FiHelpCircle} boxSize="3.5" aria-hidden />
      </Button>
    </PopoverTrigger>
    <PopoverContent maxWidth="xs" width="100%">
      <PopoverArrow />
      <PopoverCloseTrigger />
      <PopoverHeader fontWeight="semibold">{title}</PopoverHeader>
      <PopoverBody>{body}</PopoverBody>
    </PopoverContent>
  </PopoverRoot>
);

// A single feature row. An excluded feature must be conveyed to assistive tech,
// not by the crossed icon/color alone, so it carries visually-hidden status text.
export const FeatureRow = ({
  included,
  children,
}: {
  included: boolean;
  children: React.ReactNode;
}) => (
  <HStack as="li" align="flex-start">
    {included ? (
      <Flex
        bg="brandSolid"
        rounded="full"
        boxSize={5}
        align="center"
        justify="center"
        mt={1}
        flexShrink={0}
        aria-hidden
      >
        <Icon boxSize={3} color="brand.contrast">
          <FaCheck />
        </Icon>
      </Flex>
    ) : (
      <Flex
        bg="bg.subtle"
        rounded="full"
        boxSize={5}
        align="center"
        justify="center"
        mt={1}
        flexShrink={0}
        aria-hidden
      >
        <Icon boxSize={3} color="fg.muted">
          <FaXmark />
        </Icon>
      </Flex>
    )}
    <Text fontSize="md">
      {children}
      {!included && <VisuallyHidden> (not included)</VisuallyHidden>}
    </Text>
  </HStack>
);

// Renders one canonical WORKSPACE_FEATURES entry on the shared FeatureRow (all
// workspace features are included, so it is always a checkmark), adding the info
// popover when the feature carries one. The popover button sits beside the label
// rather than inside it so it keeps its own focus ring and hit target.
export const WorkspaceFeatureRow = ({ feature }: { feature: WorkspaceFeature }) => (
  <FeatureRow included>
    <HStack as="span" gap={1} align="center">
      <span>{feature.label}</span>
      {feature.info && <FeatureInfoPopover title={feature.info.title} body={feature.info.body} />}
    </HStack>
  </FeatureRow>
);
