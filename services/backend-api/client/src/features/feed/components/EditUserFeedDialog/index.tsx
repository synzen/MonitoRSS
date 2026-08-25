import { Alert, Box, Button, HStack, Icon, Input, Link, Stack, Text } from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { array, InferType, object, string } from "yup";
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
import { useFeedScope } from "../../contexts/FeedScopeContext";
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
import { WorkspaceTagSelector, type WorkspaceTag } from "@/features/workspaceTags";

const formSchema = object({
  title: string().optional(),
  url: string().optional(),
  tagIds: array(string().required()).optional(),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  onUpdate: (data: FormData) => Promise<void>;
  defaultValues: { title: string; url: string; tags?: WorkspaceTag[] };
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
    defaultValues: {
      title: defaultValues.title,
      url: defaultValues.url,
      tagIds: defaultValues.tags?.map((tag) => tag.id),
    },
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
  const isRedditConnectionRequired = error?.errorCode === ApiErrorCode.REDDIT_CONNECTION_REQUIRED;
  const showCta = canResolveError || isRedditConnectionRequired;
  const feedScope = useFeedScope();

  // Set while the post-connect Reddit retry is driving the save. A subreddit URL
  // resolves during validation, which normally pauses on a confirm step; but the
  // user already committed to saving by connecting, so the retry carries straight
  // through the resolution instead of stranding the dialog on confirm.
  const isAutoRetryingRef = useRef(false);

  // A Reddit gate is pending a connect-driven retry. Tracked in a ref (not read
  // live in the connect effect) because connecting can clear the gate error a
  // render before the connected-edge fires, which would otherwise drop the retry.
  const redditGatePendingRef = useRef(false);

  if (isRedditConnectionRequired) {
    redditGatePendingRef.current = true;
  }

  const onSubmit = async ({ title, url, tagIds }: FormData) => {
    if (!isDirty) {
      onClose();

      return;
    }

    // The post-connect Reddit retry saves directly: the user already committed by
    // connecting, and the server resolves the URL and re-checks the (now satisfied)
    // gate itself, so the dialog's own validate -> confirm -> save pre-flight would
    // only re-prompt and risks stranding the dialog on the confirm step.
    const skipPreValidation = isAutoRetryingRef.current;

    try {
      if (url && !feedUrlValidationData && !skipPreValidation) {
        const { result } = await createUserFeedUrlValidation({
          details: { url },
        });

        if (result.resolvedToUrl) {
          return;
        }
      }

      const useUrl = feedUrlValidationData?.result.resolvedToUrl || url;
      await onUpdate({
        title,
        url: useUrl,
        ...(feedScope.workspaceId ? { tagIds } : {}),
      });
      onClose();
      reset({ title, url: useUrl, tagIds });
    } catch {
      // Surfaced to the user via the `error` prop; keep the dialog open on failure
    } finally {
      isAutoRetryingRef.current = false;
    }
  };

  // Re-run the blocked save once Reddit connects. The connect button lives inside
  // FixFeedRequestsCTA, which unmounts the instant the account becomes active - so the retry can't
  // be driven from its onConnected callback (it would race its own unmount). This dialog survives the
  // transition, so it owns the retry: on the not-connected -> connected edge while a Reddit gate is
  // showing, re-submit the form. In workspace scope the watched connection is the workspace's.
  const { data: userMe } = useUserMe();
  const hasRedditConnected = feedScope.workspaceId
    ? feedScope.redditConnection?.status === "ACTIVE"
    : userMe?.result.externalAccounts?.find((e) => e.type === "reddit")?.status === "ACTIVE";
  const prevHasRedditConnectedRef = useRef(hasRedditConnected);

  useEffect(() => {
    const justConnected = hasRedditConnected && !prevHasRedditConnectedRef.current;
    prevHasRedditConnectedRef.current = hasRedditConnected;

    if (justConnected && redditGatePendingRef.current) {
      redditGatePendingRef.current = false;
      isAutoRetryingRef.current = true;
      handleSubmit(onSubmit)();
    }
  }, [hasRedditConnected]);

  useEffect(() => {
    reset({
      title: defaultValues.title,
      url: defaultValues.url,
      tagIds: defaultValues.tags?.map((tag) => tag.id),
    });
    resetValidationMutation();
    redditGatePendingRef.current = false;
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
                  errorText={
                    errors.title?.message ? (
                      <Text fontSize="sm">{errors.title.message}</Text>
                    ) : undefined
                  }
                  helperText={
                    <Text fontSize="sm">
                      {t("features.feed.components.addFeedDialog.formTitleDescription")}
                    </Text>
                  }
                >
                  <Controller
                    name="title"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} size="lg" tabIndex={0} ref={initialFocusRef} />
                    )}
                  />
                </Field>
                <Field
                  invalid={!!errors.url}
                  required
                  label="RSS Feed Link"
                  errorText={
                    errors.url?.message ? (
                      <Text fontSize="sm">{errors.url.message}</Text>
                    ) : undefined
                  }
                  helperText={
                    <Text fontSize="sm">
                      {t("features.feed.components.addFeedDialog.formLinkDescription")}
                    </Text>
                  }
                >
                  <Controller
                    name="url"
                    control={control}
                    render={({ field }) => <Input type="url" {...field} size="lg" tabIndex={0} />}
                  />
                </Field>
                {feedScope.workspaceSlug && (
                  <Controller
                    name="tagIds"
                    control={control}
                    render={({ field }) => (
                      <WorkspaceTagSelector
                        workspaceSlug={feedScope.workspaceSlug as string}
                        selectedTagIds={field.value ?? []}
                        selectedTags={defaultValues.tags}
                        onChange={field.onChange}
                      />
                    )}
                  />
                )}
              </Stack>
            )}
            {error && !showCta && (
              <InlineErrorAlert
                title={t("common.errors.failedToSave")}
                description={error.message}
              />
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
            <span>{isLoading ? "Saving..." : t("common.buttons.saveChanges")}</span>
          </PrimaryActionButton>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
