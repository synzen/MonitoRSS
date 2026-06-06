import React from "react";
import { Box, VStack, HStack, Text, Badge, Icon } from "@chakra-ui/react";
import { FaCircleCheck, FaCircleInfo, FaEye } from "react-icons/fa6";
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

export interface TemplateCardProps extends React.InputHTMLAttributes<HTMLInputElement> {
  template: Template;
  disabledReason?: string;
  testId?: string;
  /** v2 compat: isChecked is accepted as an alias for checked */
  isChecked?: boolean;
  /** v2 compat: isDisabled is accepted as an alias for disabled */
  isDisabled?: boolean;
}

const getThumbnailContent = (template: Template) => {
  if (template.ThumbnailComponent) {
    return <template.ThumbnailComponent />;
  }

  if (template.thumbnail) {
    return (
      <img
        src={template.thumbnail}
        alt=""
        style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
      />
    );
  }

  return <Icon as={FaEye} color="fg.subtle" boxSize={8} aria-hidden="true" />;
};

const getBorderColor = (isChecked: boolean, isDisabled: boolean) => {
  if (isChecked) {
    return "brand.solid";
  }

  if (isDisabled) {
    return "border";
  }

  return "border.emphasized";
};

const TemplateCardComponent = (props: TemplateCardProps) => {
  const {
    template,
    disabledReason = "Needs articles",
    testId,
    isChecked: isCheckedProp,
    isDisabled: isDisabledProp,
    checked: checkedProp,
    disabled: disabledProp,
    ...inputProps
  } = props;

  const isChecked = isCheckedProp ?? checkedProp ?? false;
  const isDisabled = isDisabledProp ?? disabledProp ?? false;

  const needsArticles = disabledReason === "Needs articles";
  const explanation = needsArticles
    ? NEEDS_ARTICLES_EXPLANATION
    : getExplanationForMissingFields(disabledReason);

  return (
    <Box
      as="label"
      data-testid={testId}
      css={{
        "&:focus-within > div": {
          outline: "2px solid",
          outlineColor: "brand.focusRing",
          outlineOffset: "2px",
        },
      }}
    >
      <input
        type="radio"
        checked={isChecked}
        disabled={isDisabled}
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
        {...inputProps}
      />
      <Box
        position="relative"
        borderWidth="2px"
        borderColor={getBorderColor(isChecked, isDisabled)}
        borderStyle={isDisabled ? "dashed" : "solid"}
        borderRadius="l3"
        bg={isChecked ? "brand.subtle" : "bg.subtle"}
        p={3}
        cursor={isDisabled ? "not-allowed" : "pointer"}
        transition="background 0.2s, border-color 0.2s"
        minW="44px"
        _hover={
          !isDisabled && !isChecked
            ? {
                borderColor: "brand.solid",
                bg: "bg.emphasized",
              }
            : undefined
        }
        _checked={{
          borderColor: "brand.solid",
          bg: "brand.subtle",
        }}
        _disabled={{
          opacity: 1,
          cursor: "not-allowed",
        }}
      >
        {isChecked && (
          <Icon
            as={FaCircleCheck}
            position="absolute"
            top={2}
            right={2}
            color="brand.solid"
            boxSize={5}
            aria-hidden="true"
          />
        )}
        <HStack gap={4} align="center">
          <Box
            bg="bg"
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
          <VStack align="start" gap={1} flex={1} minW={0}>
            <HStack gap={2} w="100%" flexWrap="wrap">
              <Text fontWeight="medium" fontSize="sm" color={isDisabled ? "fg.muted" : "fg"}>
                {template.name}
              </Text>
              {isDisabled && (
                <Badge colorPalette="orange" variant="subtle" fontSize="xs" flexShrink={0}>
                  {disabledReason}
                </Badge>
              )}
            </HStack>
            <Text fontSize="sm" color="fg.muted">
              {template.description}
            </Text>
            {isDisabled && (
              <HStack gap={1} align="center">
                <Icon as={FaCircleInfo} boxSize={3} color="fg.muted" aria-hidden="true" />
                <Text fontSize="xs" color="fg.muted">
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
