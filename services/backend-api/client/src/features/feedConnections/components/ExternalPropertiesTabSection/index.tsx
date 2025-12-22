import {
  Box,
  Button,
  Code,
  Divider,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Heading,
  Highlight,
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
  theme,
} from "@chakra-ui/react";
import { AddIcon, DeleteIcon, EditIcon } from "@chakra-ui/icons";
import { InferType, array, object, string } from "yup";
import { Controller, FormProvider, useFieldArray, useForm, useFormContext } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { v4 } from "uuid";
import { useTranslation } from "react-i18next";
import { FiHelpCircle } from "react-icons/fi";
import { motion } from "motion/react";
import CreatableSelect from "react-select/creatable";
import { useUserFeedContext } from "../../../../contexts/UserFeedContext";
import CreateExternalPropertyModal from "./CreateExternalPropertyModal";
import { SavedUnsavedChangesPopupBar, SubscriberBlockText } from "../../../../components";
import { useUpdateUserFeed } from "../../../feed";
import { ExternalPropertyPreview } from "./ExternalPropertyPreview";
import { BlockableFeature, SupporterTier } from "../../../../constants";
import { useExternalPropertiesEligibility } from "./hooks/useExternalPropertiesEligibility";
import { ExternalProperty } from "../../../../types";
import UpdateExternalPropertyModal from "./UpdateExternalPropertyModal";
import { REACT_SELECT_STYLES, SelectOption } from "../../../../constants/reactSelectStyles";
import { CssSelectorFormattedOption } from "./CssSelectorFormattedOption";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";

const formSchema = object({
  externalProperties: array(
    object({
      id: string().required(),
      sourceField: string().required(),
      cssSelector: string().required("This is a required field"),
      label: string()
        .required("This is a required field")
        .test(
          "unique",
          "Placeholder labels must be unique among all selectors",
          (value, context) => {
            const properties = context.from?.[1].value.externalProperties as ExternalProperty[];
            const names = properties.map((s) => s.label);

            return !names.length || names.filter((n) => n === value).length === 1;
          }
        ),
    }).required()
  ).required(),
});

type FormData = InferType<typeof formSchema>;

enum CssSelector {
  Image = "img",
  Anchor = "a",
  OpenGraphImage = 'meta[property="og:image"]',
}

const CSS_SELECTOR_DESCRIPTIONS: Record<string, string> = {
  [CssSelector.Image]: "Targets all images on the page.",
  [CssSelector.Anchor]: "Targets all links on the page.",
  [CssSelector.OpenGraphImage]: "Targets the image used when sharing the page on social media.",
};

