import { Box, Button, HStack, Stack, useDisclosure } from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { cloneElement, useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { InferType, number, object, string } from "yup";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { ArticlePropertySelect } from "../ArticlePropertySelect";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";
import { useUserFeedConnectionContext } from "@/features/feed";
import { InlineErrorIncompleteFormAlert } from "@/components";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { NumberInputRoot, NumberInputField } from "@/components/ui/number-input";

const formDataSchema = object({
  placeholder: string()
    .min(1, "This is a required field")
    .required("This is a required field")
    .default(""),
  characterCount: number().positive().integer().min(1).required("This is a required field"),
  appendString: string().optional().default(""),
});

type FormData = InferType<typeof formDataSchema>;

interface Props {
  trigger: React.ReactElement;
  defaultValues?: FormData;
  onSubmit: (data: FormData) => void;
  mode: "add" | "update";
}

export const PlaceholderLimitDialog = ({
  trigger,
  defaultValues,
  mode,
  onSubmit: parentOnSubmit,
}: Props) => {
  const { articleFormatOptions } = useUserFeedConnectionContext();
  const {
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting, errors, isSubmitted },
  } = useForm<FormData>({
    resolver: yupResolver(formDataSchema),
    defaultValues,
  });
  const { open, onOpen, onClose } = useDisclosure();
  const { t } = useTranslation();

  useEffect(() => {
    reset(defaultValues);
  }, [open, reset, defaultValues]);

  const onSubmit = async (data: FormData) => {
    parentOnSubmit(data);
    onClose();
  };

  let useTitle: string;

  if (mode === "update") {
    useTitle = t("features.feedConnections.components.placeholderLimitDialog.updateTitle");
  } else {
    useTitle = t("features.feedConnections.components.placeholderLimitDialog.addTitle");
  }

  const initialRef = useRef<any>(null);
  const errorLength = Object.keys(errors).length;

  return (
    <>
      {cloneElement(trigger, {
        onClick: () => {
          onOpen();
        },
      })}
      <DialogRoot
        open={open}
        onOpenChange={(e) => {
          if (!e.open) {
            onClose();
          }
        }}
        initialFocusEl={() => initialRef.current}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{useTitle}</DialogTitle>
          </DialogHeader>
          <DialogCloseTrigger />
          <DialogBody>
            <form
              onSubmit={(e) => {
                e.stopPropagation();

                return handleSubmit(onSubmit)(e);
              }}
              id="placeholder-limit"
            >
              <Stack gap="4">
                <Controller
                  name="placeholder"
                  control={control}
                  render={({ field }) => {
                    return (
                      <Field
                        invalid={!!errors.placeholder}
                        required
                        errorText={errors.placeholder?.message}
                        helperText={
                          !errors.placeholder
                            ? t(
                                "features.feedConnections.components.placeholderLimitDialog.placeholderInputDescription",
                              )
                            : undefined
                        }
                      >
                        <label id="placeholder-label" htmlFor="placeholder-select">
                          {t(
                            "features.feedConnections.components.placeholderLimitDialog.placeholderInputLabel",
                          )}
                        </label>
                        <ArticlePropertySelect
                          inputId="placeholder-select"
                          ariaLabelledBy="placeholder-label"
                          isInvalid={!!errors.placeholder}
                          onChange={(val) => {
                            field.onChange(val);
                          }}
                          customPlaceholders={articleFormatOptions.customPlaceholders || []}
                          value={field.value}
                          selectRef={initialRef}
                        />
                      </Field>
                    );
                  }}
                />
                <Controller
                  name="characterCount"
                  control={control}
                  render={({ field }) => {
                    return (
                      <Field
                        invalid={!!errors.characterCount}
                        required
                        label={t(
                          "features.feedConnections.components.placeholderLimitDialog.limitInputLabel",
                        )}
                        errorText={errors.characterCount?.message}
                        helperText={
                          !errors.characterCount
                            ? t(
                                "features.feedConnections.components.placeholderLimitDialog.limitInputDescription",
                              )
                            : undefined
                        }
                      >
                        <NumberInputRoot
                          inputMode="numeric"
                          min={1}
                          name={field.name}
                          value={field.value != null ? String(field.value) : ""}
                          onValueChange={(details) => field.onChange(details.valueAsNumber)}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          borderRadius="l3"
                        >
                          <NumberInputField />
                        </NumberInputRoot>
                      </Field>
                    );
                  }}
                />
                <Controller
                  name="appendString"
                  control={control}
                  render={({ field }) => {
                    return (
                      <Field
                        invalid={!!errors.appendString}
                        label={t(
                          "features.feedConnections.components.placeholderLimitDialog.appendTextInputLabel",
                        )}
                        helperText={t(
                          "features.feedConnections.components.placeholderLimitDialog.appendTextInputDescription",
                        )}
                        errorText={errors.characterCount?.message}
                      >
                        <AutoResizeTextarea {...field} />
                      </Field>
                    );
                  }}
                />
              </Stack>
            </form>
            {isSubmitted && errorLength && (
              <Box mt="4">
                <InlineErrorIncompleteFormAlert fieldCount={errorLength} />
              </Box>
            )}
          </DialogBody>
          <DialogFooter>
            <HStack>
              <Button variant="ghost" onClick={onClose}>
                {t("common.buttons.cancel")}
              </Button>
              <PrimaryActionButton
                aria-disabled={isSubmitting}
                type="submit"
                form="placeholder-limit"
              >
                {t("common.buttons.save")}
              </PrimaryActionButton>
            </HStack>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </>
  );
};
