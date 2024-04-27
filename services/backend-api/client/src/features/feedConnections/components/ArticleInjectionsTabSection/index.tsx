import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  CloseButton,
  Collapse,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Heading,
  Input,
  Select,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { AddIcon, ChevronDownIcon, ChevronUpIcon } from "@chakra-ui/icons";
import { InferType, array, object, string } from "yup";
import { Controller, FormProvider, useFieldArray, useForm, useFormContext } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { v4 } from "uuid";
import { ComponentProps, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUserFeedContext } from "../../../../contexts/UserFeedContext";
import CreateArticleInjectionModal from "./CreateArticleInjectionModal";
import { SavedUnsavedChangesPopupBar, SubscriberBlockText } from "../../../../components";
import { useUpdateUserFeed } from "../../../feed";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { notifyError } from "../../../../utils/notifyError";
import {
  ArticleInjection,
  FeedConnectionType,
  FeedDiscordChannelConnection,
} from "../../../../types";
import { ArticleInjectionPlaceholderPreview } from "./ArticleInjectionPlaceholderPreview";
import { BlockableFeature, SupporterTier } from "../../../../constants";
import { useArticleInjectionEligibility } from "./hooks/useArticleInjectionEligibility";

const formSchema = object({
  injections: array(
    object({
      id: string().required(),
      sourceField: string().required(),
      selectors: array(
        object({
          id: string().required(),
          label: string()
            .required("This is a required field")
            .test("unique", "Cannot have duplicate placeholder labels", (value, context) => {
              const { selectors } = context.from?.[1].value as ArticleInjection;
              const names = selectors.map((s) => s.label);

              return !names.length || names.filter((n) => n === value).length === 1;
            }),
          cssSelector: string().required("This is a required field"),
        }).required()
      )
        .required()
        .min(1),
    }).required()
  ),
});

type FormData = InferType<typeof formSchema>;

const SelectorForm = ({
  selectorIndex,
  injectionIndex,
}: {
  selectorIndex: number;
  injectionIndex: number;
}) => {
  const { userFeed } = useUserFeedContext();
  const {
    control,
    formState: { errors },
    watch,
  } = useFormContext<FormData>();
  const { fields: selectors, remove } = useFieldArray({
    control,
    name: `injections.${injectionIndex}.selectors`,
    keyName: "idkey",
  });
  const [injection, selector] = watch([
    `injections.${injectionIndex}`,
    `injections.${injectionIndex}.selectors.${selectorIndex}`,
  ]);

  const cssSelectorError =
    errors?.injections?.[injectionIndex]?.selectors?.[selectorIndex]?.cssSelector?.message;
  const labelError =
    errors?.injections?.[injectionIndex]?.selectors?.[selectorIndex]?.label?.message;

  const [previewFormatOptions, setPreviewFormatOptions] =
    useState<ComponentProps<typeof ArticleInjectionPlaceholderPreview>["formatOptions"]>();

  const showPreview = !!previewFormatOptions;

  const onChangeSelectedConnection = (connectionId: string) => {
    const connection = userFeed.connections.find((c) => c.id === connectionId);

    if (!connection) {
      return;
    }

    if (connection.key === FeedConnectionType.DiscordChannel) {
      const c = connection as FeedDiscordChannelConnection;

      setPreviewFormatOptions({
        formatTables: c.details.formatter.formatTables,
        stripImages: c.details.formatter.stripImages,
        disableImageLinkPreviews: c.details.formatter.disableImageLinkPreviews,
      });
    }
  };

  const onTogglePreview = () => {
    if (!showPreview) {
      const firstConnectionId = userFeed.connections[0]?.id;

      if (!firstConnectionId) {
        return;
      }

      onChangeSelectedConnection(firstConnectionId);
    } else {
      setPreviewFormatOptions(undefined);
    }
  };

  return (
    <Stack border="solid 2px" borderColor="gray.600" p={4} rounded="lg" spacing={4}>
      <HStack spacing={4} flexWrap="wrap">
        <FormControl flex={1} isInvalid={!!cssSelectorError}>
          <FormLabel>CSS Selector</FormLabel>
          <Controller
            control={control}
            name={`injections.${injectionIndex}.selectors.${selectorIndex}.cssSelector`}
            render={({ field }) => (
              <Input
                {...field}
                minWidth={300}
                bg="gray.800"
                fontFamily="mono"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck="false"
              />
            )}
          />
          {!cssSelectorError && (
            <FormHelperText>
              Target the element on the external page that contains the desired content.
            </FormHelperText>
          )}
          {cssSelectorError && <FormErrorMessage>{cssSelectorError}</FormErrorMessage>}
        </FormControl>
        <FormControl flex={1} isInvalid={!!labelError}>
          <FormLabel>Placeholder Label</FormLabel>
          <Controller
            control={control}
            name={`injections.${injectionIndex}.selectors.${selectorIndex}.label`}
            render={({ field }) => (
              <Input
                {...field}
                minWidth={300}
                bg="gray.800"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck="false"
              />
            )}
          />
          {!labelError && (
            <FormHelperText>A unique label to reference as a placeholder.</FormHelperText>
          )}
          {labelError && <FormErrorMessage>{labelError}</FormErrorMessage>}
        </FormControl>
        <CloseButton
          aria-label="Delete"
          size="sm"
          variant="ghost"
          isDisabled={selectors.length === 1}
          onClick={() => remove(selectorIndex)}
          alignSelf="flex-start"
        />
      </HStack>
      <Button
        leftIcon={showPreview ? <ChevronUpIcon /> : <ChevronDownIcon />}
        size="sm"
        onClick={() => onTogglePreview()}
        mt={2}
      >
        {showPreview ? "Hide Preview" : "Show Preview"}
      </Button>
      <Box>
        <Collapse in={!!previewFormatOptions} transition={{ enter: { duration: 0.3 } }}>
          <Stack px={4}>
            <FormControl flex={1}>
              <FormLabel>Preview Connection</FormLabel>
              <Select bg="gray.800" onChange={(e) => onChangeSelectedConnection(e.target.value)}>
                {userFeed.connections.map((con) => (
                  <option key={con.id} value={con.id}>
                    {con.name}
                  </option>
                ))}
              </Select>
            </FormControl>
            <ArticleInjectionPlaceholderPreview
              articleInjections={[
                {
                  id: injection.id,
                  selectors: [selector],
                  sourceField: injection.sourceField,
                },
              ]}
              formatOptions={previewFormatOptions}
            />
          </Stack>
        </Collapse>
      </Box>
    </Stack>
  );
};

