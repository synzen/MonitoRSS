import { Flex } from "@chakra-ui/react";

interface Props {
  children?: React.ReactNode;
  header?: React.ReactNode;
}

export const PageContentV2 = ({ children, header }: Props) => {
  return (
    <Flex flexGrow={1} alignItems="center" flexDir="column" overflow="auto">
      {header}
      <Flex as="main" width="100%" justifyContent="center" alignItems="flex-start" flex={1}>
        {children}
      </Flex>
    </Flex>
  );
};
