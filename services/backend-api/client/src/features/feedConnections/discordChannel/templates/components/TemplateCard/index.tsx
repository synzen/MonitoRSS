import React from "react";
import { Box, VStack, HStack, Text, Badge, Icon, useRadio, UseRadioProps } from "@chakra-ui/react";
import { CheckCircleIcon, InfoOutlineIcon, ViewIcon } from "@chakra-ui/icons";
import { Template } from "../../types";

const FIELD_EXPLANATIONS: Record<string, string> = {
  image: "No images detected in recent articles",
  description: "No descriptions detected in recent articles",
  author: "No author info detected in recent articles",
};

const DEFAULT_EXPLANATION = "Required fields not detected in recent articles";
const NEEDS_ARTICLES_EXPLANATION = "Waiting for articles to check compatibility";

const getExplanationForMissingFields = (disabledReason: string): string => {
  if (!disabledReason.startsWith("Needs: ")) {
    return DEFAULT_EXPLANATION;
  }

  const missingFieldsStr = disabledReason.slice("Needs: ".length);

  return FIELD_EXPLANATIONS[missingFieldsStr] || DEFAULT_EXPLANATION;
};

export interface TemplateCardProps extends UseRadioProps {
  template: Template;
  disabledReason?: string;
  testId?: string;
}

const getThumbnailContent = (template: Template) => {
  if (template.ThumbnailComponent) {
    return <template.ThumbnailComponent />;
  }

  if (template.thumbnail) {
    return (
      <Box as="img" src={template.thumbnail} alt="" maxH="100%" maxW="100%" objectFit="contain" />
    );
  }

  return <Icon as={ViewIcon} color="gray.500" boxSize={8} aria-hidden="true" />;
};

const getBorderColor = (isChecked: boolean, isDisabled: boolean) => {
  if (isChecked) {
    return "blue.500";
  }

  if (isDisabled) {
    return "gray.700";
  }

  return "gray.600";
};

const TemplateCardComponent = (props: TemplateCardProps) => {
  const { template, disabledReason = "Needs articles", testId, ...radioProps } = props;
  const { getInputProps, getRootProps, state } = useRadio(radioProps);

  const input = getInputProps();
  const rootProps = getRootProps();

  const { isChecked, isDisabled } = state;

  const needsArticles = disabledReason === "Needs articles";
  const explanation = needsArticles
    ? NEEDS_ARTICLES_EXPLANATION
    : getExplanationForMissingFields(disabledReason);

  return (
    <Box
      as="label"
      data-testid={testId}
      _focusWithin={{
        "> div": {
          outline: "2px solid",
          outlineColor: "blue.300",
          outlineOffset: "2px",
        },
      }}
    >
      <input {...input} />
      <Box
        {...rootProps}
        position="relative"
        borderWidth="2px"
        borderColor={getBorderColor(isChecked, isDisabled ?? false)}
        borderStyle={isDisabled ? "dashed" : "solid"}
        borderRadius="md"
        bg={isChecked ? "blue.900" : "gray.800"}
        p={3}
        cursor={isDisabled ? "not-allowed" : "pointer"}
        transition="background 0.2s, border-color 0.2s"
        minW="44px"
        _hover={
          !isDisabled && !isChecked
            ? {
                borderColor: "blue.400",
                bg: "gray.700",
              }
            : undefined
        }
        _checked={{
          borderColor: "blue.500",
          bg: "blue.900",
        }}
        _disabled={{
          opacity: 1,
          cursor: "not-allowed",
        }}
      >
        {isChecked && (
          <Icon
            as={CheckCircleIcon}
            position="absolute"
            top={2}
            right={2}
            color="blue.400"
            boxSize={5}
            aria-hidden="true"
          />
        )}
        <HStack spacing={4} align="center">
          <Box
            bg="gray.900"
            borderRadius="sm"
            w="120px"
            h="60px"
            flexShrink={0}
            display="flex"
            alignItems="center"
            justifyContent="center"
            filter={isDisabled ? "grayscale(100%)" : undefined}
            opacity={isDisabled ? 0.5 : 1}
            p={1}
          >
            {getThumbnailContent(template)}
          </Box>
          <VStack align="start" spacing={1} flex={1} minW={0}>
            <HStack spacing={2} w="100%" flexWrap="wrap">
              <Text fontWeight="medium" fontSize="sm" color={isDisabled ? "gray.400" : "white"}>
                {template.name}
              </Text>
              {isDisabled && (
                <Badge colorScheme="orange" variant="subtle" fontSize="xs" flexShrink={0}>
                  {disabledReason}
                </Badge>
              )}
            </HStack>
            <Text fontSize="sm" color="gray.400">
              {template.description}
            </Text>
            {isDisabled && (
              <HStack spacing={1} align="center">
                <Icon as={InfoOutlineIcon} boxSize={3} color="gray.400" aria-hidden="true" />
                <Text fontSize="xs" color="gray.400">
                  {explanation}
                </Text>
              </HStack>
            )}
          </VStack>
        </HStack>
      </Box>
    </Box>
  );
};

export const TemplateCard = React.memo(TemplateCardComponent);
TemplateCard.displayName = "TemplateCard";
