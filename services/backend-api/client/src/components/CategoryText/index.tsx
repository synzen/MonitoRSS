/* eslint-disable react/jsx-props-no-spreading */
import { QuestionOutlineIcon } from "@chakra-ui/icons";
import {
  Box,
  BoxProps,
  Button,
  HStack,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverTrigger,
  Stack,
  StackProps,
  Text,
} from "@chakra-ui/react";
import React from "react";
import { useTranslation } from "react-i18next";

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

const QuestionOutlineComponent = React.forwardRef<any>((props, ref) => (
  <QuestionOutlineIcon fontSize={12} ref={ref} {...props} />
));

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
    <Stack spacing="1" {...styles} as="li">
      <HStack>
        <Text
          fontWeight="bold"
          fontSize="xs"
          casing="uppercase"
          color="gray.400"
          whiteSpace="nowrap"
          id={ariaLabelledBy}
        >
          {title}
        </Text>
        {helpTooltip && (
          <Popover>
            <PopoverTrigger>
              <Button
                variant="ghost"
                aria-label={helpTooltip.buttonLabel || defaultTooltipLabel}
                size="xs"
              >
                <QuestionOutlineComponent />
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <PopoverArrow />
              <PopoverCloseButton />
              <PopoverBody>
                <Text>{helpTooltip.description}</Text>
              </PopoverBody>
            </PopoverContent>
          </Popover>
        )}
      </HStack>
      <Box aria-labelledby={ariaLabelledBy} {...valueContainerProps}>
        {children}
      </Box>
    </Stack>
  );
};