const ArticleTabInjectionForm = ({ injectionIndex }: { injectionIndex: number }) => {
  const { control } = useFormContext<FormData>();
  const { fields: selectors, append } = useFieldArray({
    control,
    name: `injections.${injectionIndex}.selectors`,
    keyName: "idkey",
  });

  return (
    <Stack spacing={8} background="gray.700" p={4} rounded="lg">
      {selectors?.map((s, selectorIndex) => {
        return (
          <SelectorForm key={s.id} selectorIndex={selectorIndex} injectionIndex={injectionIndex} />
        );
      })}
      <Box>
        <Button
          leftIcon={<AddIcon fontSize={13} />}
          onClick={() =>
            append({
              id: v4(),
              label: "",
              cssSelector: "",
            })
          }
        >
          Add selector
        </Button>
      </Box>
    </Stack>
  );
};

export const ArticleInjectionsTabSection = () => {
  const { t } = useTranslation();
  const { userFeed } = useUserFeedContext();
  const { eligible, alertComponent } = useArticleInjectionEligibility();
  const formData = useForm<FormData>({
    resolver: yupResolver(formSchema),
    defaultValues: {
      injections: (userFeed?.articleInjections || []).map((i) => ({
        id: i.id,
        sourceField: i.sourceField,
        selectors: i.selectors.map((f) => ({
          id: f.id,
          label: f.label,
          cssSelector: f.cssSelector,
        })),
      })),
    },
  });
  const { handleSubmit, control, reset } = formData;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "injections",
    keyName: "idkey",
  });
  const [activeIndex, setActiveIndex] = useState<number[] | number>();
  const { mutateAsync } = useUpdateUserFeed();

  const onSubmit = async (data: FormData) => {
    try {
      await mutateAsync({
        feedId: userFeed.id,
        data: {
          articleInjections: data.injections,
        },
      });

      reset(data);
      notifySuccess(t("common.success.savedChanges"));
    } catch (err) {
      notifyError(t("common.errors.failedToSave"), (err as Error).message);
    }
  };

  return (
    <FormProvider {...formData}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={8} mb={24}>
          <Stack>
            <Heading as="h2" size="md">
              Article Injections
            </Heading>
            <Text>Create placeholders from external URLs to inject into your</Text>
            <SubscriberBlockText
              feature={BlockableFeature.ArticleInjections}
              supporterTier={SupporterTier.T2}
              alternateText={`While you can use this feature, you must be a supporter at a sufficient tier to
    have this feature applied during delivery. Consider supporting MonitoRSS's free services and open-source development!`}
            />
            {!eligible && <Box my={4}>{alertComponent}</Box>}
          </Stack>
          {fields?.length && (
            <Accordion allowToggle index={activeIndex} onChange={setActiveIndex}>
              {fields?.map((a, fieldIndex) => {
                return (
                  <AccordionItem key={a.id}>
                    <Heading as="h2" paddingY={2}>
                      <AccordionButton>
                        <HStack spacing={4}>
                          <AccordionIcon />
                          <chakra.span fontFamily="mono">{a.sourceField}</chakra.span>
                        </HStack>
                      </AccordionButton>
                    </Heading>
                    <AccordionPanel pb={4}>
                      <Stack spacing={4}>
                        <ArticleTabInjectionForm injectionIndex={fieldIndex} />
                        <Box>
                          <Button
                            variant="outline"
                            colorScheme="red"
                            onClick={() => {
                              remove(fieldIndex);
                              setActiveIndex(undefined);
                            }}
                          >
                            Delete
                          </Button>
                        </Box>
                      </Stack>
                    </AccordionPanel>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
          <Box>
            <CreateArticleInjectionModal
              trigger={
                <Button isDisabled={!eligible} leftIcon={<AddIcon fontSize={13} />}>
                  Add Placeholder
                </Button>
              }
              onSubmitted={(data) => {
                append({
                  id: v4(),
                  sourceField: data.sourceField,
                  selectors: [
                    {
                      id: v4(),
                      label: "",
                      cssSelector: "",
                    },
                  ],
                });
                setActiveIndex(fields.length);
              }}
            />
          </Box>
        </Stack>
        <SavedUnsavedChangesPopupBar useDirtyFormCheck />
      </form>
    </FormProvider>
  );
};