const ExternalPropertyForm = ({
  externalPropertyIndex,
  onClickDelete,
}: {
  externalPropertyIndex: number;
  onClickDelete: () => void;
}) => {
  const { userFeed } = useUserFeedContext();
  const {
    control,
    formState: { errors },
    watch,
  } = useFormContext<FormData>();
  const externalProperty = watch(`externalProperties.${externalPropertyIndex}`);
  const isNewSelector =
    externalProperty && !userFeed.externalProperties?.find((p) => p.id === externalProperty.id);

  const sourceFieldError =
    errors?.externalProperties?.[externalPropertyIndex]?.sourceField?.message;
  const cssSelectorError =
    errors?.externalProperties?.[externalPropertyIndex]?.cssSelector?.message;
  const labelError = errors?.externalProperties?.[externalPropertyIndex]?.label?.message;

  return (
    <Stack
      border="solid 2px"
      borderColor="gray.600"
      bg="gray.700"
      px={[4, 4, 6]}
      pb={[4, 4, 6]}
      pt={[4, 4, 4]}
      rounded="lg"
      spacing={0}
      position="relative"
    >
      <Stack spacing={4} flexWrap="wrap">
        <Flex justifyContent="space-between" flexWrap="wrap" gap={3}>
          <HStack>
            <Heading
              as="h3"
              size="md"
              fontWeight={600}
              color={!externalProperty.label ? "whiteAlpha.700" : undefined}
              fontStyle={!externalProperty.label ? "italic" : "normal"}
            >
              <Text display="inline" fontWeight={600}>
                Selector:{" "}
              </Text>
              {externalProperty.label || "(unlabeled selector)"}
            </Heading>
            {isNewSelector && (
              <Highlight
                query="Unsaved changes"
                styles={{
                  bg: "orange.200",
                  rounded: "full",
                  px: "2",
                  py: "1",
                  fontSize: "sm",
                  fontWeight: 600,
                }}
              >
                Unsaved changes
              </Highlight>
            )}
          </HStack>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<DeleteIcon />}
            onClick={() => onClickDelete()}
          >
            Delete selector
          </Button>
        </Flex>
        <Divider />
        <FormControl isInvalid={!!labelError} isRequired>
          <FormLabel>Placeholder Label</FormLabel>
          <Controller
            control={control}
            name={`externalProperties.${externalPropertyIndex}.label`}
            render={({ field }) => (
              <Input
                {...field}
                bg="gray.800"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck="false"
              />
            )}
          />
          {labelError && <FormErrorMessage>{labelError}</FormErrorMessage>}
          <FormHelperText>
            A label to reference as a placeholder within connections for customizations. Must be
            unique among all selectors.
          </FormHelperText>
        </FormControl>
        <HStack>
          <FormControl isInvalid={!!sourceFieldError} isRequired>
            <FormLabel id={`source-property-label-${externalProperty.id}`}>
              Source Property
            </FormLabel>
            <Controller
              control={control}
              name={`externalProperties.${externalPropertyIndex}.sourceField`}
              render={({ field }) => (
                <UpdateExternalPropertyModal
                  defaultValue={field.value}
                  trigger={
                    <Button
                      fontSize="md"
                      variant="outline"
                      fontFamily="mono"
                      fontWeight="medium"
                      bg="gray.800"
                      rightIcon={<EditIcon />}
                      aria-describedby={`source-property-label-${externalProperty.id}`}
                    >
                      {field.value}
                    </Button>
                  }
                  onSubmitted={({ sourceField }) => field.onChange(sourceField)}
                />
              )}
            />
            {sourceFieldError && <FormErrorMessage>{sourceFieldError}</FormErrorMessage>}
            <FormHelperText>
              The property containing the URL that references the page with the desired content.
            </FormHelperText>
          </FormControl>
        </HStack>
        <FormControl isInvalid={!!cssSelectorError} isRequired>
          <Flex justifyContent="space-between">
            <FormLabel
              id={`css-selector-label-${externalProperty.id}`}
              htmlFor={`css-selector-input-${externalProperty.id}`}
            >
              CSS Selector
            </FormLabel>
            <Popover>
              <PopoverTrigger>
                <Button
                  variant="link"
                  fontWeight="medium"
                  color="blue.300"
                  fontSize="sm"
                  leftIcon={<FiHelpCircle />}
                >
                  What is a CSS Selector?
                </Button>
              </PopoverTrigger>
              <Portal>
                <PopoverContent maxWidth={[350, 450, 500]} width="100%">
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
                      <ListItem>Click &quot;Show Preview&quot; in this form</ListItem>
                      <ListItem>Open the external page in a new tab</ListItem>
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
            name={`externalProperties.${externalPropertyIndex}.cssSelector`}
            render={({ field: { onChange, ...field } }) => (
              <CreatableSelect<SelectOption>
                {...field}
                value={{
                  label: field.value,
                  value: field.value,
                  description: CSS_SELECTOR_DESCRIPTIONS[field.value],
                }}
                inputId={`css-selector-input-${externalProperty.id}`}
                aria-labelledby={`css-selector-label-${externalProperty.id}`}
                aria-invalid={!!cssSelectorError}
                noOptionsMessage={() => null}
                ariaLiveMessages={{
                  onFocus: (data: any) => {
                    return `You are currently focused on option ${data.focused.label} (${
                      data.focused.description || ""
                    })`;
                  },
                }}
                onChange={(val: any) => onChange(val.value)}
                styles={{
                  ...REACT_SELECT_STYLES(),
                  input: (provided: any, props: any) => {
                    return {
                      ...provided,
                      ...REACT_SELECT_STYLES()?.input?.(provided, props),
                      fontFamily: theme.fonts.mono,
                      "& input": {
                        font: "inherit",
                      },
                    };
                  },
                }}
                formatCreateLabel={(input: any) => `Custom: ${input}`}
                formatOptionLabel={(option: any) => {
                  const { label } = option as { label: string };

                  return CssSelectorFormattedOption({
                    label,
                    isSelected: field.value === label,
                    description: CSS_SELECTOR_DESCRIPTIONS[label],
                  });
                }}
                hideSelectedOptions
                options={[
                  {
                    label: "Common Selectors",
                    options: [
                      {
                        label: CssSelector.Image,
                        value: CssSelector.Image,
                        description: CSS_SELECTOR_DESCRIPTIONS[CssSelector.Image],
                      },
                      {
                        label: CssSelector.Anchor,
                        value: "a",
                        description: CSS_SELECTOR_DESCRIPTIONS[CssSelector.Anchor],
                      },
                      {
                        label: CssSelector.OpenGraphImage,
                        value: CssSelector.OpenGraphImage,
                        description: CSS_SELECTOR_DESCRIPTIONS[CssSelector.OpenGraphImage],
                      },
                    ] as any,
                  },
                ]}
              />
            )}
          />
          {cssSelectorError && <FormErrorMessage>{cssSelectorError}</FormErrorMessage>}
          <FormHelperText>
            Target the elements on the external page that contains the desired content. Sample CSS
            selectors are provided for common use cases, but you may also input your own.
          </FormHelperText>
        </FormControl>
      </Stack>
      <Box bg="gray.800" rounded="lg" mt={6}>
        <ExternalPropertyPreview
          externalProperties={
            !externalProperty
              ? []
              : [
                  {
                    id: externalProperty.id,
                    sourceField: externalProperty.sourceField,
                    cssSelector: externalProperty.cssSelector,
                    label: externalProperty.label,
                  },
                ]
          }
        />
      </Box>
    </Stack>
  );
};

