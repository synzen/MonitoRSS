import { Controller, useFormContext } from "react-hook-form";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Button,
  CloseButton,
  Code,
  Divider,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Link,
  Menu,
  MenuButton,
  MenuItem,
  MenuItemOption,
  MenuList,
  MenuOptionGroup,
  Stack,
  Text,
} from "@chakra-ui/react";
import { AddIcon, ChevronDownIcon } from "@chakra-ui/icons";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { FiMousePointer } from "react-icons/fi";
import { CustomPlaceholdersFormData } from "./constants/CustomPlaceholderFormSchema";
import { AnimatedComponent, ConfirmModal } from "../../../../components";
import { CustomPlaceholderPreview } from "./CustomPlaceholderPreview";
import { GetUserFeedArticlesInput } from "../../../feed/api";
import { CustomPlaceholderDateFormatStep, FeedConnectionType } from "../../../../types";
import { notifyError } from "../../../../utils/notifyError";
import { useGetUserFeedArticlesError } from "../../hooks";
import { AutoResizeTextarea } from "../../../../components/AutoResizeTextarea";
import { CustomPlaceholderStepType } from "../../../../constants";
import { DatePreferencesForm } from "../../../../components/DatePreferencesForm";
import { ArticlePropertySelect } from "../ArticlePropertySelect";
import { ArticleSelectDialog } from "../../../feed/components";
import { useUserFeedArticles } from "../../../feed";

interface Props {
  feedId: string;
  connectionId: string;
  index: number;
  onDelete: (index: number) => Promise<void>;
  isExpanded: boolean;
  articleFormat: GetUserFeedArticlesInput["data"]["formatter"];
  connectionType: FeedConnectionType;
}

interface StepProps {
  customPlaceholderIndex: number;
  stepIndex: number;
}

const RegexStep = ({ customPlaceholderIndex, stepIndex }: StepProps) => {
  const {
    control,
    formState: { errors },
  } = useFormContext<CustomPlaceholdersFormData>();

  const regexSearchError = (
    errors?.customPlaceholders?.[customPlaceholderIndex]?.steps?.[stepIndex] as {
      regexSearch?: { message?: string };
    }
  )?.regexSearch;
  const replacementStringError = (
    errors?.customPlaceholders?.[customPlaceholderIndex]?.steps?.[stepIndex] as {
      replacementString?: { message?: string };
    }
  )?.replacementString;
  const regexFlagsError = (
    errors?.customPlaceholders?.[customPlaceholderIndex]?.steps?.[stepIndex] as {
      regexSearchFlags?: { message?: string };
    }
  )?.regexSearchFlags;

  return (
    <Stack flex={1} spacing={4}>
      <HStack alignItems="flex-start">
        <FormControl isInvalid={!!regexSearchError} flexGrow={1}>
          <FormLabel variant="inline">Search</FormLabel>
          <Controller
            name={`customPlaceholders.${customPlaceholderIndex}.steps.${stepIndex}.regexSearch`}
            control={control}
            render={({ field }) => {
              return (
                <Input
                  bg="gray.800"
                  size="sm"
                  fontFamily="mono"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  autoComplete="off"
                  {...field}
                  value={field.value.replaceAll("\n", "\\n") || ""}
                />
              );
            }}
          />
          {!regexSearchError && (
            <FormHelperText>
              The regular expression to find the text of interest. For more information on your
              regular expressions, you may visit{" "}
              <Link
                color="blue.300"
                target="_blank"
                rel="noopener noreferrer"
                href="https://regex101.com/"
              >
                https://regex101.com/
              </Link>{" "}
              (be sure to select the JavaScript flavor).
            </FormHelperText>
          )}
          {regexSearchError && <FormErrorMessage>{regexSearchError.message}</FormErrorMessage>}
        </FormControl>
        <FormControl flex={0}>
          <FormLabel variant="inline">Flags</FormLabel>
          <Controller
            name={`customPlaceholders.${customPlaceholderIndex}.steps.${stepIndex}.regexSearchFlags`}
            control={control}
            render={({ field }) => {
              return (
                <Menu closeOnSelect={false}>
                  <MenuButton as={Button} size="sm" bg="gray.800" rightIcon={<ChevronDownIcon />}>
                    {field.value || "/"}
                  </MenuButton>
                  <MenuList minWidth="240px">
                    <MenuOptionGroup
                      type="checkbox"
                      onChange={(val) => {
                        if (val instanceof Array) {
                          field.onChange(val.join(""));
                        }
                      }}
                      value={field.value?.split("")}
                    >
                      <MenuItemOption value="g">
                        <Box>
                          <Text>global</Text>
                          <Text color="whiteAlpha.600">
                            Don&apos;t return after the first match
                          </Text>
                        </Box>
                      </MenuItemOption>
                      <MenuItemOption value="i">
                        <Text>case insensitive</Text>
                        <Text color="whiteAlpha.600">Case insensitive match</Text>
                      </MenuItemOption>
                      <MenuItemOption value="m">
                        <Text>multiline</Text>
                        <Text color="whiteAlpha.600">^ and $ match start/end of line</Text>
                      </MenuItemOption>
                    </MenuOptionGroup>
                  </MenuList>
                </Menu>
              );
            }}
          />
          {regexFlagsError && <FormErrorMessage>{regexFlagsError.message}</FormErrorMessage>}
        </FormControl>
      </HStack>
      <FormControl isInvalid={!!replacementStringError}>
        <FormLabel variant="inline">Replacement</FormLabel>
        <Controller
          name={`customPlaceholders.${customPlaceholderIndex}.steps.${stepIndex}.replacementString`}
          control={control}
          render={({ field }) => {
            return (
              <AutoResizeTextarea
                fontFamily="mono"
                size="sm"
                bg="gray.800"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                autoComplete="off"
                {...field}
                value={field.value || ""}
              />
            );
          }}
        />
        {!replacementStringError && (
          <FormHelperText>
            The string to replace the matched text with. If empty, the matched content will be
            removed from the placeholder. If you want to extract content, You may use{" "}
            <Code>$1</Code>, <Code>$2</Code>, etc. to reference the matched groups indicated via
            parenthesis in your regex search.
          </FormHelperText>
        )}
        {replacementStringError && (
          <FormErrorMessage>{replacementStringError.message}</FormErrorMessage>
        )}
      </FormControl>
    </Stack>
  );
};

