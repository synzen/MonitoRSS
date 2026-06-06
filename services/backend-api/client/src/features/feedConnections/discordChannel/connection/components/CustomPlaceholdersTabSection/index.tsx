import { Accordion, Box, Button, Code, HStack, Heading, Stack, Text } from "@chakra-ui/react";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useState, useRef } from "react";
import { FaPlus } from "react-icons/fa6";
import { v4 as uuidv4 } from "uuid";
import {
  CustomPlaceholdersFormData,
  CustomPlaceholdersFormSchema,
} from "./constants/CustomPlaceholderFormSchema";
import { CustomPlaceholderForm } from "./CustomPlaceholderForm";
import { useUpdateConnection } from "../../hooks";
import { SavedUnsavedChangesPopupBar, UnsavedChangesBadge } from "@/components";
import { BlockableFeature, SubscriberBlockText } from "@/features/subscriptionProducts";
import { CustomPlaceholderStepType, SupporterTier } from "@/constants";

import { useUserFeedConnectionContext } from "@/features/feed";
import { usePageAlertContext } from "@/contexts/PageAlertContext";

export const CustomPlaceholdersTabSection = () => {
  const {
    userFeed: { id: feedId },
    connection: {
      id: connectionId,
      key: connectionType,
      customPlaceholders: currentCustomPlaceholders,
    },
  } = useUserFeedConnectionContext();
  const { mutateAsync } = useUpdateConnection({
    type: connectionType,
    disablePreviewInvalidation: true,
  });
  const formMethods = useForm<CustomPlaceholdersFormData>({
    resolver: yupResolver(CustomPlaceholdersFormSchema),
    mode: "all",
    defaultValues: {
      customPlaceholders: currentCustomPlaceholders || [],
    },
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { dirtyFields },
  } = formMethods;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "customPlaceholders",
    keyName: "hookKey",
  });
  const [activeValues, setActiveValues] = useState<string[]>([]);
  const formFocusRef = useRef<HTMLFormElement>(null);
  const { createSuccessAlert, createErrorAlert } = usePageAlertContext();

  const onSubmit = async ({ customPlaceholders }: CustomPlaceholdersFormData) => {
    try {
      await mutateAsync({
        connectionId,
        feedId,
        details: {
          customPlaceholders: customPlaceholders.map((v) => ({
            ...v,
            steps: v.steps.map((s) => {
              if (!s.type || s.type === CustomPlaceholderStepType.Regex) {
                return {
                  ...s,
                  regexSearch: s.regexSearch.replaceAll("\\n", "\n"),
                  type: CustomPlaceholderStepType.Regex,
                };
              }

              return s;
            }),
          })),
        },
      });
      reset({ customPlaceholders });
      createSuccessAlert({
        title: "Successfully updated custom placeholders.",
      });
    } catch (err) {
      createErrorAlert({
        title: "Failed to update custom placeholders.",
        description: (err as Error).message,
      });
    }
  };

  const onAddCustomPlaceholder = () => {
    const newIndex = fields.length;
    append({
      id: uuidv4(),
      steps: [
        {
          id: uuidv4(),
          type: CustomPlaceholderStepType.Regex,
          regexSearch: "",
          replacementString: "",
          regexSearchFlags: "gi",
        },
      ],
      referenceName: "",
      sourcePlaceholder: "",
      isNew: true,
    });
    setActiveValues([String(newIndex)]);
  };

  const onDeleteCustomPlaceholder = async (index: number) => {
    remove(index);
    setActiveValues([]);
  };

  return (
    <Stack gap={8} mb={24}>
      <Stack>
        <Heading as="h2" size="md" id="custom-placeholders-title">
          Custom Placeholders
        </Heading>
        <Text>
          Create custom placeholders by transforming the content of existing placeholders through a
          series of steps to only include the content you&apos;re interested in.
        </Text>
      </Stack>
      <SubscriberBlockText
        feature={BlockableFeature.CustomPlaceholders}
        supporterTier={SupporterTier.T1}
        alternateText={`While you can use this feature, you must be a supporter at a sufficient tier to
          have this feature applied during delivery. Consider supporting MonitoRSS's free services and open-source development!`}
      />
      <FormProvider {...formMethods}>
        <form
          ref={formFocusRef}
          onSubmit={handleSubmit(onSubmit)}
          aria-label="Custom placeholders settings"
        >
          <Stack gap={4}>
            <Stack gap={4} role="list" aria-labelledby="custom-placeholders-title">
              {fields.length > 0 && (
                <Accordion.Root
                  collapsible
                  role="listitem"
                  value={activeValues}
                  onValueChange={(details) => setActiveValues(details.value)}
                >
                  {fields.map((item, index) => {
                    const hasUnsavedChanges = dirtyFields.customPlaceholders?.[index];

                    return (
                      <Accordion.Item key={item.id} value={String(index)}>
                        <Accordion.ItemTrigger>
                          <HStack width="100%" gap={4}>
                            <Accordion.ItemIndicator />
                            <HStack flexWrap="wrap">
                              <Box as="span" flex="1" textAlign="left" paddingY={2}>
                                {!item.referenceName && (
                                  <Text color="fg.muted">Unnamed custom placeholder</Text>
                                )}
                                {item.referenceName && (
                                  <Code>{`{{custom::${item.referenceName}}}`}</Code>
                                )}
                              </Box>
                              {hasUnsavedChanges && <UnsavedChangesBadge />}
                            </HStack>
                          </HStack>
                        </Accordion.ItemTrigger>
                        <Accordion.ItemContent>
                          <Accordion.ItemBody pb={4}>
                            <Stack>
                              <CustomPlaceholderForm
                                isExpanded={activeValues.includes(String(index))}
                                onDelete={() => onDeleteCustomPlaceholder(index)}
                                index={index}
                              />
                            </Stack>
                          </Accordion.ItemBody>
                        </Accordion.ItemContent>
                      </Accordion.Item>
                    );
                  })}
                </Accordion.Root>
              )}
            </Stack>
            <Box>
              <Button onClick={onAddCustomPlaceholder}>
                <FaPlus fontSize={13} />
                Add Custom Placeholder
              </Button>
            </Box>
          </Stack>
          <SavedUnsavedChangesPopupBar restoreFocusRef={formFocusRef} />
        </form>
      </FormProvider>
    </Stack>
  );
};
