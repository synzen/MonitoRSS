import { Flex, chakra } from "@chakra-ui/react";

import { NewHeader } from "../NewHeader";

interface Props {
  // eslint-disable-next-line react/no-unused-prop-types
  requireFeed?: boolean;
  children?: React.ReactNode;
  invertBackground?: boolean;
}

export const PageContentV2 = ({ children, invertBackground }: Props) => {
  return (
    <Flex flexGrow={1} alignItems="center" flexDir="column" overflow="auto">
      <chakra.header width="full">
        <NewHeader invertBackground={invertBackground} />
      </chakra.header>
      <main>
        <Flex width="100%" justifyContent="center" alignItems="flex-start" flex={1}>
          {children}
        </Flex>
      </main>
    </Flex>
  );
};