const UrlEncodeStep = (_: StepProps) => {
  return (
    <Stack flex={1} spacing={4}>
      <Text color="whiteAlpha.700">No options are available for this type of step</Text>
    </Stack>
  );
};

const DateFormatStep = ({ customPlaceholderIndex, stepIndex }: StepProps) => {
  const {
    control,
    formState: { errors },
  } = useFormContext<CustomPlaceholdersFormData>();

  const timezoneError = (
    errors?.customPlaceholders?.[customPlaceholderIndex]?.steps?.[stepIndex] as {
      timezone?: { message?: string };
    }
  )?.timezone;
  const formatError = (
    errors?.customPlaceholders?.[customPlaceholderIndex]?.steps?.[stepIndex] as {
      format?: { message?: string };
    }
  )?.format;

  return (
    <Stack flex={1} spacing={4} width="100%">
      <Controller
        name={`customPlaceholders.${customPlaceholderIndex}.steps.${stepIndex}`}
        control={control}
        render={({ field }) => {
          const dateFormatStep = field.value as CustomPlaceholderDateFormatStep;
          let isInvalidTimezone = false;

          try {
            dayjs().tz(dateFormatStep.timezone);
          } catch (err) {
            isInvalidTimezone = true;
          }

          return (
            <DatePreferencesForm
              size="sm"
              disablePreview
              requiredFields={["format"]}
              errors={{
                timezone: isInvalidTimezone ? "Invalid timezone" : timezoneError?.message,
                format: formatError?.message,
              }}
              values={{
                format: dateFormatStep.format,
                locale: dateFormatStep.locale,
                timezone: dateFormatStep.timezone,
              }}
              onChange={(values) => {
                field.onChange({
                  ...field.value,
                  format: values.format,
                  locale: values.locale,
                  timezone: values.timezone,
                });
              }}
            />
          );
        }}
      />
    </Stack>
  );
};

