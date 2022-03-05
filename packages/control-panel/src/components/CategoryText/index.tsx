/* eslint-disable react/jsx-props-no-spreading */
import { Stack, StackProps, Text } from '@chakra-ui/react';

interface DescriptionProps extends StackProps {
  title: string
  children: React.ReactNode
}

export const CategoryText: React.FC<DescriptionProps> = ({ title, children, ...styles }) => (
  <Stack as="dl" spacing="1" {...styles}>
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
    <Text fontSize="sm" fontWeight="medium">
      {children}
    </Text>
  </Stack>
);
