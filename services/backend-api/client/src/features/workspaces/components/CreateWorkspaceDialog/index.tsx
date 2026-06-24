import { useEffect, useRef, useState } from "react";
import { Button, Input, InputGroup, Stack, Text, VisuallyHidden } from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { InferType, object, string } from "yup";
import { pages } from "@/constants";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { useUserMe } from "@/features/discordUser";
import { usePaddleContext } from "@/features/subscriptionProducts";
import { isReservedSlug, SLUG_PATTERN, slugifyPreview } from "@/utils/slugify";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { ApiErrorCode, getStandardErrorCodeMessage } from "@/utils/getStandardErrorCodeMessage";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { useCreateWorkspace } from "../../hooks";
import {
  VerifyEmailStep,
  VerifyEmailFooterHost,
  VerifyEmailFooterActions,
} from "../VerifyEmailStep";

const formSchema = object({
  name: string().required("Workspace name is required").max(100, "Workspace name is too long"),
  slug: string()
    .required("Workspace URL is required")
    .min(2, "Must be at least 2 characters")
    .max(50, "Must be 50 characters or fewer")
    .matches(SLUG_PATTERN, "Lowercase letters, numbers, and hyphens only (not at start or end)")
    .test("not-reserved", "This URL is reserved. Please choose another.", (value) =>
      value ? !isReservedSlug(value) : true,
    ),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Override where the user lands after the workspace is created. Defaults to
  // the new workspace's feeds page. The pricing dialog supplies one that routes
  // to billing carrying the capacity the user picked on the slider, so the count
  // shown on the CTA is not silently dropped.
  onCreated?: (workspaceSlug: string) => void;
}

const FORM_ID = "create-workspace-form";

const WORKSPACE_VALUE_EXPLAINER =
  "A workspace is a shared space where you and your team manage feeds together.";

// Short, honest billing line shown from the first screen so a "this is free"
// assumption can't form before the user invests any effort.
const WORKSPACE_BILLING_CAVEAT =
  "Creating one is free. Adding feeds needs a separate workspace plan.";

// Fuller reassurance shown once the user is committing (naming the workspace),
// where the "your personal feeds aren't affected" comfort matters most.
const WORKSPACE_BILLING_EXPLAINER =
  `${WORKSPACE_VALUE_EXPLAINER} Creating one is free. Your personal feeds stay free and aren't` +
  " affected. Adding feeds to a workspace needs a separate workspace plan.";

const VERIFY_EMAIL_INTRO =
  "Workspaces let you invite people by email, so first let's confirm yours.";

export const CreateWorkspaceDialog = ({ isOpen, onClose, onCreated }: Props) => {
  const navigate = useNavigate();
  const { data: userMe } = useUserMe();
  const verifiedEmail = userMe?.result.verifiedEmail;
  const discordEmail = userMe?.result.email;
  const { isConfigured: billingConfigured } = usePaddleContext();

  const { mutateAsync, error, reset } = useCreateWorkspace();
  const [slugTouched, setSlugTouched] = useState(false);
  const {
    handleSubmit,
    control,
    reset: resetForm,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: "onSubmit",
    defaultValues: { name: "", slug: "" },
  });

  const watchedName = watch("name");

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (isOpen) {
      resetForm({ name: "", slug: "" });
      setSlugTouched(false);
      reset();
      setAnnouncement("");
    }
  }, [isOpen]);

  // Without this, the verify step swapping out on success drops focus to the body.
  useEffect(() => {
    if (isOpen && verifiedEmail) {
      nameInputRef.current?.focus();
    }
  }, [isOpen, verifiedEmail]);

  // Auto-fill slug from name while the slug field is pristine.
  useEffect(() => {
    if (!slugTouched && watchedName) {
      setValue("slug", slugifyPreview(watchedName));
    }
  }, [watchedName, slugTouched]);

  const onSubmit = async ({ name, slug }: FormData) => {
    try {
      const { result } = await mutateAsync({ details: { name, slug } });
      onClose();

      if (onCreated) {
        onCreated(result.slug);
      } else {
        navigate(pages.userFeeds({ workspaceSlug: result.slug }));
      }
    } catch (err: unknown) {
      const apiError = err as ApiAdapterError;

      if (apiError?.errorCode === ApiErrorCode.WORKSPACE_SLUG_TAKEN) {
        setError("slug", { message: "This URL is already taken" });
      } else if (apiError?.errorCode === ApiErrorCode.WORKSPACE_SLUG_RESERVED) {
        setError("slug", { message: "This URL is reserved. Please choose another." });
      }
      // Other errors surfaced via `error` below; keep the dialog open on failure
    }
  };

  // Before verification, lead with the value one-liner plus a short billing caveat;
  // the fuller reassurance ("personal feeds aren't affected") is reserved for the
  // naming step, where the user is committing. With billing unconfigured (self-host),
  // no billing copy is shown at all.
  const resolveExplainer = () => {
    if (!billingConfigured) {
      return WORKSPACE_VALUE_EXPLAINER;
    }

    return verifiedEmail
      ? WORKSPACE_BILLING_EXPLAINER
      : `${WORKSPACE_VALUE_EXPLAINER} ${WORKSPACE_BILLING_CAVEAT}`;
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <DialogContent>
        <VerifyEmailFooterHost>
          <DialogHeader>
            <DialogTitle>Create a workspace</DialogTitle>
          </DialogHeader>
          <DialogCloseTrigger />
          <DialogBody>
            <Text color="fg.muted" mb={4}>
              {resolveExplainer()}
            </Text>
            {!verifiedEmail ? (
              <VerifyEmailStep
                defaultEmail={discordEmail}
                intro={VERIFY_EMAIL_INTRO}
                onVerified={() =>
                  setAnnouncement(
                    "Your email is verified. Enter a workspace name to create your workspace.",
                  )
                }
              />
            ) : (
              <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate>
                <Stack gap={4}>
                  <Field
                    label="Workspace name"
                    invalid={!!errors.name}
                    required
                    errorText={errors.name?.message}
                  >
                    <Controller
                      name="name"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          ref={(el) => {
                            field.ref(el);
                            nameInputRef.current = el;
                          }}
                        />
                      )}
                    />
                  </Field>
                  <Field
                    label="Workspace URL"
                    invalid={!!errors.slug}
                    required
                    errorText={errors.slug?.message}
                    helperText="Lowercase letters, numbers, and hyphens. Cannot be changed easily later."
                  >
                    <InputGroup startAddon="/workspaces/">
                      <Controller
                        name="slug"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            onFocus={() => setSlugTouched(true)}
                            placeholder="my-workspace"
                          />
                        )}
                      />
                    </InputGroup>
                  </Field>
                  {/* Slug-taken/reserved are already shown inline on the slug field,
                      so the generic alert covers only the remaining failures, using
                      the friendly mapped message rather than the raw server string. */}
                  {error &&
                    error.errorCode !== ApiErrorCode.WORKSPACE_SLUG_TAKEN &&
                    error.errorCode !== ApiErrorCode.WORKSPACE_SLUG_RESERVED && (
                      <InlineErrorAlert
                        title="Failed to create workspace"
                        description={
                          error.errorCode
                            ? getStandardErrorCodeMessage(error.errorCode as ApiErrorCode)
                            : error.message
                        }
                      />
                    )}
                </Stack>
              </form>
            )}
            <VisuallyHidden aria-live="polite">{announcement}</VisuallyHidden>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" mr={3} onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            {/* Before verification the verify step publishes its Send code / Verify
                button here; after it, the naming form's submit takes the slot. Both
                sit next to Cancel in the one real dialog footer. */}
            {verifiedEmail ? (
              <PrimaryActionButton
                type="submit"
                form={FORM_ID}
                loading={isSubmitting}
                loadingText="Creating..."
              >
                Create workspace
              </PrimaryActionButton>
            ) : (
              <VerifyEmailFooterActions />
            )}
          </DialogFooter>
        </VerifyEmailFooterHost>
      </DialogContent>
    </DialogRoot>
  );
};
