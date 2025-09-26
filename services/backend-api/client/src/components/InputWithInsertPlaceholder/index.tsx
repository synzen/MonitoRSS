import React from "react";
import {
  VStack,
  Textarea,
  Input,
  Button,
  FormControl,
  FormLabel,
  FormErrorMessage,
} from "@chakra-ui/react";
import { AddIcon } from "@chakra-ui/icons";
import { InsertPlaceholderDialog } from "../../pages/Previewer/InsertPlaceholderDialog";

interface Props {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  error?: string;
  rows?: number;
  isInvalid?: boolean;
  as?: "input" | "textarea";
}

export const InputWithInsertPlaceholder: React.FC<Props> = ({
  value,
  onChange,
  label,
  placeholder = "Enter text content",
  error,
  rows = 4,
  isInvalid = false,
  as = "textarea",
}) => {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const handleInsertPlaceholder = React.useCallback(
    (tag: string) => {
      if (inputRef.current) {
        const input = inputRef.current;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const currentValue = input.value;
        const newValue = currentValue.substring(0, start) + tag + currentValue.substring(end);

        onChange(newValue);
        input.setSelectionRange(start + tag.length, start + tag.length);
      }
    },
    [onChange]
  );

  return (
    <>
      <VStack align="stretch" spacing={2}>
        <FormControl isInvalid={isInvalid}>
          <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
            {label}
          </FormLabel>
          {as === "textarea" ? (
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              rows={rows}
              bg="gray.700"
              color="white"
              fontFamily="mono"
            />
          ) : (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              bg="gray.700"
              color="white"
              fontFamily="mono"
            />
          )}
          {error && <FormErrorMessage>{error}</FormErrorMessage>}
        </FormControl>
        <Button
          leftIcon={<AddIcon />}
          size="sm"
          variant="outline"
          colorScheme="blue"
          onClick={() => setIsDialogOpen(true)}
          alignSelf="flex-start"
        >
          Insert Placeholder
        </Button>
      </VStack>
      <InsertPlaceholderDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSelectTag={handleInsertPlaceholder}
        onCloseFocusRef={inputRef}
      />
    </>
  );
};
