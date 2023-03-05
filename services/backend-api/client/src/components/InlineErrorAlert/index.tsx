import { Alert, AlertDescription, AlertIcon, AlertTitle, Box } from "@chakra-ui/react";

interface Props {
  title?: string;
  description?: string;
}

export const InlineErrorAlert = ({ title, description }: Props) => {
  return (
    <Alert status="error">
      <AlertIcon />
      <Box>
        <AlertTitle display="block">{title}</AlertTitle>
        <AlertDescription display="block">{description}</AlertDescription>
      </Box>
    </Alert>
  );
};
