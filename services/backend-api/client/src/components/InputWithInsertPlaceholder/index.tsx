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
  HStack,
} from "@chakra-ui/react";
import { AddIcon, AtSignIcon } from "@chakra-ui/icons";
import { InsertPlaceholderDialog } from "../../pages/MessageBuilder/InsertPlaceholderDialog";
import { InsertMentionDialog } from "../../pages/MessageBuilder/InsertMentionDialog";

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
  guildId?: string;
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
  guildId,
}) => {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isMentionDialogOpen, setIsMentionDialogOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const handleInsertPlaceholder = React.useCallback(
    (tag: string) => {
      if (inputRef.current) {
        const input = inputRef.current;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;

        const currentValue = input.value;

        if (!start && !end) {
          const newValue = currentValue + tag;
          onChange(newValue);

          input.setSelectionRange(newValue.length, newValue.length);
        } else {
          const newValue = currentValue.substring(0, start) + tag + currentValue.substring(end);

          onChange(newValue);
          input.setSelectionRange(start + tag.length, start + tag.length);
        }
      }
    },
    [onChange],
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
          <HStack mt={2} spacing={2}>
            <Button
              leftIcon={<AddIcon />}
              size="sm"
              variant="outline"
              colorScheme="blue"
              onClick={() => setIsDialogOpen(true)}
              aria-label={`Insert placeholder into ${label}`}
            >
              Insert Placeholder
            </Button>
            {guildId && (
              <Button
                leftIcon={<AtSignIcon />}
                size="sm"
                variant="outline"
                colorScheme="blue"
                onClick={() => setIsMentionDialogOpen(true)}
                aria-label={`Insert mention into ${label}`}
              >
                Insert Mention
              </Button>
            )}
          </HStack>
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
        onSelected={handleInsertPlaceholder}
        onCloseFocusRef={inputRef}
      />
      {guildId && (
        <InsertMentionDialog
          isOpen={isMentionDialogOpen}
          onClose={() => setIsMentionDialogOpen(false)}
          onSelected={(mention) => handleInsertPlaceholder(mention.text)}
          onCloseFocusRef={inputRef}
          guildId={guildId}
        />
      )}
    </>
  );
};
