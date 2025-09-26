import React, { ReactNode } from "react";
import {
  VStack,
  Textarea,
  Input,
  Button,
  FormControl,
  FormLabel,
  FormErrorMessage,
  FormHelperText,
} from "@chakra-ui/react";
import { AddIcon } from "@chakra-ui/icons";
import { InsertPlaceholderDialog } from "../../pages/Previewer/InsertPlaceholderDialog";

interface Props {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  error?: string;
  helperText?: ReactNode;
  rows?: number;
  isInvalid?: boolean;
  as?: "input" | "textarea";
  isRequired?: boolean;
}

export const InputWithInsertPlaceholder: React.FC<Props> = ({
  value,
  onChange,
  label,
  placeholder = "Enter text content",
  error,
  helperText,
  rows = 4,
  isInvalid = false,
  as = "textarea",
  isRequired,
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
        <FormControl isInvalid={isInvalid} isRequired={isRequired}>
          <FormLabel fontSize="sm" fontWeight="medium" color="gray.200">
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
          <Button
            mt={2}
            leftIcon={<AddIcon />}
            size="sm"
            variant="outline"
            colorScheme="blue"
            onClick={() => setIsDialogOpen(true)}
            alignSelf="flex-start"
          >
            Insert Placeholder
          </Button>
          {helperText && (
            <FormHelperText fontSize="sm" color="gray.400">
              {helperText}
            </FormHelperText>
          )}
          {error && <FormErrorMessage>{error}</FormErrorMessage>}
        </FormControl>
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
