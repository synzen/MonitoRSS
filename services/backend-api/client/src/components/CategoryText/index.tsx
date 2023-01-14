/* eslint-disable react/jsx-props-no-spreading */
import { QuestionOutlineIcon } from "@chakra-ui/icons";
import { Box, HStack, Stack, StackProps, Text, Tooltip } from "@chakra-ui/react";
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
}

const QuestionOutlineComponent = React.forwardRef<any>((props, ref) => (
  <QuestionOutlineIcon fontSize={12} tabIndex={0} ref={ref} {...props} />
));

export const CategoryText: React.FC<DescriptionProps> = ({
  title,
  children,
  helpTooltip,
  ...styles
}) => {
  const { t } = useTranslation();

  const defaultTooltipLabel = t("common.components.categoryText.defaullTooltipLabel");

  return (
    <Stack as="dl" spacing="1" {...styles}>
      <HStack>
        <Text
          as="dt"
          fontWeight="bold"
          fontSize="xs"
          casing="uppercase"
          color="gray.500"
          whiteSpace="nowrap"
        >
          {title}
        </Text>
        {helpTooltip && (
          <Tooltip label={helpTooltip.description}>
            <QuestionOutlineComponent aria-label={helpTooltip.buttonLabel || defaultTooltipLabel} />
          </Tooltip>
        )}
      </HStack>
      <Box>
        {/* <Text fontSize="sm" fontWeight="medium"> */}
        {children}
      </Box>
      {/* </Text> */}
    </Stack>
  );
};
