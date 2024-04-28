import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  CloseButton,
  Code,
  Collapse,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Heading,
  Input,
  ListItem,
  OrderedList,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Portal,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { AddIcon, ChevronDownIcon, ChevronUpIcon } from "@chakra-ui/icons";
import { InferType, array, object, string } from "yup";
import { Controller, FormProvider, useFieldArray, useForm, useFormContext } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { v4 } from "uuid";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUserFeedContext } from "../../../../contexts/UserFeedContext";
import CreateArticleInjectionModal from "./CreateExternalPropertyModal";
import { SavedUnsavedChangesPopupBar, SubscriberBlockText } from "../../../../components";
import { useUpdateUserFeed } from "../../../feed";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { notifyError } from "../../../../utils/notifyError";
import { ExternalPropertyPreview } from "./ExternalPropertyPreview";
import { BlockableFeature, SupporterTier } from "../../../../constants";
import { useExternalPropertiesEligibility } from "./hooks/useExternalPropertiesEligibility";
import { ExternalProperty } from "../../../../types";

const formSchema = object({
  externalProperties: array(
    object({
      id: string().required(),
      sourceField: string().required(),
      selectors: array(
        object({
          id: string().required(),
          label: string()
            .required("This is a required field")
            .test("unique", "Cannot have duplicate placeholder labels", (value, context) => {
              const { selectors } = context.from?.[1].value as ExternalProperty;
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
  externalPropertyIndex,
}: {
  selectorIndex: number;
  externalPropertyIndex: number;
}) => {
  const {
    control,
    formState: { errors },
    watch,
  } = useFormContext<FormData>();
  const { fields: selectors, remove } = useFieldArray({
    control,
    name: `externalProperties.${externalPropertyIndex}.selectors`,
    keyName: "idkey",
  });
  const [externalProperty, selector] = watch([
    `externalProperties.${externalPropertyIndex}`,
    `externalProperties.${externalPropertyIndex}.selectors.${selectorIndex}`,
  ]);

  const cssSelectorError =
    errors?.externalProperties?.[externalPropertyIndex]?.selectors?.[selectorIndex]?.cssSelector
      ?.message;
  const labelError =
    errors?.externalProperties?.[externalPropertyIndex]?.selectors?.[selectorIndex]?.label?.message;

  const [showPreview, setShowPreview] = useState(false);

  const onTogglePreview = () => {
    setShowPreview((p) => !p);
  };

  const previewInput = useMemo(
    () => [
      {
        id: externalProperty.id,
        selectors: [selector],
        sourceField: externalProperty.sourceField,
      },
    ],
    [externalProperty.sourceField, selector.cssSelector, selector.label]
  );

  return (
    <Stack border="solid 2px" borderColor="gray.600" p={4} rounded="lg" spacing={0}>
      <FormControl />
      <HStack spacing={4} flexWrap="wrap">
        <FormControl flex={1} isInvalid={!!cssSelectorError} isRequired>
          <Flex justifyContent="space-between">
            <FormLabel>CSS Selector</FormLabel>
            <Popover>
              <PopoverTrigger>
                <Button variant="link" fontWeight="medium" color="whiteAlpha.700" fontSize="sm">
                  What is this?
                </Button>
              </PopoverTrigger>
              <Portal>
                <PopoverContent maxWidth={500} width="100%">
                  <PopoverArrow />
                  <PopoverHeader fontWeight="semibold">What is a CSS Selector?</PopoverHeader>
                  <PopoverCloseButton />
                  <PopoverBody>
                    CSS selectors are like paths to target element(s) on a webpage. Some examples
                    are:
                    <br />
                    <br />
                    <Code colorScheme="black">img</Code> - targets all images
                    <br />
                    <Code colorScheme="black">a</Code> - target all anchors/links
                    <br />
                    <br />
                    The more specific the selector, the more likely it is to be unique to the
                    content you want to extract. You can use your browser&apos;s developer tools to
                    find the CSS selector of an element on any page. To do so:
                    <br />
                    <br />
                    <OrderedList>
                      <ListItem>Right-click the element on the page you want to target</ListItem>
                      <ListItem>Click &quot;Inspect&quot;</ListItem>
                      <ListItem>
                        Right-click the highlighted element in the developer tools and select
                        &quot;Copy&quot; -&gt; &quot;Copy CSS selector&quot;
                      </ListItem>
                    </OrderedList>
                    <br />
                    The steps may vary depending on the browser you are using.
                  </PopoverBody>
                </PopoverContent>
              </Portal>
            </Popover>
          </Flex>
          <Controller
            control={control}
            name={`externalProperties.${externalPropertyIndex}.selectors.${selectorIndex}.cssSelector`}
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
        <FormControl flex={1} isInvalid={!!labelError} isRequired>
          <FormLabel>Placeholder Label</FormLabel>
          <Controller
            control={control}
            name={`externalProperties.${externalPropertyIndex}.selectors.${selectorIndex}.label`}
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
        mt={6}
        mb={1}
      >
        {showPreview ? "Hide Preview" : "Show Preview"}
      </Button>
      <Box bg="gray.800" rounded="lg">
        <Collapse in={showPreview} transition={{ enter: { duration: 0.3 } }}>
          <ExternalPropertyPreview externalProperties={previewInput} disabled={!showPreview} />
        </Collapse>
      </Box>
    </Stack>
  );
};

const ArticleTabInjectionForm = ({ externalPropertyIndex }: { externalPropertyIndex: number }) => {
  const { control } = useFormContext<FormData>();
  const { fields: selectors, append } = useFieldArray({
    control,
    name: `externalProperties.${externalPropertyIndex}.selectors`,
    keyName: "idkey",
  });

  return (
    <Stack spacing={8} background="gray.700" p={4} rounded="lg">
      {selectors?.map((s, selectorIndex) => {
        return (
          <SelectorForm
            key={s.id}
            selectorIndex={selectorIndex}
            externalPropertyIndex={externalPropertyIndex}
          />
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

export const ExternalPropertiesTabSection = () => {
  const { t } = useTranslation();
  const { userFeed } = useUserFeedContext();
  const { eligible, alertComponent } = useExternalPropertiesEligibility();
  const formData = useForm<FormData>({
    resolver: yupResolver(formSchema),
    defaultValues: {
      externalProperties: (userFeed?.externalProperties || []).map((i) => ({
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
    name: "externalProperties",
    keyName: "idkey",
  });
  const [activeIndex, setActiveIndex] = useState<number[] | number>();
  const { mutateAsync } = useUpdateUserFeed();

  const onSubmit = async (data: FormData) => {
    try {
      await mutateAsync({
        feedId: userFeed.id,
        data: {
          externalProperties: data.externalProperties,
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
          <Box>
            <Stack mb={4}>
              <Heading as="h2" size="md">
                External Properties
              </Heading>
              <Text>
                Create additional article properties that come from linked pages within feed
                articles. These article properties can then be used as placeholders to further
                customize messages per connection.
              </Text>
            </Stack>
            {!eligible ? <Box mb={4}>{alertComponent}</Box> : undefined}
            <SubscriberBlockText
              feature={BlockableFeature.ArticleInjections}
              supporterTier={SupporterTier.T2}
              alternateText={`While you can use this feature, you must be a ${SupporterTier.T2} supporter to
    have this feature applied during delivery. Consider supporting MonitoRSS's free services and open-source development!`}
            />
          </Box>
          {fields?.length && (
            <Accordion allowToggle index={activeIndex} onChange={setActiveIndex}>
              {fields?.map((a, fieldIndex) => {
                return (
                  <AccordionItem key={a.id}>
                    <Heading as="h2" paddingY={2}>
                      <AccordionButton>
                        <HStack spacing={4}>
                          <AccordionIcon />
                          <chakra.span>Source Property: </chakra.span>
                          <chakra.span fontFamily="mono">{a.sourceField}</chakra.span>
                        </HStack>
                      </AccordionButton>
                    </Heading>
                    <AccordionPanel pb={4}>
                      <Stack spacing={4}>
                        <ArticleTabInjectionForm externalPropertyIndex={fieldIndex} />
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
                  Add External Property
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
