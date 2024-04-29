import {
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
} from "@chakra-ui/react";
import { AddIcon, ChevronDownIcon, ChevronUpIcon, EditIcon } from "@chakra-ui/icons";
import { InferType, array, object, string } from "yup";
import { Controller, FormProvider, useFieldArray, useForm, useFormContext } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { v4 } from "uuid";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiHelpCircle } from "react-icons/fi";
import { motion } from "framer-motion";
import { useUserFeedContext } from "../../../../contexts/UserFeedContext";
import CreateArticleInjectionModal from "./CreateExternalPropertyModal";
import {
  AnimatedComponent,
  SavedUnsavedChangesPopupBar,
  SubscriberBlockText,
} from "../../../../components";
import { useUpdateUserFeed } from "../../../feed";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { notifyError } from "../../../../utils/notifyError";
import { ExternalPropertyPreview } from "./ExternalPropertyPreview";
import { BlockableFeature, SupporterTier } from "../../../../constants";
import { useExternalPropertiesEligibility } from "./hooks/useExternalPropertiesEligibility";
import { ExternalProperty } from "../../../../types";
import UpdateExternalPropertyModal from "./UpdateExternalPropertyModal";

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

const ExternalPropertyForm = ({
  externalPropertyIndex,
  onClickDelete,
}: {
  externalPropertyIndex: number;
  onClickDelete: () => void;
}) => {
  const {
    control,
    formState: { errors },
    watch,
  } = useFormContext<FormData>();
  const externalProperty = watch(`externalProperties.${externalPropertyIndex}`);

  const sourceFieldError =
    errors?.externalProperties?.[externalPropertyIndex]?.sourceField?.message;
  const cssSelectorError =
    errors?.externalProperties?.[externalPropertyIndex]?.cssSelector?.message;
  const labelError = errors?.externalProperties?.[externalPropertyIndex]?.label?.message;

  const [showPreview, setShowPreview] = useState(false);

  const onTogglePreview = () => {
    setShowPreview((p) => !p);
  };

  return (
    <Stack
      border="solid 2px"
      borderColor="gray.600"
      bg="gray.700"
      p={[4, 4, 6]}
      rounded="lg"
      spacing={0}
      position="relative"
    >
      <CloseButton
        aria-label="Delete"
        position="absolute"
        right={2}
        top={2}
        size="sm"
        variant="ghost"
        onClick={() => onClickDelete()}
        alignSelf="flex-start"
      />
      <Stack spacing={4} flexWrap="wrap">
        <HStack>
          <FormControl isInvalid={!!sourceFieldError} isRequired>
            <FormLabel>Source Property</FormLabel>
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
                      rightIcon={<EditIcon />}
                    >
                      {field.value}
                    </Button>
                  }
                  onSubmitted={({ sourceField }) => field.onChange(sourceField)}
                />
              )}
            />
            {!sourceFieldError && (
              <FormHelperText>
                The property containing the URL that references the page with the desired content.
              </FormHelperText>
            )}
            {sourceFieldError && <FormErrorMessage>{sourceFieldError}</FormErrorMessage>}
          </FormControl>
        </HStack>
        <FormControl isInvalid={!!cssSelectorError} isRequired>
          <Flex justifyContent="space-between">
            <FormLabel>CSS Selector</FormLabel>
            <Popover>
              <PopoverTrigger>
                <Button
                  variant="link"
                  fontWeight="medium"
                  color="blue.300"
                  fontSize="sm"
                  leftIcon={<FiHelpCircle />}
                >
                  What is this?
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
            render={({ field }) => (
              <Input
                {...field}
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
              Target the elements on the external page that contains the desired content.
            </FormHelperText>
          )}
          {cssSelectorError && <FormErrorMessage>{cssSelectorError}</FormErrorMessage>}
        </FormControl>
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
          {!labelError && (
            <FormHelperText>
              A label to reference as a placeholder within connections for customizations. Must be
              unique among all selectors.
            </FormHelperText>
          )}
          {labelError && <FormErrorMessage>{labelError}</FormErrorMessage>}
        </FormControl>
      </Stack>
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
            disabled={!showPreview}
          />
        </Collapse>
      </Box>
    </Stack>
  );
};

export const ExternalPropertiesTabSection = () => {
  const { t } = useTranslation();
  const { userFeed } = useUserFeedContext();
  const { loaded, eligible, alertComponent } = useExternalPropertiesEligibility();
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
                customize messages per connection. Up to 10 external placeholders can be generated
                per selector.
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
          <AnimatedComponent>
            {fields?.map((a, fieldIndex) => {
              return (
                <Box
                  /**
                   * fields from useFieldsArray will be empty when the last element is removed, but the form state
                   * will still contain the last element due to a bug with framer motion.
                   *
                   * https://github.com/orgs/react-hook-form/discussions/11379
                   */
                  onAnimationComplete={(anim: { opacity: number }) => {
                    if (anim.opacity === 0 && fieldIndex === fields.length - 1) {
                      remove(fieldIndex);
                    }
                  }}
                  key={a.idkey}
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
          </AnimatedComponent>
          <Box>
            <CreateArticleInjectionModal
              trigger={
                <Button
                  isLoading={!loaded}
                  isDisabled={!eligible}
                  leftIcon={<AddIcon fontSize={13} />}
                >
                  Add Selector
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
