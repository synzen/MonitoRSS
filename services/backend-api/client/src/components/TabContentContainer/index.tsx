import { Box } from "@chakra-ui/react";
import { PropsWithChildren } from "react";

export const TabContentContainer = ({ children }: PropsWithChildren) => {
  return (
    <Box border="solid 1px" borderColor="gray.700" borderRadius="md" py={4} px={[2, 4, 6]}>
      {children}
    </Box>
  );
};
