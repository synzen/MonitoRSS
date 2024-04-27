import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  Center,
  Code,
  HStack,
  Heading,
  Highlight,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { AddIcon } from "@chakra-ui/icons";
import { v4 as uuidv4 } from "uuid";
import { notifyError } from "../../../../utils/notifyError";
import {
  CustomPlaceholdersFormData,
  CustomPlaceholdersFormSchema,
} from "./constants/CustomPlaceholderFormSchema";
import { CustomPlaceholderForm } from "./CustomPlaceholderForm";
import { useConnection, useUpdateConnection } from "../../hooks";
import { InlineErrorAlert, SavedUnsavedChangesPopupBar } from "@/components";
import { FeedConnectionType } from "@/types";
import { notifySuccess } from "@/utils/notifySuccess";
import { GetUserFeedArticlesInput } from "../../../feed/api";
import { BlockableFeature, CustomPlaceholderStepType, SupporterTier } from "@/constants";
import { SubscriberBlockText } from "@/components/SubscriberBlockText";

interface Props {
  feedId: string;
  connectionId: string;
  connectionType: FeedConnectionType;
  articleFormat: GetUserFeedArticlesInput["data"]["formatter"];
}

export const CustomPlaceholdersTabSection = ({
  feedId,
  connectionId,
  connectionType,
  articleFormat,
}: Props) => {
  const { connection, status, error } = useConnection({
    connectionId,
    feedId,
  });
  const { mutateAsync } = useUpdateConnection({
    type: connectionType,
    disablePreviewInvalidation: true,
  });
  const formMethods = useForm<CustomPlaceholdersFormData>({
    resolver: yupResolver(CustomPlaceholdersFormSchema),
    mode: "all",
    defaultValues: {
      customPlaceholders: connection?.customPlaceholders || [],
    },
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { dirtyFields },
  } = formMethods;
  const { t } = useTranslation();
  const currentCustomPlaceholders = connection?.customPlaceholders;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "customPlaceholders",
    keyName: "hookKey",
  });
  const [activeIndex, setActiveIndex] = useState<number | number[] | undefined>();

  useEffect(() => {
    if (currentCustomPlaceholders) {
      reset({
        customPlaceholders: currentCustomPlaceholders || [],
      });
    }
  }, [currentCustomPlaceholders]);

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
      notifySuccess(t("common.success.savedChanges"));
    } catch (err) {
      notifyError(t("common.errors.failedToSave"), err as Error);
    }
  };

  const onAddCustomPlaceholder = () => {
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
    setActiveIndex(fields.length);
  };

  const onDeleteCustomPlaceholder = async (index: number) => {
    remove(index);
    setActiveIndex(-1);
  };

  if (error) {
    return (
      <InlineErrorAlert title={t("common.errors.somethingWentWrong")} description={error.message} />
    );
  }

  if (status === "loading") {
    return (
      <Center>
        <Spinner />
      </Center>
    );
  }

  return (
    <Stack spacing={8} mb={24}>
      <Stack>
        <Heading as="h2" size="md">
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
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={4}>
            {fields.length && (
              <Accordion
                allowToggle
                index={activeIndex}
                onChange={(newIndex) => setActiveIndex(newIndex)}
              >
                {fields.map((item, index) => {
                  const hasUnsavedChanges = dirtyFields.customPlaceholders?.[index];

                  return (
                    <AccordionItem key={item.id}>
                      <h2>
                        <AccordionButton>
                          <HStack width="100%" spacing={4}>
                            <AccordionIcon />
                            <HStack flexWrap="wrap">
                              <Box as="span" flex="1" textAlign="left" paddingY={2}>
                                {!item.referenceName && (
                                  <Text color="gray.500">Unnamed custom placeholder</Text>
                                )}
                                {item.referenceName && (
                                  <Code>{`{{custom::${item.referenceName}}}`}</Code>
                                )}
                              </Box>
                              {hasUnsavedChanges && (
                                <Text fontSize="sm" fontWeight={600}>
                                  <Highlight
                                    query="Unsaved changes"
                                    styles={{
                                      bg: "orange.200",
                                      rounded: "full",
                                      px: "2",
                                      py: "1",
                                    }}
                                  >
                                    Unsaved changes
                                  </Highlight>
                                </Text>
                              )}
                            </HStack>
                          </HStack>
                        </AccordionButton>
                      </h2>
                      <AccordionPanel pb={4}>
                        <Stack>
                          <CustomPlaceholderForm
                            articleFormat={articleFormat}
                            isExpanded={activeIndex === index}
                            onDelete={() => onDeleteCustomPlaceholder(index)}
                            feedId={feedId}
                            connectionId={connectionId}
                            index={index}
                            connectionType={connectionType}
                          />
                        </Stack>
                      </AccordionPanel>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
            <Box>
              <Button onClick={onAddCustomPlaceholder} leftIcon={<AddIcon fontSize={13} />}>
                Add Custom Placeholder
              </Button>
            </Box>
          </Stack>
          <SavedUnsavedChangesPopupBar />
        </form>
      </FormProvider>
    </Stack>
  );
};
