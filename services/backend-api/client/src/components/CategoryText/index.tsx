/* eslint-disable react/jsx-props-no-spreading */
import { Box, BoxProps, Button, HStack, Stack, StackProps, Text } from "@chakra-ui/react";
import React from "react";
import { FaCircleQuestion } from "react-icons/fa6";
import { useTranslation } from "react-i18next";
import {
  PopoverArrow,
  PopoverBody,
  PopoverCloseTrigger,
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DescriptionProps extends StackProps {
  title: string;
  children: React.ReactNode;
  helpTooltip?: {
    buttonLabel?: string;
    description: string;
  };
  helpText?: string;
  valueContainerProps?: BoxProps;
}

export const CategoryText: React.FC<DescriptionProps> = ({
  title,
  children,
  helpTooltip,
  valueContainerProps,
  ...styles
}) => {
  const { t } = useTranslation();

  const defaultTooltipLabel = t("components.categoryText.defaultTooltipLabel");

  const ariaLabelledBy = title.replace(/\s/g, "-").toLowerCase();

  return (
    <Stack gap="1" {...styles} as="li">
      <HStack>
        <Text
          fontWeight="bold"
          fontSize="xs"
          textTransform="uppercase"
          color="fg.muted"
          whiteSpace="nowrap"
          id={ariaLabelledBy}
        >
          {title}
        </Text>
        {helpTooltip && (
          <PopoverRoot>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                aria-label={helpTooltip.buttonLabel || defaultTooltipLabel}
                size="xs"
              >
                <FaCircleQuestion fontSize={12} />
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <PopoverArrow />
              <PopoverCloseTrigger />
              <PopoverBody>
                <Text>{helpTooltip.description}</Text>
              </PopoverBody>
            </PopoverContent>
          </PopoverRoot>
        )}
      </HStack>
      <Box aria-labelledby={ariaLabelledBy} {...valueContainerProps}>
        {children}
      </Box>
    </Stack>
  );
};
