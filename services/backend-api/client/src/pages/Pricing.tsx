import { Box, Button } from "@chakra-ui/react";
import { PricingDialog } from "../components/PricingDialog";

export const Pricing = () => {
  return (
    <Box>
      <PricingDialog trigger={<Button />} />
    </Box>
  );
};
