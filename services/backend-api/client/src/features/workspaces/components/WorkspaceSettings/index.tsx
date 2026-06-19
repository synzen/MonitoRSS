import { useEffect, useState } from "react";
import { Box, Button, Input, InputGroup, Stack, StackSeparator } from "@chakra-ui/react";
import { FaChevronRight } from "react-icons/fa6";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { InferType, object, string } from "yup";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { ConfirmModal, SettingsSection } from "@/components";
import { usePageAlertContext } from "@/contexts/PageAlertContext";
import { pages } from "@/constants";
import { isReservedSlug, SLUG_PATTERN } from "@/utils/slugify";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { ApiErrorCode, getStandardErrorCodeMessage } from "@/utils/getStandardErrorCodeMessage";
import { Field } from "@/components/ui/field";
import { usePaddleContext } from "@/features/subscriptionProducts";
import { useCurrentWorkspace } from "../../contexts";
import { useUpdateWorkspace } from "../../hooks";
import { WorkspaceRedditConnectionSetting } from "../WorkspaceRedditConnectionSetting";

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

export const WorkspaceSettings = () => {
  const workspace = useCurrentWorkspace();
  const { isConfigured: isPaddleConfigured } = usePaddleContext();
  const navigate = useNavigate();
  const { createSuccessAlert } = usePageAlertContext();
  const { mutateAsync, error } = useUpdateWorkspace();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);

  const {
    handleSubmit,
    control,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: "onSubmit",
    defaultValues: { name: workspace?.name ?? "", slug: workspace?.slug ?? "" },
  });

  const watchedSlug = watch("slug");

  // Keyed on id as well as name/slug: resets baseline when switching workspaces.
  useEffect(() => {
    reset({ name: workspace?.name ?? "", slug: workspace?.slug ?? "" });
  }, [workspace?.id, workspace?.name, workspace?.slug]);

  if (!workspace) {
    return null;
  }

  const executeUpdate = async (data: FormData) => {
    const details: { name?: string; slug?: string } = {};

    if (data.name !== workspace.name) {
      details.name = data.name;
    }

    if (data.slug !== workspace.slug) {
      details.slug = data.slug;
    }

    if (!Object.keys(details).length) {
      return;
    }

    try {
      const result = await mutateAsync({ workspaceSlug: workspace.slug, details });
      const newSlug = result.result.slug;
      reset({ name: result.result.name, slug: newSlug });
      createSuccessAlert({
        title: "Workspace updated",
        description: "Your changes have been saved.",
      });

      if (data.slug !== workspace.slug) {
        navigate(pages.workspaceSettings(newSlug), { replace: true });
      }
    } catch (err: unknown) {
      const apiError = err as ApiAdapterError;

      if (apiError?.errorCode === ApiErrorCode.WORKSPACE_SLUG_TAKEN) {
        setError("slug", { message: "This URL is already taken" });
      } else if (apiError?.errorCode === ApiErrorCode.WORKSPACE_SLUG_RESERVED) {
        setError("slug", { message: "This URL is reserved. Please choose another." });
      }
      // Other errors surfaced via `error` below
    }
  };

  const onSubmit = (data: FormData) => {
    if (!isDirty) {
      return;
    }

    if (data.slug !== workspace.slug) {
      setPendingData(data);
      setConfirmOpen(true);
    } else {
      executeUpdate(data);
    }
  };

  return (
    <>
      <Stack gap={10} separator={<StackSeparator />}>
        <SettingsSection
          title="General"
          description="Your workspace's display name and the URL it lives at. The URL appears in links members share."
        >
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
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
                  render={({ field }) => <Input {...field} />}
                />
              </Field>
              <Field
                label="Workspace URL"
                invalid={!!errors.slug}
                required
                errorText={errors.slug?.message}
                helperText={`URL preview: /workspaces/${watchedSlug || workspace.slug}`}
              >
                <InputGroup startAddon="/workspaces/">
                  <Controller
                    name="slug"
                    control={control}
                    render={({ field }) => <Input {...field} />}
                  />
                </InputGroup>
              </Field>
              {/* Slug-taken/reserved are already shown inline on the slug field, so
              the generic alert covers only the remaining failures, using the
              friendly mapped message rather than the raw server string. */}
              {error &&
                error.errorCode !== ApiErrorCode.WORKSPACE_SLUG_TAKEN &&
                error.errorCode !== ApiErrorCode.WORKSPACE_SLUG_RESERVED && (
                  <InlineErrorAlert
                    title="Failed to save"
                    description={
                      error.errorCode
                        ? getStandardErrorCodeMessage(error.errorCode as ApiErrorCode)
                        : error.message
                    }
                  />
                )}
              <Box>
                <PrimaryActionButton
                  type="submit"
                  loading={isSubmitting}
                  loadingText="Saving..."
                  disabled={!isDirty}
                >
                  Save
                </PrimaryActionButton>
              </Box>
            </Stack>
          </form>
        </SettingsSection>
        <SettingsSection
          title="Integrations"
          description="Third-party connections that feeds in this workspace fetch with. Any member can manage them."
        >
          <WorkspaceRedditConnectionSetting workspaceSlug={workspace.slug} />
        </SettingsSection>
        {/* Absent entirely when Paddle is not configured (self-host posture). */}
        {isPaddleConfigured && (
          <SettingsSection
            title="Billing"
            description="Manage the workspace's subscription, plan, and payment."
          >
            <Box>
              <Button asChild variant="outline">
                <RouterLink to={pages.workspaceBilling(workspace.slug)}>
                  Manage billing <FaChevronRight aria-hidden />
                </RouterLink>
              </Button>
            </Box>
          </SettingsSection>
        )}
      </Stack>
      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Change workspace URL?"
        description="Changing your workspace URL will break any existing links or bookmarks. Anyone using the old URL will land on the not-found page."
        colorScheme="red"
        okText="Yes, change URL"
        onConfirm={async () => {
          if (pendingData) {
            await executeUpdate(pendingData);
            setPendingData(null);
          }
        }}
      />
    </>
  );
};
