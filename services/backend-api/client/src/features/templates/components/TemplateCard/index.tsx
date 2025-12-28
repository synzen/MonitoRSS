import React from "react";
import { Box, VStack, Text, Badge, Icon, useRadio, UseRadioProps, Divider } from "@chakra-ui/react";
import { CheckCircleIcon, ViewIcon, InfoIcon } from "@chakra-ui/icons";
import { Template } from "../../types";

const FIELD_EXPLANATIONS: Record<string, string> = {
  image: "This template displays images from articles. Your feed's articles don't include images.",
  description:
    "This template shows article descriptions. Your feed's articles don't include descriptions.",
  author:
    "This template shows author names. Your feed's articles don't include author information.",
  default: "This template requires fields that your feed's articles don't have.",
};

const NEEDS_ARTICLES_EXPLANATION =
  "Templates require article data to determine compatibility. This feed currently has no articles available.";

const getExplanationForFields = (requiredFields: string[]): string => {
  if (requiredFields.length === 0) {
    return "";
  }

  if (requiredFields.length === 1) {
    return FIELD_EXPLANATIONS[requiredFields[0]] || FIELD_EXPLANATIONS.default;
  }

  return `This template needs ${requiredFields.join(
    " and "
  )} fields that your feed's articles don't have.`;
};

export interface TemplateCardProps extends UseRadioProps {
  template: Template;
  disabledReason?: string;
  testId?: string;
}

const TemplateCardComponent = (props: TemplateCardProps) => {
  const { template, disabledReason = "Needs articles", testId, ...radioProps } = props;
  const { getInputProps, getRootProps, state } = useRadio(radioProps);

  const input = getInputProps();
  const rootProps = getRootProps();

  const { isChecked, isDisabled } = state;

  const needsArticles = disabledReason === "Needs articles";
  const explanation = needsArticles
    ? NEEDS_ARTICLES_EXPLANATION
    : getExplanationForFields(template.requiredFields || []);

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
        borderColor={isChecked ? "blue.500" : isDisabled ? "gray.700" : "gray.600"}
        borderStyle={isDisabled ? "dashed" : "solid"}
        borderRadius="md"
        bg={isChecked ? "blue.900" : "gray.800"}
        p={4}
        cursor={isDisabled ? "not-allowed" : "pointer"}
        transition="background 0.2s, border-color 0.2s"
        minH="120px"
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
        {isDisabled && (
          <Badge
            position="absolute"
            top={2}
            left={2}
            zIndex={1}
            colorScheme="orange"
            variant="subtle"
            fontSize="xs"
          >
            {disabledReason}
          </Badge>
        )}
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
        <Box
          bg="gray.900"
          borderRadius="sm"
          h="60px"
          mb={3}
          display="flex"
          alignItems="center"
          justifyContent="center"
          filter={isDisabled ? "grayscale(100%)" : undefined}
          opacity={isDisabled ? 0.5 : 1}
        >
          {template.thumbnail ? (
            <Box
              as="img"
              src={template.thumbnail}
              alt=""
              maxH="100%"
              maxW="100%"
              objectFit="contain"
            />
          ) : (
            <Icon as={ViewIcon} color="gray.500" boxSize={6} aria-hidden="true" />
          )}
        </Box>
        <VStack align="start" spacing={1}>
          <Text
            fontWeight="medium"
            fontSize="sm"
            color={isDisabled ? "gray.400" : "white"}
            noOfLines={1}
          >
            {template.name}
          </Text>
          <Text fontSize="xs" color="gray.400" noOfLines={2}>
            {template.description}
          </Text>
        </VStack>
        {isDisabled && explanation && (
          <Box mt={3}>
            <Divider borderColor="gray.600" mb={3} />
            <Box display="flex" alignItems="flex-start" gap={2}>
              <Icon as={InfoIcon} color="blue.300" boxSize={3} mt={0.5} flexShrink={0} />
              <Text fontSize="xs" color="gray.300" lineHeight="tall">
                {explanation}
              </Text>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export const TemplateCard = React.memo(TemplateCardComponent);
TemplateCard.displayName = "TemplateCard";
