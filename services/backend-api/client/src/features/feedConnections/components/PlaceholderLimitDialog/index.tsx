import {
  Button,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberInput,
  NumberInputField,
  Stack,
  useDisclosure,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { cloneElement, useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { InferType, number, object, string } from "yup";
import { ArticlePropertySelect } from "../ArticlePropertySelect";
import { AutoResizeTextarea } from "../../../../components/AutoResizeTextarea";

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
  feedId: string;
  excludePlaceholders?: string[];
}

export const PlaceholderLimitDialog = ({
  trigger,
  defaultValues,
  mode,
  onSubmit: parentOnSubmit,
  feedId,
  excludePlaceholders,
}: Props) => {
  const {
    handleSubmit,
    control,
    reset,
    formState: { isDirty, isSubmitting, errors },
  } = useForm<FormData>({
    resolver: yupResolver(formDataSchema),
    defaultValues,
  });
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { t } = useTranslation();

  useEffect(() => {
    reset(defaultValues);
  }, [isOpen, reset, defaultValues]);

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

  const initialRef = useRef<HTMLSelectElement>(null);

  return (
    <>
      {cloneElement(trigger, {
        onClick: () => {
          onOpen();
        },
      })}
      <Modal isOpen={isOpen} onClose={onClose} initialFocusRef={initialRef}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{useTitle}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <form
              onSubmit={(e) => {
                e.stopPropagation();

                return handleSubmit(onSubmit)(e);
              }}
              id="placeholder-limit"
            >
              <Stack spacing="4">
                <Controller
                  name="placeholder"
                  control={control}
                  render={({ field }) => {
                    return (
                      <FormControl isInvalid={!!errors.placeholder}>
                        <FormLabel>
                          {t(
                            "features.feedConnections.components.placeholderLimitDialog.placeholderInputLabel"
                          )}
                        </FormLabel>
                        <ArticlePropertySelect
                          feedId={feedId}
                          selectProps={{ ...field, bg: "gray.800" }}
                          selectRef={initialRef}
                          excludeProperties={excludePlaceholders}
                        />
                        {!errors.placeholder && (
                          <FormHelperText>
                            {t(
                              "features.feedConnections.components.placeholderLimitDialog.placeholderInputDescription"
                            )}
                          </FormHelperText>
                        )}
                        {errors.placeholder && (
                          <FormErrorMessage>{errors.placeholder.message}</FormErrorMessage>
                        )}
                      </FormControl>
                    );
                  }}
                />
                <Controller
                  name="characterCount"
                  control={control}
                  render={({ field }) => {
                    return (
                      <FormControl isInvalid={!!errors.characterCount}>
                        <FormLabel>
                          {t(
                            "features.feedConnections.components.placeholderLimitDialog.limitInputLabel"
                          )}
                        </FormLabel>
                        <NumberInput
                          inputMode="numeric"
                          isInvalid={!!errors.characterCount}
                          min={1}
                          isValidCharacter={(char) => /\d+/.test(char)}
                          bg="gray.800"
                          {...field}
                          borderRadius="md"
                        >
                          <NumberInputField />
                        </NumberInput>
                        {!errors.characterCount && (
                          <FormHelperText>
                            {t(
                              "features.feedConnections.components.placeholderLimitDialog.limitInputDescription"
                            )}
                          </FormHelperText>
                        )}
                        {errors.characterCount && (
                          <FormErrorMessage>{errors.characterCount.message}</FormErrorMessage>
                        )}
                      </FormControl>
                    );
                  }}
                />
                <Controller
                  name="appendString"
                  control={control}
                  render={({ field }) => {
                    return (
                      <FormControl isInvalid={!!errors.appendString}>
                        <FormLabel>
                          {t(
                            "features.feedConnections.components.placeholderLimitDialog.appendTextInputLabel"
                          )}
                        </FormLabel>
                        <AutoResizeTextarea {...field} bg="gray.800" />
                        <FormHelperText>
                          {t(
                            "features.feedConnections.components.placeholderLimitDialog.appendTextInputDescription"
                          )}
                        </FormHelperText>
                        {errors.characterCount && (
                          <FormErrorMessage>{errors.characterCount.message}</FormErrorMessage>
                        )}
                      </FormControl>
                    );
                  }}
                />
              </Stack>
            </form>
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="ghost" onClick={onClose}>
                {t("common.buttons.cancel")}
              </Button>
              <Button
                isDisabled={!isDirty || isSubmitting}
                colorScheme="blue"
                type="submit"
                form="placeholder-limit"
              >
                {t("common.buttons.save")}
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
