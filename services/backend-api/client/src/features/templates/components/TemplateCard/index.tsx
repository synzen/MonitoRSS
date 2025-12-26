import React from "react";
import { Box, VStack, Text, Badge, Icon, useRadio, UseRadioProps } from "@chakra-ui/react";
import { CheckCircleIcon, ViewIcon } from "@chakra-ui/icons";
import { Template } from "../../types";

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

  return (
    <Box as="label" data-testid={testId}>
      <input {...input} />
      <Box
        {...rootProps}
        position="relative"
        borderWidth={isChecked ? "2px" : "1px"}
        borderColor={isChecked ? "blue.500" : "gray.600"}
        borderRadius="md"
        bg={isChecked ? "blue.900" : "gray.800"}
        p={4}
        cursor={isDisabled ? "not-allowed" : "pointer"}
        opacity={isDisabled ? 0.5 : 1}
        transition="all 0.2s"
        minH="120px"
        minW="44px"
        _hover={
          !isDisabled && !isChecked
            ? {
                borderColor: "blue.400",
                bg: "gray.700",
                boxShadow: "md",
              }
            : undefined
        }
        _focus={{
          boxShadow: "outline",
        }}
        _checked={{
          borderColor: "blue.500",
          borderWidth: "2px",
          bg: "blue.900",
        }}
        _disabled={{
          opacity: 0.5,
          cursor: "not-allowed",
        }}
      >
        {isDisabled && (
          <Badge position="absolute" top={2} left={2} colorScheme="gray" fontSize="xs">
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
          <Text fontWeight="medium" fontSize="sm" color="white" noOfLines={1}>
            {template.name}
          </Text>
          <Text fontSize="xs" color="gray.400" noOfLines={2}>
            {template.description}
          </Text>
        </VStack>
      </Box>
    </Box>
  );
};

export const TemplateCard = React.memo(TemplateCardComponent);
TemplateCard.displayName = "TemplateCard";
