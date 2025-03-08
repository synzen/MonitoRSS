import { Flex } from "@chakra-ui/react";

import { NewHeader } from "../NewHeader";

interface Props {
  children?: React.ReactNode;
  invertBackground?: boolean;
}

export const PageContentV2 = ({ children, invertBackground }: Props) => {
  return (
    <Flex flexGrow={1} alignItems="center" flexDir="column" overflow="auto">
      <NewHeader invertBackground={invertBackground} />
      <Flex as="main" width="100%" justifyContent="center" alignItems="flex-start" flex={1}>
        {children}
      </Flex>
    </Flex>
  );
};
