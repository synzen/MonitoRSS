import { Alert, Box, Button, HStack, Icon, Input, Link, Stack, Text } from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { InferType, object, string } from "yup";
import React, { useEffect, useRef } from "react";
import { FaUpRightFromSquare } from "react-icons/fa6";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import {
  InlineErrorAlert,
  InlineErrorIncompleteFormAlert,
} from "../../../../components/InlineErrorAlert";
import { useCreateUserFeedUrlValidation } from "../../hooks/useCreateUserFeedUrlValidation";
import { FixFeedRequestsCTA } from "../FixFeedRequestsCTA";
import { ApiErrorCode } from "../../../../utils/getStandardErrorCodeMessage";
import type ApiAdapterError from "@/utils/ApiAdapterError";
import { useUserMe } from "../../../discordUser";
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

const formSchema = object({
  title: string().optional(),
  url: string().optional(),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  onUpdate: (data: FormData) => Promise<void>;
  defaultValues: Required<FormData>;
  onCloseRef?: React.RefObject<HTMLButtonElement>;
  isOpen: boolean;
  onClose: () => void;
  error?: ApiAdapterError | null;
}

const RESOLVABLE_ERRORS: string[] = [
  ApiErrorCode.FEED_REQUEST_FORBIDDEN,
  ApiErrorCode.FEED_REQUEST_TOO_MANY_REQUESTS,
];

export const EditUserFeedDialog: React.FC<Props> = ({
  onUpdate,
  defaultValues,
  onCloseRef,
  onClose,
  isOpen,
  error: updateError,
}) => {
  const { t } = useTranslation();
  const initialFocusRef = useRef<HTMLInputElement>(null);
  const {
    handleSubmit,
    control,
    reset,
    formState: { isDirty, errors, isSubmitting, isSubmitted },
    watch,
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: "all",
    defaultValues,
  });
  const [urlFromForm] = watch(["url"]);
  const {
    data: feedUrlValidationData,
    mutateAsync: createUserFeedUrlValidation,
    error: validationError,
    reset: resetValidationMutation,
    status: validationStatus,
  } = useCreateUserFeedUrlValidation();
  const error = updateError || validationError;
  const isConfirming = !!feedUrlValidationData?.result.resolvedToUrl;
  const isLoading = isSubmitting || validationStatus === "loading";
  const canResolveError = !!error?.errorCode && RESOLVABLE_ERRORS.includes(error.errorCode);
  const isRedditConnectionRequired =
    error?.errorCode === ApiErrorCode.REDDIT_CONNECTION_REQUIRED;
  const showCta = canResolveError || isRedditConnectionRequired;

  const onSubmit = async ({ title, url }: FormData) => {
    if (!isDirty) {
      onClose();

      return;
    }

    try {
      if (url && !feedUrlValidationData) {
        const { result } = await createUserFeedUrlValidation({ details: { url } });

        if (result.resolvedToUrl) {
          return;
        }
      }

      const useUrl = feedUrlValidationData?.result.resolvedToUrl || url;
      await onUpdate({ title, url: useUrl });
      onClose();
      reset({ title, url: useUrl });
    } catch {
      // Surfaced to the user via the `error` prop; keep the dialog open on failure
    }
  };

  // Re-run the blocked save once Reddit connects. The connect button lives inside
  // FixFeedRequestsCTA, which unmounts the instant the account becomes active - so the retry can't
  // be driven from its onConnected callback (it would race its own unmount). This dialog survives the
  // transition, so it owns the retry: on the not-connected -> connected edge while a Reddit gate is
  // showing, re-submit the form.
  const { data: userMe } = useUserMe();
  const hasRedditConnected =
    userMe?.result.externalAccounts?.find((e) => e.type === "reddit")?.status === "ACTIVE";
  const prevHasRedditConnectedRef = useRef(hasRedditConnected);

  useEffect(() => {
    const justConnected = hasRedditConnected && !prevHasRedditConnectedRef.current;
    prevHasRedditConnectedRef.current = hasRedditConnected;

    if (justConnected && showCta) {
      handleSubmit(onSubmit)();
    }
  }, [hasRedditConnected]);

  useEffect(() => {
    reset(defaultValues);
    resetValidationMutation();
  }, [isOpen]);

  const formErrorCount = Object.keys(errors).length;

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) {
          onClose();
        }
      }}
      initialFocusEl={() => initialFocusRef.current}
      finalFocusEl={() => onCloseRef?.current ?? null}
    >
      <DialogContent>
        <DialogHeader marginRight={4}>
          <DialogTitle>
            {isConfirming
              ? "Confirm feed link change"
              : t("features.feed.components.updateUserFeedDialog.title")}
          </DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <Stack gap={4}>
            {isConfirming && (
              <Stack gap={4} role="alert">
                <Alert.Root status="warning" role={undefined}>
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>
                      The url you put in did not directly point to a valid feed.
                    </Alert.Title>
                  </Alert.Content>
                </Alert.Root>
                <Stack gap={4} aria-live="polite">
                  <Box>
                    <Text display="inline">We found </Text>
                    <Link
                      display="inline"
                      color="text.link"
                      href={feedUrlValidationData.result.resolvedToUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <HStack alignItems="center" display="inline">
                        <Text wordBreak="break-all" display="inline">
                          {feedUrlValidationData.result.resolvedToUrl}
                        </Text>
                        <Icon as={FaUpRightFromSquare} ml={1} />
                      </HStack>
                    </Link>{" "}
                    <Text display="inline">
                      instead that might be related to the url you provided. Do you want to use this
                      feed link instead?
                    </Text>
                  </Box>
                  <span
                    style={{
                      fontWeight: 600,
                    }}
                  >
                    <Text display="inline">Your original link </Text>
                    <Link
                      display="inline"
                      color="text.link"
                      href={urlFromForm || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      wordBreak="break-all"
                    >
                      {urlFromForm}
                    </Link>
                    <Text display="inline"> will not be used.</Text>
                  </span>
                </Stack>
              </Stack>
            )}
            {!isConfirming && (
              <Stack gap={4}>
                <Field
                  invalid={!!errors.title}
                  required
                  label={t("features.feed.components.addFeedDialog.formTitleLabel")}
                  errorText={errors.title?.message}
                  helperText={t("features.feed.components.addFeedDialog.formTitleDescription")}
                >
                  <Controller
                    name="title"
                    control={control}
                    render={({ field }) => <Input {...field} tabIndex={0} ref={initialFocusRef} />}
                  />
                </Field>
                <Field
                  invalid={!!errors.url}
                  required
                  label="RSS Feed Link"
                  errorText={errors.url?.message}
                  helperText={t("features.feed.components.addFeedDialog.formLinkDescription")}
                >
                  <Controller
                    name="url"
                    control={control}
                    render={({ field }) => <Input type="url" {...field} tabIndex={0} />}
                  />
                </Field>
              </Stack>
            )}
            {error && !showCta && (
              <InlineErrorAlert title={t("common.errors.failedToSave")} description={error.message} />
            )}
            {showCta && (
              <FixFeedRequestsCTA
                url={urlFromForm || ""}
                variant={isRedditConnectionRequired ? "required" : "rate-limited"}
              />
            )}
            {isSubmitted && formErrorCount > 0 && (
              <InlineErrorIncompleteFormAlert fieldCount={formErrorCount} />
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            <span>{t("common.buttons.cancel")}</span>
          </Button>
          <PrimaryActionButton
            aria-disabled={isLoading}
            onClick={() => {
              if (isLoading) {
                return;
              }

              handleSubmit(onSubmit)();
            }}
          >
            <span>{isLoading ? "Saving..." : t("common.buttons.save")}</span>
          </PrimaryActionButton>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
