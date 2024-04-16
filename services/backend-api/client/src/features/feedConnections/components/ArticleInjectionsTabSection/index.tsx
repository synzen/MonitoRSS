import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  CloseButton,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Heading,
  Input,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { AddIcon } from "@chakra-ui/icons";
import { InferType, array, object, string } from "yup";
import { Controller, FormProvider, useFieldArray, useForm, useFormContext } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { v4 } from "uuid";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUserFeedContext } from "../../../../contexts/UserFeedContext";
import CreateArticleInjectionModal from "./CreateArticleInjectionModal";
import { SavedUnsavedChangesPopupBar } from "../../../../components";
import { useUpdateUserFeed } from "../../../feed";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { notifyError } from "../../../../utils/notifyError";
import { ArticleInjection } from "../../../../types";

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

const ArticleTabInjectionForm = ({ injectionIndex }: { injectionIndex: number }) => {
  const {
    control,
    formState: { errors },
  } = useFormContext<FormData>();
  const {
    fields: selectors,
    append,
    remove,
  } = useFieldArray({
    control,
    name: `injections.${injectionIndex}.selectors`,
    keyName: "idkey",
  });

  return (
    // eslint-disable-next-line react/jsx-no-useless-fragment
    <Stack spacing={6} background="gray.700" p={4} rounded="lg">
      {selectors?.map((s, selectorIndex) => {
        const cssSelectorError =
          errors?.injections?.[injectionIndex]?.selectors?.[selectorIndex]?.cssSelector?.message;
        const labelError =
          errors?.injections?.[injectionIndex]?.selectors?.[selectorIndex]?.label?.message;

        return (
          <HStack
            key={s.id}
            spacing={4}
            flexWrap="wrap"
            border="solid 2px"
            borderColor="gray.600"
            p={4}
            rounded="lg"
          >
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
                  Select the element on the page that contains the content that you want.
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
                <FormHelperText>
                  A unique label for this field. This will be used to reference this field as a
                  placeholder.
                </FormHelperText>
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
          </Stack>
          {fields?.length && (
            <Accordion allowToggle index={activeIndex} onChange={setActiveIndex}>
              {fields?.map((a, fieldIndex) => {
                return (
                  <AccordionItem>
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
              trigger={<Button leftIcon={<AddIcon fontSize={13} />}>Add Placeholder</Button>}
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
