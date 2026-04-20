import React, { ReactNode, useCallback, useEffect, useRef, useState } from "react";
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

const DEBOUNCE_MS = 200;

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMentionDialogOpen, setIsMentionDialogOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Local state buffers keystrokes so the parent form (Yup validation, watch
  // subscribers, full tree re-render) only runs after the user pauses typing.
  const [localValue, setLocalValue] = useState(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const pendingValueRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from parent when it changes externally (selection change, placeholder insert,
  // programmatic reset). Ignore when the incoming value matches what we just flushed.
  useEffect(() => {
    if (pendingValueRef.current !== null && pendingValueRef.current === value) {
      pendingValueRef.current = null;

      return;
    }

    setLocalValue(value);
  }, [value]);

  const flush = useCallback((next: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    pendingValueRef.current = next;
    onChangeRef.current(next);
  }, []);

  const scheduleFlush = useCallback(
    (next: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        flush(next);
      }, DEBOUNCE_MS);
    },
    [flush],
  );

  // Flush any pending edit on unmount so switching components doesn't lose it.
  const localValueRef = useRef(localValue);
  localValueRef.current = localValue;
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        onChangeRef.current(localValueRef.current);
      }
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = e.target.value;
      setLocalValue(next);
      scheduleFlush(next);
    },
    [scheduleFlush],
  );

  const handleInsertPlaceholder = useCallback(
    (tag: string) => {
      if (!inputRef.current) {
        return;
      }

      const input = inputRef.current;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const currentValue = input.value;

      let nextValue: string;
      let nextCaret: number;

      if (!start && !end) {
        nextValue = currentValue + tag;
        nextCaret = nextValue.length;
      } else {
        nextValue = currentValue.substring(0, start) + tag + currentValue.substring(end);
        nextCaret = start + tag.length;
      }

      setLocalValue(nextValue);
      flush(nextValue);
      input.setSelectionRange(nextCaret, nextCaret);
    },
    [flush],
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
              value={localValue}
              onChange={handleChange}
              placeholder={placeholder}
              rows={rows}
              bg="gray.700"
              color="white"
              fontFamily="mono"
            />
          ) : (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              value={localValue}
              onChange={handleChange}
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
