import { useEffect, useState } from "react";
import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { InferType, object, string } from "yup";
import { Field } from "@/components/ui/field";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { usePageAlertContext } from "@/contexts/PageAlertContext";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { ApiErrorCode, getStandardErrorCodeMessage } from "@/utils/getStandardErrorCodeMessage";
import { useUpdateWorkspaceBillingEmail } from "../../hooks";

const billingEmailFormSchema = object({
  email: string()
    .required("Email address is required")
    .email("Enter a valid email address")
    .max(254, "Email address is too long"),
});

type BillingEmailFormData = InferType<typeof billingEmailFormSchema>;

const resolveErrorMessage = (err?: ApiAdapterError | null): string | undefined => {
  if (!err) {
    return undefined;
  }

  const code = err.errorCode as ApiErrorCode | undefined;

  return code ? getStandardErrorCodeMessage(code) : err.message;
};

interface WorkspaceBillingEmailProps {
  workspaceSlug: string;
  currentEmail: string;
}

export const WorkspaceBillingEmail = ({
  workspaceSlug,
  currentEmail,
}: WorkspaceBillingEmailProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const { createSuccessAlert } = usePageAlertContext();
  const { mutateAsync, error, reset, status } = useUpdateWorkspaceBillingEmail();
  const {
    handleSubmit,
    control,
    reset: resetForm,
    formState: { errors, isSubmitting },
  } = useForm<BillingEmailFormData>({
    resolver: yupResolver(billingEmailFormSchema),
    mode: "onSubmit",
    defaultValues: { email: currentEmail },
  });

  useEffect(() => {
    if (isEditing) {
      resetForm({ email: currentEmail });
      reset();
    }
  }, [isEditing, currentEmail, resetForm, reset]);

  if (!isEditing) {
    return (
      <HStack gap={3} alignItems="center" flexWrap="wrap">
        <Text color="fg.muted">
          Billed to{" "}
          <Text as="span" color="fg">
            {currentEmail}
          </Text>
        </Text>
        <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
          Change billing email
        </Button>
      </HStack>
    );
  }

  const onSubmit = async ({ email }: BillingEmailFormData) => {
    const trimmed = email.trim();

    if (trimmed.toLowerCase() === currentEmail.toLowerCase()) {
      setIsEditing(false);

      return;
    }

    try {
      const result = await mutateAsync({ workspaceSlug, email: trimmed });

      setIsEditing(false);
      createSuccessAlert({
        title: "Billing email updated",
        description: `Receipts will now go to ${result.data.billingEmail}.`,
      });
    } catch {
      // Error surfaces through `error` below; the old address stays displayed.
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap={3}>
        <Field
          label="Billing email"
          invalid={!!errors.email}
          errorText={errors.email?.message}
          helperText="Receipts go to this address."
        >
          <HStack gap={2} alignSelf="stretch" alignItems="flex-start">
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  flex="1"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                />
              )}
            />
          </HStack>
        </Field>
        {error && (
          <InlineErrorAlert
            title="Failed to update billing email"
            description={resolveErrorMessage(error) ?? "Please try again."}
          />
        )}
        <HStack gap={2}>
          <PrimaryActionButton
            type="submit"
            loading={isSubmitting || status === "loading"}
            loadingText="Saving..."
          >
            Save billing email
          </PrimaryActionButton>
          <Button
            variant="ghost"
            onClick={() => {
              setIsEditing(false);
              reset();
            }}
          >
            Cancel
          </Button>
        </HStack>
      </Stack>
    </form>
  );
};
