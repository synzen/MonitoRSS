import {
  Button,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  useDisclosure,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { cloneElement, useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { array, InferType, object, string } from "yup";
import { useTranslation } from "react-i18next";
import { useCreateDiscordChannelConnectionClone } from "../../hooks";
import { FeedConnectionType } from "../../../../types";
import { InlineErrorAlert, InlineErrorIncompleteFormAlert } from "../../../../components";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";
import { SelectableUserFeedList } from "../../../feed/components/CopyUserFeedSettingsDialog/SelectableUserFeedList";

const formSchema = object({
  name: string().required("Name is required").max(250, "Name must be fewer than 250 characters"),
  targetFeedIds: array(string().required())
    .min(1, "At least one target feed is required to copy the connection to")
    .required(),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  feedId: string;
  connectionId: string;
  type: FeedConnectionType;
  defaultValues: {
    name: string;
    targetFeedIds: string[];
  };
  trigger: React.ReactElement;
}

export const CloneDiscordConnectionCloneDialog = ({
  feedId,
  connectionId,
  type,
  defaultValues,
  trigger,
}: Props) => {
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    defaultValues,
  });
  const { isOpen, onOpen, onClose } = useDisclosure();
  const initialRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: createChannelClone, error } = useCreateDiscordChannelConnectionClone();
  const { t } = useTranslation();
  const { createSuccessAlert } = usePageAlertContext();

  useEffect(() => {
    reset(defaultValues);
  }, [isOpen]);

  const onSubmit = async ({ name, targetFeedIds }: FormData) => {
    try {
      if (isSubmitting) {
        return;
      }

      if (type === FeedConnectionType.DiscordChannel) {
        await createChannelClone({
          feedId,
          connectionId,
          details: { name, targetFeedIds },
        });
      } else {
        throw new Error(`Unsupported connection type when cloning discord connection: ${type}`);
      }

      createSuccessAlert({
        title: `Successfully created cloned connection: ${name}`,
      });

      onClose();
      reset({ name });
    } catch (err) {}
  };

  const formErrorCount = Object.keys(errors).length;

  return (
    <>
      {cloneElement(trigger, { onClick: onOpen })}
      <Modal isOpen={isOpen} onClose={onClose} initialFocusRef={initialRef} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Clone connection</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <form id="clonefeed" onSubmit={handleSubmit(onSubmit)}>
                <Stack spacing={4}>
                  <FormControl isInvalid={!!errors.name} isRequired>
                    <FormLabel>Name</FormLabel>
                    <Controller
                      name="name"
                      control={control}
                      render={({ field }) => <Input {...field} ref={initialRef} bg="gray.800" />}
                    />
                    {errors.name && <FormErrorMessage>{errors.name.message}</FormErrorMessage>}
                    <FormHelperText>The name for the newly-cloned connection.</FormHelperText>
                  </FormControl>
                  <FormControl isInvalid={!!errors.targetFeedIds} isRequired>
                    <FormLabel>Target feeds</FormLabel>
                    <Controller
                      name="targetFeedIds"
                      control={control}
                      render={({ field }) => (
                        <SelectableUserFeedList
                          selectedIds={field.value || []}
                          onSelectedIdsChange={(ids) => field.onChange(ids)}
                        />
                      )}
                    />
                    {errors.targetFeedIds && (
                      <FormErrorMessage>{errors.targetFeedIds.message}</FormErrorMessage>
                    )}
                    <FormHelperText>
                      Select the feeds you want to copy this connection to. You can select multiple
                      feeds.
                    </FormHelperText>
                  </FormControl>
                </Stack>
              </form>
              {error && (
                <InlineErrorAlert
                  title={t("common.errors.somethingWentWrong")}
                  description={error.message}
                />
              )}
              {isSubmitted && formErrorCount > 0 && (
                <InlineErrorIncompleteFormAlert fieldCount={formErrorCount} />
              )}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                onClick={() => {
                  if (isSubmitting) {
                    return;
                  }

                  handleSubmit(onSubmit)();
                }}
                form="clonefeed"
                aria-disabled={isSubmitting}
              >
                <span>{!isSubmitting && "Clone"}</span>
                <span>{isSubmitting && "Cloning..."}</span>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
