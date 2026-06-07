import { useEffect, useRef, useState } from "react";
import { Button, Input, InputGroup, Stack, VisuallyHidden } from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { InferType, object, string } from "yup";
import { pages } from "@/constants";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { useUserMe } from "@/features/discordUser";
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
import { VerifyEmailStep } from "../VerifyEmailStep";

const formSchema = object({
  name: string().required("Team name is required").max(100, "Team name is too long"),
  slug: string()
    .required("Team URL is required")
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
}

const FORM_ID = "create-workspace-form";

export const CreateWorkspaceDialog = ({ isOpen, onClose }: Props) => {
  const navigate = useNavigate();
  const { data: userMe } = useUserMe();
  const verifiedEmail = userMe?.result.verifiedEmail;
  const discordEmail = userMe?.result.email;

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
      navigate(pages.userFeeds({ workspaceSlug: result.slug }));
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

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a team</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          {!verifiedEmail ? (
            <VerifyEmailStep
              defaultEmail={discordEmail}
              onVerified={() =>
                setAnnouncement("Your email is verified. Enter a team name to create your team.")
              }
            />
          ) : (
            <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate>
              <Stack gap={4}>
                <Field
                  label="Team name"
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
                  label="Team URL"
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
                          placeholder="my-team"
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
                      title="Failed to create team"
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
          {verifiedEmail && (
            <PrimaryActionButton
              type="submit"
              form={FORM_ID}
              loading={isSubmitting}
              loadingText="Creating..."
            >
              Create team
            </PrimaryActionButton>
          )}
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
