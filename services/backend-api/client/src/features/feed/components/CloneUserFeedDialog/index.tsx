import {
  Box,
  Button,
  HStack,
  Input,
  Link,
  Stack,
  Icon,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { InferType, object, string } from "yup";
import { useTranslation } from "react-i18next";
import { FaUpRightFromSquare } from "react-icons/fa6";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { useCreateUserFeedClone } from "../../hooks";
import { useFeedScope } from "../../contexts/FeedScopeContext";
import {
  InlineErrorAlert,
  InlineErrorIncompleteFormAlert,
} from "../../../../components/InlineErrorAlert";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";
import { pages } from "../../../../constants";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogCloseTrigger,
} from "../../../../components/ui/dialog";
import { Field } from "../../../../components/ui/field";

const formSchema = object({
  title: string().required("Title is required"),
  url: string().required().matches(/^http/, {
    message: "Must be a valid URL",
  }),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  feedId?: string;
  defaultValues: {
    title: string;
    url: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CloneUserFeedDialog = ({
  feedId,
  defaultValues,
  open,
  onOpenChange,
}: Props) => {
  const { workspaceSlug } = useFeedScope();
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    defaultValues,
  });
  const setOpen = onOpenChange;
  const initialRef = useRef<HTMLInputElement>(null);
  const { mutateAsync, error, reset: resetError } = useCreateUserFeedClone();
  const { t } = useTranslation();
  const { createSuccessAlert } = usePageAlertContext();

  useEffect(() => {
    reset(defaultValues);
    resetError();
  }, [open]);

  useEffect(() => {
    reset(defaultValues);
  }, [JSON.stringify(defaultValues)]);

  const onSubmit = async ({ title, url }: FormData) => {
    if (!feedId) {
      return;
    }

    try {
      const {
        result: { id },
      } = await mutateAsync({ feedId, details: { title, url } });

      createSuccessAlert({
        title: `Successfully cloned feed to: ${title}.`,
        description: (
          <Box mt={2}>
            <Button asChild>
              <Link
                href={pages.userFeed(id, {
                  scope: workspaceSlug ? { workspaceSlug } : undefined,
                })}
                target="_blank"
              >
                View cloned feed
                <Icon>
                  <FaUpRightFromSquare />
                </Icon>
              </Link>
            </Button>
          </Box>
        ),
      });

      setOpen(false);
      reset({ title });
    } catch (err) {}
  };

  const formErrorCount = Object.keys(errors).length;

  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
      onRequestDismiss={(e) => e.preventDefault()}
      initialFocusEl={() => initialRef.current}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clone feed</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <Stack gap={4}>
            <form id="clonefeed" onSubmit={handleSubmit(onSubmit)}>
              <Stack gap={4}>
                <Field
                  label="Title"
                  invalid={!!errors.title}
                  required
                  errorText={errors.title?.message}
                >
                  <Controller
                    name="title"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} ref={initialRef} />
                    )}
                  />
                </Field>
                <Field
                  label="Feed Link"
                  invalid={!!errors.url}
                  required
                  errorText={errors.url?.message}
                >
                  <Controller
                    name="url"
                    control={control}
                    render={({ field }) => <Input type="url" {...field} />}
                  />
                </Field>
              </Stack>
            </form>
            {error && (
              <InlineErrorAlert
                title={t("common.errors.somethingWentWrong")}
                description={error.message}
              />
            )}
            {isSubmitted && formErrorCount && (
              <InlineErrorIncompleteFormAlert fieldCount={formErrorCount} />
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <HStack>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              <span>Cancel</span>
            </Button>
            <PrimaryActionButton
              aria-disabled={isSubmitting}
              onClick={() => {
                if (isSubmitting) {
                  return;
                }

                handleSubmit(onSubmit)();
              }}
            >
              <span>{!isSubmitting && "Clone"}</span>
              <span>{isSubmitting && "Cloning..."}</span>
            </PrimaryActionButton>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
