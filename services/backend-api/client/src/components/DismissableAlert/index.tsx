import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  CloseButton,
  HStack,
} from "@chakra-ui/react";
import { ReactNode, useState } from "react";

interface Props {
  status: "success" | "error" | "info";
  title?: ReactNode;
  description?: ReactNode;
  onClosed?: () => void;
}

export const DismissableAlert = ({ status, description, title, onClosed }: Props) => {
  const [isOpen, setIsOpen] = useState(true);

  const onClose = () => {
    setIsOpen(false);
    onClosed?.();
  };

  return (
    <Alert status={status} borderRadius="md" hidden={!isOpen}>
      <AlertIcon color="gray.100" />
      <HStack justifyContent="space-between" w="100%">
        <Box>
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>{description}</AlertDescription>
        </Box>
        <CloseButton
          alignSelf="flex-start"
          position="relative"
          right={-1}
          top={-1}
          onClick={onClose}
        />
      </HStack>
    </Alert>
  );
};
