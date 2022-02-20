import { Stack, StackProps, Text } from '@chakra-ui/react';

interface DescriptionProps extends StackProps {
  title: string
  children: React.ReactNode
}

const CategoryText: React.FC<DescriptionProps> = ({ title, children }) => (
  <Stack as="dl" spacing="1">
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

export default CategoryText;