export const CustomPlaceholderForm = ({
  feedId,
  connectionId,
  index,
  onDelete,
  isExpanded,
  connectionType,
  articleFormat,
}: Props) => {
  const { t } = useTranslation();
  const {
    control,
    formState: { errors },
    setValue,
    watch,
  } = useFormContext<CustomPlaceholdersFormData>();
  const [customPlaceholder, steps] = watch([
    `customPlaceholders.${index}`,
    `customPlaceholders.${index}.steps`,
  ]);
  const [selectedArticleId, setSelectedArticleId] = useState<string | undefined>();
  const {
    data: dataUserFeedArticles,
    refetch: refetchUserFeedArticles,
    fetchStatus: fetchStatusUserFeedArticles,
    status: statusUserFeedArticles,
  } = useUserFeedArticles({
    feedId,
    disabled: !isExpanded || !customPlaceholder.sourcePlaceholder,
    data: {
      limit: 1,
      skip: 0,
      selectProperties: [customPlaceholder.sourcePlaceholder],
      random: true,
      formatter: {
        ...articleFormat,
        customPlaceholders: [],
      },
      filters: {
        articleId: selectedArticleId,
      },
    },
  });

  const { hasAlert: hasArticlesAlert, messageRef: userFeedArticlesMessage } =
    useGetUserFeedArticlesError({
      getUserFeedArticlesOutput: dataUserFeedArticles as never,
      getUserFeedArticlesStatus: statusUserFeedArticles,
    });
  const firstArticleId = dataUserFeedArticles?.result?.articles?.[0]?.id;

  useEffect(() => {
    if (!selectedArticleId && firstArticleId) {
      setSelectedArticleId(firstArticleId);
    }
  }, [firstArticleId, selectedArticleId]);

  const isNewField = !!customPlaceholder.isNew;

  const onClickDeleteCustomPlaceholder = async () => {
    await onDelete(index);
  };

  const onClickRandomFeedArticle = async () => {
    try {
      setSelectedArticleId(undefined);
      await refetchUserFeedArticles();
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  const referenceNameError = errors?.customPlaceholders?.[index]?.referenceName;
  const sourcePlaceholderError = errors?.customPlaceholders?.[index]?.sourcePlaceholder;
  const hasStepsError = errors?.customPlaceholders?.[index]?.steps;

  const isNewAndIncompletePlaceholder =
    isNewField && (!customPlaceholder.referenceName || !customPlaceholder.sourcePlaceholder);

  return (
    <Stack background="gray.700" p={4} spacing={4} rounded="lg">
      <FormControl isInvalid={!!referenceNameError}>
        <FormLabel variant="inline">Reference Name</FormLabel>
        <Controller
          name={`customPlaceholders.${index}.referenceName`}
          control={control}
          defaultValue=""
          render={({ field }) => (
            <Input
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              autoComplete="off"
              bg="gray.800"
              {...field}
              value={field.value || ""}
            />
          )}
        />
        {!referenceNameError && (
          <FormHelperText>
            The reference name for this custom placeholder. For example, if the reference name is{" "}
            <Code>mytitle</Code>, then the placeholder to use into your custom message contente will
            be <Code>{`{{custom::mytitle}}`}</Code>.
          </FormHelperText>
        )}
        {referenceNameError && <FormErrorMessage>{referenceNameError.message}</FormErrorMessage>}
      </FormControl>
      <FormControl isInvalid={!!sourcePlaceholderError}>
        <FormLabel variant="inline">Source Placeholder</FormLabel>
        {userFeedArticlesMessage && (
          <Alert status="error" mb={2} rounded="lg">
            <AlertTitle>Failed to load placeholders</AlertTitle>
            <AlertDescription>{userFeedArticlesMessage}</AlertDescription>
          </Alert>
        )}
        <Controller
          name={`customPlaceholders.${index}.sourcePlaceholder`}
          control={control}
          defaultValue=""
          render={({ field }) => (
            <ArticlePropertySelect
              feedId={feedId}
              // selectProps={{ ...field, bg: "gray.800" }}
              value={field.value || ""}
              onChange={(val) => {
                field.onChange(val);
              }}
              articleFormatter={{
                ...articleFormat,
                // Don't show custom placeholders in the list of available properties
                customPlaceholders: [],
              }}
            />
          )}
        />
        {!sourcePlaceholderError && (
          <FormHelperText>The placeholder where the content should originate from.</FormHelperText>
        )}
        {sourcePlaceholderError && (
          <FormErrorMessage>{sourcePlaceholderError.message}</FormErrorMessage>
        )}
      </FormControl>
      <FormControl isInvalid={!!hasStepsError}>
        <FormLabel variant="inline">Steps</FormLabel>
        <FormHelperText pb={2}>
          The steps to apply in sequence to the content of the source placeholder. The final result
          will be the content of the custom placeholder. At least 1 step must be defined.
        </FormHelperText>
        {isNewAndIncompletePlaceholder && (
          <Alert>
            <AlertDescription>
              Input a reference name and source placeholder to start adding steps
            </AlertDescription>
          </Alert>
        )}
        {!isNewAndIncompletePlaceholder && (
          <Stack>
            <Box>
              <Stack width="100%">
                {userFeedArticlesMessage && (
                  <Alert status="error" mb={2} rounded="lg">
                    <AlertTitle>Failed to load placeholder preview</AlertTitle>
                    <AlertDescription>{userFeedArticlesMessage}</AlertDescription>
                  </Alert>
                )}
                <ArticleSelectDialog
                  singleProperty={customPlaceholder.sourcePlaceholder}
                  trigger={
                    <Button
                      size="sm"
                      width="min-content"
                      leftIcon={<FiMousePointer />}
                      isLoading={fetchStatusUserFeedArticles === "fetching"}
                      isDisabled={fetchStatusUserFeedArticles === "fetching" || hasArticlesAlert}
                    >
                      Select preview placeholder content
                    </Button>
                  }
                  feedId={feedId}
                  articleFormatter={articleFormat}
                  onArticleSelected={setSelectedArticleId}
                  onClickRandomArticle={onClickRandomFeedArticle}
                />
                <Text fontSize={12} color="whiteAlpha.700">
                  Preview Input
                </Text>
                <CustomPlaceholderPreview
                  articleFormat={articleFormat}
                  connectionId={connectionId}
                  connectionType={connectionType}
                  customPlaceholder={customPlaceholder}
                  feedId={feedId}
                  stepIndex={0}
                  selectedArticleId={selectedArticleId}
                />
              </Stack>
              <Flex justifyContent="center" py={2}>
                <ChevronDownIcon fontSize={24} />
              </Flex>
              <AnimatedComponent>
                {steps.map((step, stepIndex) => {
                  const props: StepProps = {
                    customPlaceholderIndex: index,
                    stepIndex,
                  };

                  return (
                    <Stack key={step.id}>
                      <Box
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
                      >
                        <Stack
                          borderStyle="solid"
                          borderWidth="2px"
                          borderColor="whiteAlpha.300"
                          paddingX={5}
                          paddingY={5}
                          rounded="lg"
                          // mb={1}
                          alignItems="flex-start"
                        >
                          <HStack justifyContent="space-between" width="100%">
                            <Box>
                              <Text fontWeight={600}>
                                {!step.type ||
                                  (step.type === CustomPlaceholderStepType.Regex &&
                                    "Regex Replace")}
                                {step.type === CustomPlaceholderStepType.UrlEncode && "URL Encode"}
                                {step.type === CustomPlaceholderStepType.DateFormat &&
                                  "Date Format"}
                              </Text>
                              {step.type === CustomPlaceholderStepType.DateFormat && (
                                <Text fontSize={12} color="whiteAlpha.700">
                                  If the input date is not in a readable format for a particular
                                  article, or an invalid timezone is specified, there will be an
                                  empty output.
                                </Text>
                              )}
                            </Box>
                            <CloseButton
                              size="sm"
                              isDisabled={steps.length === 1}
                              onClick={() => {
                                setValue(
                                  `customPlaceholders.${index}.steps`,
                                  steps.filter((_, i) => i !== stepIndex),
                                  {
                                    shouldDirty: true,
                                    shouldTouch: true,
                                    shouldValidate: true,
                                  }
                                );
                              }}
                            />
                          </HStack>
                          <Divider mb={2} />
                          {!step.type ||
                            (step.type === CustomPlaceholderStepType.Regex && (
                              <RegexStep key={step.id} {...props} />
                            ))}
                          {step.type === CustomPlaceholderStepType.UrlEncode && (
                            <UrlEncodeStep key={step.id} {...props} />
                          )}
                          {step.type === CustomPlaceholderStepType.DateFormat && (
                            <DateFormatStep key={step.id} {...props} />
                          )}
                        </Stack>
                        <Flex justifyContent="center" py={2}>
                          <ChevronDownIcon fontSize={24} />
                        </Flex>
                        <Stack>
                          {stepIndex === steps.length - 1 && (
                            <Text fontSize={12} color="whiteAlpha.700">
                              Final Output
                            </Text>
                          )}
                          {/** Debouncing values works at the upper level, but not here does not work for some reason... */}
                          <CustomPlaceholderPreview
                            articleFormat={articleFormat}
                            feedId={feedId}
                            connectionId={connectionId}
                            connectionType={connectionType}
                            customPlaceholder={customPlaceholder}
                            selectedArticleId={selectedArticleId}
                            stepIndex={stepIndex + 1}
                          />
                        </Stack>
                        <Flex
                          justifyContent="center"
                          opacity={stepIndex < steps.length - 1 ? 1 : 0}
                          py={2}
                        >
                          <ChevronDownIcon fontSize={24} />
                        </Flex>
                      </Box>
                    </Stack>
                  );
                })}
              </AnimatedComponent>
            </Box>
            <Flex justifyContent={steps.length > 0 ? "center" : "flex-start"} width="100%">
              <Menu>
                <MenuButton
                  as={Button}
                  width="min-content"
                  size="sm"
                  variant="outline"
                  mt={-4}
                  leftIcon={<AddIcon fontSize={13} />}
                  rightIcon={
                    <HStack>
                      <Divider />
                      <ChevronDownIcon />
                    </HStack>
                  }
                >
                  Add step
                </MenuButton>
                <MenuList>
                  <MenuItem
                    onClick={() => {
                      setValue(
                        `customPlaceholders.${index}.steps`,
                        steps.concat({
                          id: uuidv4(),
                          type: CustomPlaceholderStepType.Regex,
                          regexSearch: "",
                          replacementString: "",
                        })
                      );
                    }}
                  >
                    <Box>
                      <Text display="block">Regex Replace</Text>
                      <Text color="whiteAlpha.600" display="block" fontSize="sm">
                        Replace or extract text using regular expressions.
                      </Text>
                    </Box>
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setValue(
                        `customPlaceholders.${index}.steps`,
                        steps.concat({
                          id: uuidv4(),
                          type: CustomPlaceholderStepType.UrlEncode,
                        })
                      );
                    }}
                  >
                    <Box>
                      <Text display="block">URL Encode</Text>
                      <Text color="whiteAlpha.600" display="block" fontSize="sm">
                        URL-encode the input.
                      </Text>
                    </Box>
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setValue(
                        `customPlaceholders.${index}.steps`,
                        steps.concat({
                          id: uuidv4(),
                          type: CustomPlaceholderStepType.DateFormat,
                          format: "YYYY-MM-DDTHH:mm:ssZ",
                        })
                      );
                    }}
                  >
                    <Box>
                      <Text display="block">Date Format</Text>
                      <Text color="whiteAlpha.600" display="block" fontSize="sm">
                        Format text as a date. Input must be in a valid date form.
                      </Text>
                    </Box>
                  </MenuItem>
                </MenuList>
              </Menu>
            </Flex>
          </Stack>
        )}
      </FormControl>
      <Divider my={2} />
      <Flex justifyContent="space-between">
        <Box>
          {!isNewField && (
            <ConfirmModal
              onConfirm={onClickDeleteCustomPlaceholder}
              description="Are you sure you want to delete this custom placeholder?"
              title="Delete Custom Placeholder"
              colorScheme="red"
              okText="Delete"
              trigger={
                <Button variant="outline" colorScheme="red">
                  Delete
                </Button>
              }
            />
          )}
          {isNewField && (
            <Button variant="outline" colorScheme="red" onClick={onClickDeleteCustomPlaceholder}>
              Delete
            </Button>
          )}
        </Box>
      </Flex>
    </Stack>
  );
};
