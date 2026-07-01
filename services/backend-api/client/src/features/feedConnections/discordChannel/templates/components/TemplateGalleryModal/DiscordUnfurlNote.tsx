import { Box, Text, HStack, Icon, VStack, chakra } from "@chakra-ui/react";
import { FaCircleInfo } from "react-icons/fa6";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  PopoverTitle,
} from "@/components/ui/popover";

const NOTE_COPY =
  "Discord may add its own preview card from the link. Send to Discord to see the real result.";

const WONT_APPEAR_TITLE = "Why a card might not appear";
const WONT_APPEAR_REASONS = [
  "The source site does not provide preview data (image, title, description).",
  "The bot does not have the Embed Links permission in the channel.",
  "Discord cannot reach or read the article page.",
];

export const DiscordUnfurlNote = () => (
  <HStack gap={1.5} align="center" flexWrap="wrap" mt={2}>
    <Text fontSize="sm" color="fg.muted">
      {NOTE_COPY}
    </Text>
    <PopoverRoot positioning={{ placement: "top" }}>
      <PopoverTrigger asChild>
        <chakra.button
          type="button"
          aria-label={WONT_APPEAR_TITLE}
          cursor="pointer"
          color="fg.muted"
          _hover={{ color: "fg" }}
          _focusVisible={{
            outline: "2px solid",
            outlineColor: "brand.focusRing",
            outlineOffset: "2px",
            borderRadius: "sm",
          }}
          display="inline-flex"
          alignItems="center"
        >
          <Icon as={FaCircleInfo} boxSize={3.5} aria-hidden="true" />
        </chakra.button>
      </PopoverTrigger>
      <PopoverContent maxW="320px">
        <PopoverArrow />
        <PopoverBody>
          <PopoverTitle fontWeight="medium" fontSize="sm" mb={2}>
            {WONT_APPEAR_TITLE}
          </PopoverTitle>
          <VStack as="ul" align="start" gap={1.5} pl={0} listStyleType="none">
            {WONT_APPEAR_REASONS.map((reason) => (
              <HStack as="li" key={reason} align="start" gap={2}>
                <Box as="span" aria-hidden="true" color="fg.muted" lineHeight="1.5">
                  •
                </Box>
                <Text fontSize="sm" color="fg.muted">
                  {reason}
                </Text>
              </HStack>
            ))}
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </PopoverRoot>
  </HStack>
);
