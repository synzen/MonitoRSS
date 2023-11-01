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
import { FormProvider, useForm } from "react-hook-form";
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
import {
  InlineErrorAlert,
  InsufficientSupporterTier,
  SavedUnsavedChangesPopupBar,
} from "@/components";
import { FeedConnectionType } from "@/types";
import { notifySuccess } from "@/utils/notifySuccess";
import { GetUserFeedArticlesInput } from "../../../feed/api";
import { useIsFeatureAllowed } from "@/hooks";
import { BlockableFeature, SupporterTier } from "@/constants";

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
  const { allowed, loaded: loadedFeatures } = useIsFeatureAllowed({
    feature: BlockableFeature.CustomPlaceholders,
  });
  const { connection, status, error } = useConnection({
    connectionId,
    feedId,
  });
  const { mutateAsync } = useUpdateConnection({ type: connectionType });
  const formMethods = useForm<CustomPlaceholdersFormData>({
    resolver: yupResolver(CustomPlaceholdersFormSchema),
    mode: "all",
    defaultValues: {
      customPlaceholders: connection?.customPlaceholders || [],
    },
  });
  const {
    handleSubmit,
    reset,
    formState: { dirtyFields },
    watch,
    setValue,
  } = formMethods;
  const fields = watch("customPlaceholders");
  const { t } = useTranslation();
  const currentCustomPlaceholders = connection?.customPlaceholders;
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
            steps: v.steps.map((s) => ({
              ...s,
              regexSearch: s.regexSearch.replaceAll("\\n", "\n"),
            })),
          })),
        },
      });
      notifySuccess(t("common.success.savedChanges"));
    } catch (err) {
      notifyError(t("common.errors.failedToSave"), err as Error);
    }
  };

  const onAddCustomPlaceholder = () => {
    const newPlaceholders = [
      ...fields,
      {
        id: uuidv4(),
        steps: [
          {
            id: uuidv4(),
            regexSearch: "",
            replacementString: "",
          },
        ],
        referenceName: "",
        sourcePlaceholder: "",
        isNew: true,
      },
    ];
    setValue("customPlaceholders", newPlaceholders, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: false,
    });
    setActiveIndex(fields.length);
  };

  const onDeleteCustomPlaceholder = async (index: number) => {
    const newPlaceholders = [...fields];

    newPlaceholders.splice(index, 1);

    setValue("customPlaceholders", newPlaceholders, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });

    setActiveIndex(-1);
  };

  if (error) {
    return (
      <InlineErrorAlert title={t("common.errors.somethingWentWrong")} description={error.message} />
    );
  }

  if (status === "loading" || !loadedFeatures) {
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
          Create custom placeholders by editing the content of existing placeholders to only include
          the content you&apos;re interested in.
        </Text>
      </Stack>
      {!allowed && <InsufficientSupporterTier tier={SupporterTier.T3} />}
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
                            feedId={feedId}
                            connectionId={connectionId}
                            index={index}
                            onDelete={onDeleteCustomPlaceholder}
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
              <Button
                onClick={onAddCustomPlaceholder}
                leftIcon={<AddIcon fontSize={13} />}
                colorScheme="blue"
              >
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