export const ExternalPropertiesTabSection = () => {
  const { t } = useTranslation();
  const { userFeed } = useUserFeedContext();
  const { eligible, alertComponent } = useExternalPropertiesEligibility();
  const formData = useForm<FormData>({
    mode: "all",
    resolver: yupResolver(formSchema),
    defaultValues: {
      externalProperties: (userFeed?.externalProperties || []).map((i) => ({
        id: i.id,
        sourceField: i.sourceField,
        cssSelector: i.cssSelector,
        label: i.label,
      })),
    },
  });
  const { handleSubmit, control, reset } = formData;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "externalProperties",
    keyName: "idkey",
  });
  const { mutateAsync } = useUpdateUserFeed({
    queryKeyStringsToIgnoreValidation: fields.map((f) => `external-property-preview-page-${f.id}`),
  });
  const { createSuccessAlert, createErrorAlert } = usePageAlertContext();

  const onSubmit = async (data: FormData) => {
    try {
      await mutateAsync({
        feedId: userFeed.id,
        data: {
          externalProperties: data.externalProperties,
        },
      });

      reset(data);
      createSuccessAlert({
        title: "Successfully updated external properties.",
      });
    } catch (err) {
      createErrorAlert({
        title: "Failed to update external properties.",
        description: (err as Error).message,
      });
    }
  };

  return (
    <FormProvider {...formData}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={8} mb={24}>
          <Stack spacing={4}>
            <Stack>
              <Heading as="h2" size="md">
                External Properties
              </Heading>
              <Text>
                Scrape additional article properties using CSS selectors from URLs within feed
                articles that can then be used as placeholders to further customize article
                messages. Up to 10 additional placeholders can be generated per selector.
              </Text>
            </Stack>
            {!eligible ? <Box>{alertComponent}</Box> : undefined}
            <SubscriberBlockText
              feature={BlockableFeature.ArticleInjections}
              supporterTier={SupporterTier.T2}
              alternateText={`While you can use this feature, you must be a ${SupporterTier.T2} supporter to
              have this feature applied during delivery. Consider supporting MonitoRSS's free services and open-source development!`}
            />
          </Stack>
          {!!fields.length && (
            <Stack spacing={8} role="list">
              {fields?.map((a, fieldIndex) => {
                return (
                  <Box
                    role="listitem"
                    key={a.id}
                    as={motion.div}
                    exit={{
                      opacity: 0,
                    }}
                    initial={{
                      opacity: 0,
                    }}
                    animate={{
                      opacity: 1,
                    }}
                    transition={{
                      type: "linear",
                    }}
                  >
                    <ExternalPropertyForm
                      externalPropertyIndex={fieldIndex}
                      onClickDelete={() => {
                        remove(fieldIndex);
                      }}
                    />
                  </Box>
                );
              })}
            </Stack>
          )}
          <Box>
            <CreateExternalPropertyModal
              trigger={
                <Button leftIcon={<AddIcon fontSize={13} />}>
                  <span>Add new selector</span>
                </Button>
              }
              onSubmitted={(data) => {
                append({
                  id: v4(),
                  sourceField: data.sourceField,
                  label: "",
                  cssSelector: "",
                });
              }}
            />
          </Box>
        </Stack>
        <SavedUnsavedChangesPopupBar useDirtyFormCheck />
      </form>
    </FormProvider>
  );
};
