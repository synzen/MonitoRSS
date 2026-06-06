import React, { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { VStack, Textarea, Input, Button, HStack } from "@chakra-ui/react";
import { FaPlus, FaAt } from "react-icons/fa6";
import { Field } from "@/components/ui/field";
import { InsertPlaceholderDialog } from "../../InsertPlaceholderDialog";
import { InsertMentionDialog } from "../../InsertMentionDialog";

interface Props {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  error?: string;
  helperText?: ReactNode;
  rows?: number;
  invalid?: boolean;
  as?: "input" | "textarea";
  required?: boolean;
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
  invalid = false,
  as = "textarea",
  required,
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

  const handleBlur = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      flush(localValueRef.current);
    }
  }, [flush]);

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
      <VStack align="stretch" gap={2}>
        <Field
          invalid={invalid}
          required={required}
          label={
            <span
              style={{
                fontSize: "0.875rem",
                fontWeight: "medium",
                color: "var(--chakra-colors-gray-200)",
              }}
            >
              {label}
            </span>
          }
          helperText={
            helperText ? (
              <span style={{ fontSize: "0.875rem", color: "var(--chakra-colors-gray-400)" }}>
                {helperText}
              </span>
            ) : undefined
          }
          errorText={error}
        >
          {as === "textarea" ? (
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={localValue}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder={placeholder}
              rows={rows}
              color="white"
              fontFamily="mono"
            />
          ) : (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              value={localValue}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder={placeholder}
              color="white"
              fontFamily="mono"
            />
          )}
          <HStack mt={2} gap={2}>
            <Button
              size="sm"
              onClick={() => setIsDialogOpen(true)}
              aria-label={`Insert placeholder into ${label}`}
            >
              <FaPlus />
              Insert Placeholder
            </Button>
            {guildId && (
              <Button
                size="sm"
                onClick={() => setIsMentionDialogOpen(true)}
                aria-label={`Insert mention into ${label}`}
              >
                <FaAt />
                Insert Mention
              </Button>
            )}
          </HStack>
        </Field>
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
