import { Button, HStack, Input, Stack } from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { cloneElement, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { array, InferType, number, object, string } from "yup";
import { useTranslation } from "react-i18next";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { useCreateDiscordChannelConnectionClone } from "../../hooks";
import { FeedConnectionType } from "@/types";
import { InlineErrorAlert, InlineErrorIncompleteFormAlert } from "@/components";
import { usePageAlertContext } from "@/contexts/PageAlertContext";
import { SelectableUserFeedList } from "../../../../../feed/components/CopyUserFeedSettingsDialog/SelectableUserFeedList";
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
  name: string().required("Name is required").max(250, "Name must be fewer than 250 characters"),
  userFeedSelection: object({
    // selected feeds must have at least one item if type is "selected"
    type: string().oneOf(["all", "selected"]).required(),
    searchTerm: string().optional(),
    selectedFeeds: array()
      .of(string().required())
      .required()
      .when("type", ([type], schema) => {
        if (type === "selected") {
          return schema.min(1, "At least one target feed must be selected");
        }

        return schema;
      }),
    excludedFeeds: array().of(string().required()).default([]),
    total: number().required(),
  }).required(),
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
  defaultValues: inputDefaultValues,
  trigger,
}: Props) => {
  const defaultValues: FormData = {
    name: inputDefaultValues.name,
    userFeedSelection: {
      type: "selected",
      searchTerm: "",
      selectedFeeds: inputDefaultValues.targetFeedIds,
      excludedFeeds: [],
      total: inputDefaultValues.targetFeedIds.length,
    },
  };
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    defaultValues,
  });
  const [open, setOpen] = useState(false);
  const initialRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: createChannelClone, error } = useCreateDiscordChannelConnectionClone();
  const { t } = useTranslation();
  const { createSuccessAlert } = usePageAlertContext();

  useEffect(() => {
    reset(defaultValues);
  }, [open, JSON.stringify(defaultValues)]);

  const onSubmit = async ({ name, userFeedSelection }: FormData) => {
    try {
      if (isSubmitting) {
        return;
      }

      if (type === FeedConnectionType.DiscordChannel) {
        await createChannelClone({
          feedId,
          connectionId,
          details: {
            name,
            targetFeedSelectionType: userFeedSelection.type,
            targetFeedSearch: userFeedSelection.searchTerm,
            targetFeedIds: userFeedSelection.selectedFeeds,
            targetFeedExcludeIds:
              userFeedSelection.type === "all" ? userFeedSelection.excludedFeeds : undefined,
          },
        });
      } else {
        throw new Error(`Unsupported connection type when cloning discord connection: ${type}`);
      }

      createSuccessAlert({
        title: `Successfully created cloned connection: ${name}`,
      });

      setOpen(false);
      reset({ name });
    } catch (err) {}
  };

  const formErrorCount = Object.keys(errors).length;

  return (
    <>
      {cloneElement(trigger, { onClick: () => setOpen(true) })}
      <DialogRoot
        open={open}
        onOpenChange={(e) => setOpen(e.open)}
        initialFocusEl={() => initialRef.current}
        size="xl"
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone connection</DialogTitle>
          </DialogHeader>
          <DialogCloseTrigger />
          <DialogBody>
            <Stack gap={4}>
              <form id="clonefeed" onSubmit={handleSubmit(onSubmit)}>
                <Stack gap={4}>
                  <Field
                    label={<span style={{ fontWeight: 600 }}>Name</span>}
                    invalid={!!errors.name}
                    errorText={errors.name?.message}
                    helperText="The name for the newly-cloned connection."
                  >
                    <Controller
                      name="name"
                      control={control}
                      render={({ field }) => <Input {...field} ref={initialRef} />}
                    />
                  </Field>
                  <Stack gap={1}>
                    <Controller
                      name="userFeedSelection"
                      control={control}
                      render={({ field }) => (
                        <SelectableUserFeedList
                          selectedIds={field.value.selectedFeeds}
                          onSelectedIdsChange={(ids) => {
                            field.onChange({
                              type: "selected",
                              selectedFeeds: ids,
                              excludedFeeds: [],
                              total: ids.length,
                            });
                          }}
                          excludedIds={field.value.excludedFeeds || []}
                          onExcludedIdsChange={(ids) =>
                            field.onChange({ ...field.value, excludedFeeds: ids })
                          }
                          description="Select the feeds you want to copy this connection to. You can select multiple
                      feeds."
                          isSelectedAll={field.value.type === "all"}
                          onSelectAll={(total, search, isChecked) =>
                            field.onChange({
                              ...field.value,
                              type: isChecked ? "all" : "selected",
                              searchTerm: search,
                              selectedFeeds: isChecked
                                ? Array.from({ length: total }, (_, i) => String(i + 1))
                                : [],
                              excludedFeeds: [],
                              total,
                            })
                          }
                        />
                      )}
                    />
                    <Field
                      invalid={!!errors.userFeedSelection}
                      errorText={errors.userFeedSelection?.selectedFeeds?.message}
                    />
                  </Stack>
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
          </DialogBody>
          <DialogFooter>
            <HStack>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <PrimaryActionButton
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
              </PrimaryActionButton>
            </HStack>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </>
  );
};
