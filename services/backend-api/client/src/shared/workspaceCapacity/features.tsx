import { FaCheck, FaXmark } from "react-icons/fa6";
import { Flex, HStack, Icon, Text, VisuallyHidden } from "@chakra-ui/react";

// The canonical workspace benefits copy, shared by the buy moment (pricing
// dialog) and the manage moment (billing activation) so the two surfaces never
// drift. Capability leads ahead of collaboration: prod data shows buyers want
// the higher capacity and external-properties capability more than the member
// invites, so those bullets come first. "Workspace" never appears as a bullet.
export const WORKSPACE_FEATURES = [
  "Everything in Personal",
  "External properties (scrape external links)",
  "One shared bill for everyone",
  "Invite members to co-manage feeds",
];

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
      <Flex bg="brandSolid" rounded="full" p={1} mt={1} aria-hidden>
        <Icon width={3} height={3} fontSize="md" color="brand.contrast">
          <FaCheck />
        </Icon>
      </Flex>
    ) : (
      <Flex bg="bg.subtle" rounded="full" p={1.5} mt={1} aria-hidden>
        <Icon width={2} height={2} fontSize="sm">
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
