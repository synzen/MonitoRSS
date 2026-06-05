import { Controller, useFormContext } from "react-hook-form";
import {
  Box,
  Button,
  Code,
  Flex,
  HStack,
  IconButton,
  Input,
  Link,
  Separator,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { FaPlus, FaChevronDown } from "react-icons/fa6";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { v4 as uuidv4 } from "uuid";
import dayjs from "dayjs";
import { FiMousePointer, FiChevronUp, FiChevronDown } from "react-icons/fi";
import { CustomPlaceholdersFormData } from "./constants/CustomPlaceholderFormSchema";
import { AnimatedComponent, ConfirmModal, DestructiveActionButton } from "@/components";
import { SafeLoadingButton } from "@/components/SafeLoadingButton";
import { CustomPlaceholderPreview } from "./CustomPlaceholderPreview";
import { CustomPlaceholderDateFormatStep } from "@/types/CustomPlaceholder";
import { useGetUserFeedArticlesError } from "../../hooks";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";
import { Panel } from "@/components/Panel";
import { CustomPlaceholderStepType } from "@/constants";
import {
  DatePreferencesForm,
  useUserFeedConnectionContext,
  ArticleSelectDialog,
  useUserFeedArticles,
} from "@/features/feed";
import { ArticlePropertySelect } from "../ArticlePropertySelect";
import { useUserMe } from "@/features/discordUser";

import { notifyInfo } from "@/utils/notifyInfo";
import { usePageAlertContext } from "@/contexts/PageAlertContext";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import {
  MenuRoot,
  MenuTrigger,
  MenuContent,
  MenuCheckboxItem,
  MenuItem,
} from "@/components/ui/menu";

interface Props {
  index: number;
  onDelete: (index: number) => Promise<void>;
  isExpanded: boolean;
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
    <Stack flex={1} gap={4}>
      <HStack alignItems="flex-start">
        <Field
          invalid={!!regexSearchError}
          flexGrow={1}
          label={<chakra.span fontWeight="medium">Search</chakra.span>}
          errorText={regexSearchError?.message}
          helperText={
            !regexSearchError ? (
              <>
                The regular expression to find the text of interest. For more information on your
                regular expressions, you may visit{" "}
                <Link
                  color="text.link"
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://regex101.com/"
                >
                  https://regex101.com/
                </Link>{" "}
                (be sure to select the JavaScript flavor).
              </>
            ) : undefined
          }
        >
          <Controller
            name={`customPlaceholders.${customPlaceholderIndex}.steps.${stepIndex}.regexSearch`}
            control={control}
            render={({ field }) => {
              return (
                <Input
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
        </Field>
        <Field
          flex={0}
          label={
            <chakra.span fontWeight="medium" whiteSpace="nowrap">
              Regex Flags
            </chakra.span>
          }
          errorText={regexFlagsError?.message}
          invalid={!!regexFlagsError}
        >
          <Controller
            name={`customPlaceholders.${customPlaceholderIndex}.steps.${stepIndex}.regexSearchFlags`}
            control={control}
            render={({ field }) => {
              const flagValues = field.value?.split("") || [];

              const toggleFlag = (flag: string) => {
                const current = field.value?.split("") || [];

                if (current.includes(flag)) {
                  field.onChange(current.filter((f) => f !== flag).join(""));
                } else {
                  field.onChange([...current, flag].join(""));
                }
              };

              return (
                <MenuRoot closeOnSelect={false}>
                  <MenuTrigger asChild>
                    <Button size="sm" variant="outline" aria-label="Regex Flags">
                      {field.value || "/"}
                      <FaChevronDown />
                    </Button>
                  </MenuTrigger>
                  <MenuContent minWidth="240px">
                    <MenuCheckboxItem
                      value="g"
                      checked={flagValues.includes("g")}
                      onCheckedChange={() => toggleFlag("g")}
                    >
                      <Box>
                        <Text>
                          <chakra.strong color="text.link">g</chakra.strong>lobal
                        </Text>
                        <Text color="fg.muted">Don&apos;t return after the first match</Text>
                      </Box>
                    </MenuCheckboxItem>
                    <MenuCheckboxItem
                      value="i"
                      checked={flagValues.includes("i")}
                      onCheckedChange={() => toggleFlag("i")}
                    >
                      <Text>
                        case <chakra.strong color="text.link">i</chakra.strong>nsensitive
                      </Text>
                      <Text color="fg.muted">Case insensitive match</Text>
                    </MenuCheckboxItem>
                    <MenuCheckboxItem
                      value="m"
                      checked={flagValues.includes("m")}
                      onCheckedChange={() => toggleFlag("m")}
                    >
                      <Text>
                        <chakra.strong color="text.link">m</chakra.strong>ultiline
                      </Text>
                      <Text color="fg.muted">^ and $ match start/end of line</Text>
                    </MenuCheckboxItem>
                    <MenuCheckboxItem
                      value="y"
                      checked={flagValues.includes("y")}
                      onCheckedChange={() => toggleFlag("y")}
                    >
                      <Text>
                        stick<chakra.strong color="text.link">y</chakra.strong>
                      </Text>
                      <Text color="fg.muted">
                        Anchor to start of pattern, or at the end of the most recent match
                      </Text>
                    </MenuCheckboxItem>
                    <MenuCheckboxItem
                      value="v"
                      checked={flagValues.includes("v")}
                      onCheckedChange={() => toggleFlag("v")}
                    >
                      <Text>
                        <chakra.strong color="text.link">v</chakra.strong>nicode
                      </Text>
                      <Text color="fg.muted">Enable all unicode and character set features</Text>
                    </MenuCheckboxItem>
                    <MenuCheckboxItem
                      value="s"
                      checked={flagValues.includes("s")}
                      onCheckedChange={() => toggleFlag("s")}
                    >
                      <Text>
                        <chakra.strong color="text.link">s</chakra.strong>ingle line
                      </Text>
                      <Text color="fg.muted">Dot matches newline</Text>
                    </MenuCheckboxItem>
                    <MenuCheckboxItem
                      value="d"
                      checked={flagValues.includes("d")}
                      onCheckedChange={() => toggleFlag("d")}
                    >
                      <Text>
                        in<chakra.strong color="text.link">d</chakra.strong>ices
                      </Text>
                      <Text color="fg.muted">The regex engine returns match indices</Text>
                    </MenuCheckboxItem>
                  </MenuContent>
                </MenuRoot>
              );
            }}
          />
        </Field>
      </HStack>
      <Field
        invalid={!!replacementStringError}
        label={<chakra.span fontWeight="medium">Replacement</chakra.span>}
        errorText={replacementStringError?.message}
        helperText={
          !replacementStringError ? (
            <>
              The string to replace the matched text with. If empty, the matched content will be
              removed from the placeholder. If you want to extract content, You may use{" "}
              <Code>$1</Code>, <Code>$2</Code>, etc. to reference the matched groups indicated via
              parenthesis in your regex search.
            </>
          ) : undefined
        }
      >
        <Controller
          name={`customPlaceholders.${customPlaceholderIndex}.steps.${stepIndex}.replacementString`}
          control={control}
          render={({ field }) => {
            return (
              <AutoResizeTextarea
                fontFamily="mono"
                size="sm"
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
      </Field>
    </Stack>
  );
};

const NoOptionsAvailableStep = (_: StepProps) => {
  return (
    <Stack flex={1} gap={4}>
      <Text color="fg.muted">No options are available for this type of step</Text>
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
    <Stack flex={1} gap={4} width="100%">
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

export const CustomPlaceholderForm = ({ index, onDelete, isExpanded }: Props) => {
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
  const { userFeed, articleFormatOptions } = useUserFeedConnectionContext();
  const [selectedArticleId, setSelectedArticleId] = useState<string | undefined>();
  const {
    data: dataUserFeedArticles,
    refetch: refetchUserFeedArticles,
    fetchStatus: fetchStatusUserFeedArticles,
    status: statusUserFeedArticles,
  } = useUserFeedArticles({
    feedId: userFeed.id,
    disabled: !isExpanded || !customPlaceholder.sourcePlaceholder,
    data: {
      limit: 1,
      skip: 0,
      selectProperties: [customPlaceholder.sourcePlaceholder],
      random: true,
      formatOptions: articleFormatOptions,
      filters: {
        articleId: selectedArticleId,
      },
    },
  });
  const { createErrorAlert } = usePageAlertContext();

  const { data: userMeData } = useUserMe();

  const preferredFormat = userMeData?.result.preferences.dateFormat;
  const preferredTimezone = userMeData?.result.preferences.dateTimezone;
  const preferedLocale = userMeData?.result.preferences.dateLocale;

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
      createErrorAlert({
        title: "Failed to fetch random article.",
        description: (err as Error).message,
      });
    }
  };

  const moveStepUp = (stepIndex: number) => {
    if (stepIndex === 0) return;
    const newSteps = [...steps];
    [newSteps[stepIndex - 1], newSteps[stepIndex]] = [newSteps[stepIndex], newSteps[stepIndex - 1]];
    setValue(`customPlaceholders.${index}.steps`, newSteps, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const moveStepDown = (stepIndex: number) => {
    if (stepIndex === steps.length - 1) return;
    const newSteps = [...steps];
    [newSteps[stepIndex], newSteps[stepIndex + 1]] = [newSteps[stepIndex + 1], newSteps[stepIndex]];
    setValue(`customPlaceholders.${index}.steps`, newSteps, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const referenceNameError = errors?.customPlaceholders?.[index]?.referenceName;
  const sourcePlaceholderError = errors?.customPlaceholders?.[index]?.sourcePlaceholder;
  const hasStepsError = errors?.customPlaceholders?.[index]?.steps;

  const isNewAndIncompletePlaceholder =
    isNewField && (!customPlaceholder.referenceName || !customPlaceholder.sourcePlaceholder);

  return (
    <Panel display="flex" flexDirection="column" p={4} gap={4} rounded="lg">
      <Field
        invalid={!!referenceNameError}
        required
        label={<chakra.span fontWeight="medium">Reference Name</chakra.span>}
        errorText={referenceNameError?.message}
        helperText={
          <>
            The reference name for this custom placeholder. For example, if the reference name is{" "}
            <Code>mytitle</Code>, then the placeholder to use into your custom message contente will
            be <Code>{`{{custom::mytitle}}`}</Code>.
          </>
        }
      >
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
              {...field}
              value={field.value || ""}
              ref={null}
            />
          )}
        />
      </Field>
      <Field
        invalid={!!sourcePlaceholderError}
        required
        label={
          <chakra.span fontWeight="medium" id="source-placeholder-label">
            Source Placeholder
          </chakra.span>
        }
        errorText={sourcePlaceholderError?.message}
        helperText="The placeholder where the content should originate from."
      >
        {userFeedArticlesMessage && (
          <Alert status="error" mb={2} rounded="lg" title="Failed to load placeholders">
            {userFeedArticlesMessage}
          </Alert>
        )}
        <Controller
          name={`customPlaceholders.${index}.sourcePlaceholder`}
          control={control}
          defaultValue=""
          render={({ field }) => (
            <ArticlePropertySelect
              value={field.value || ""}
              onChange={(val) => {
                field.onChange(val);
              }}
              customPlaceholders={[]}
              ariaLabelledBy="source-placeholder-label"
              inputId="source-placeholder-select"
              isRequired
              isInvalid={!!sourcePlaceholderError}
            />
          )}
        />
      </Field>
      <Field
        invalid={!!hasStepsError}
        label={<chakra.span fontWeight="medium">Transformation Steps</chakra.span>}
      >
        <Text color="inherit" fontSize="sm" mb={2}>
          The steps to apply in sequence to the content of the source placeholder. The final result
          will be the content of the custom placeholder. At least 1 step must be defined.
        </Text>
        {isNewAndIncompletePlaceholder && (
          <Alert role={undefined}>
            Input a reference name and source placeholder to start adding steps
          </Alert>
        )}
        {!isNewAndIncompletePlaceholder && (
          <Stack>
            <Box>
              <Stack width="100%">
                {userFeedArticlesMessage && (
                  <Alert
                    status="error"
                    mb={2}
                    rounded="lg"
                    title="Failed to load placeholder preview"
                  >
                    {userFeedArticlesMessage}
                  </Alert>
                )}
                <ArticleSelectDialog
                  singleProperty={customPlaceholder.sourcePlaceholder}
                  trigger={
                    <SafeLoadingButton
                      size="sm"
                      width="min-content"
                      loading={fetchStatusUserFeedArticles === "fetching"}
                      aria-disabled={fetchStatusUserFeedArticles === "fetching" || hasArticlesAlert}
                    >
                      <FiMousePointer />
                      <span>Select preview placeholder content</span>
                    </SafeLoadingButton>
                  }
                  feedId={userFeed.id}
                  onArticleSelected={setSelectedArticleId}
                  onClickRandomArticle={onClickRandomFeedArticle}
                  articleFormatOptions={articleFormatOptions}
                />
                <Text fontSize={12} color="fg.muted">
                  Preview Input
                </Text>
                <CustomPlaceholderPreview
                  customPlaceholder={{ ...customPlaceholder, steps: [] }}
                  stepIndex={0}
                  selectedArticleId={selectedArticleId}
                />
              </Stack>
              <Flex justifyContent="center" py={2}>
                <FaChevronDown fontSize={24} />
              </Flex>
              <AnimatedComponent>
                {steps.map((step, stepIndex) => {
                  const props: StepProps = {
                    customPlaceholderIndex: index,
                    stepIndex,
                  };

                  return (
                    <Stack key={step.id}>
                      <motion.div
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
                          borderColor="border"
                          paddingX={5}
                          paddingY={5}
                          rounded="lg"
                          // mb={1}
                          alignItems="flex-start"
                        >
                          <Flex justifyContent="space-between" width="100%" flexWrap="wrap" gap={2}>
                            <Box flex="1" minW="200px">
                              <Text fontWeight={600}>
                                Transformation Step:{" "}
                                {!step.type ||
                                  (step.type === CustomPlaceholderStepType.Regex &&
                                    "Regex Replace")}
                                {step.type === CustomPlaceholderStepType.UrlEncode && "URL Encode"}
                                {step.type === CustomPlaceholderStepType.Uppercase && "Uppercase"}
                                {step.type === CustomPlaceholderStepType.Lowercase && "Lowercase"}
                                {step.type === CustomPlaceholderStepType.DateFormat &&
                                  "Date Format"}
                              </Text>
                              {step.type === CustomPlaceholderStepType.DateFormat && (
                                <Text fontSize={12} color="fg.muted">
                                  For the most accurate result, ensure the input date complies with
                                  the{" "}
                                  <Link
                                    color="text.link"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    href="https://simple.wikipedia.org/wiki/ISO_8601"
                                  >
                                    ISO 8601
                                  </Link>{" "}
                                  standard. If the input date is not in a readable format for a
                                  particular article, or an invalid timezone is specified, there
                                  will be an empty output.
                                </Text>
                              )}
                            </Box>
                            <HStack flexShrink={0}>
                              <IconButton
                                aria-label="Move step up"
                                size="sm"
                                variant="ghost"
                                disabled={stepIndex === 0}
                                onClick={() => moveStepUp(stepIndex)}
                              >
                                <FiChevronUp />
                              </IconButton>
                              <IconButton
                                aria-label="Move step down"
                                size="sm"
                                variant="ghost"
                                disabled={stepIndex === steps.length - 1}
                                onClick={() => moveStepDown(stepIndex)}
                              >
                                <FiChevronDown />
                              </IconButton>
                              <Button
                                colorPalette="red"
                                size="sm"
                                variant="ghost"
                                aria-disabled={steps.length === 1}
                                onClick={() => {
                                  if (steps.length === 1) {
                                    notifyInfo("At least one transformation step is required");

                                    return;
                                  }

                                  setValue(
                                    `customPlaceholders.${index}.steps`,
                                    steps.filter((_, i) => i !== stepIndex),
                                    {
                                      shouldDirty: true,
                                      shouldTouch: true,
                                      shouldValidate: true,
                                    },
                                  );
                                }}
                              >
                                Delete Step
                              </Button>
                            </HStack>
                          </Flex>
                          <Separator mb={2} />
                          {!step.type ||
                            (step.type === CustomPlaceholderStepType.Regex && (
                              <RegexStep key={step.id} {...props} />
                            ))}
                          {step.type === CustomPlaceholderStepType.UrlEncode && (
                            <NoOptionsAvailableStep key={step.id} {...props} />
                          )}
                          {step.type === CustomPlaceholderStepType.Uppercase && (
                            <NoOptionsAvailableStep key={step.id} {...props} />
                          )}
                          {step.type === CustomPlaceholderStepType.Lowercase && (
                            <NoOptionsAvailableStep key={step.id} {...props} />
                          )}
                          {step.type === CustomPlaceholderStepType.DateFormat && (
                            <DateFormatStep key={step.id} {...props} />
                          )}
                        </Stack>
                        <Flex justifyContent="center" py={2}>
                          <FaChevronDown fontSize={24} />
                        </Flex>
                        <Stack>
                          {stepIndex === steps.length - 1 && (
                            <Text fontSize={12} color="fg.muted">
                              Final Output
                            </Text>
                          )}
                          {/** Debouncing values works at the upper level, but not here does not work for some reason... */}
                          <CustomPlaceholderPreview
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
                          <FaChevronDown fontSize={24} />
                        </Flex>
                      </motion.div>
                    </Stack>
                  );
                })}
              </AnimatedComponent>
            </Box>
            <Flex justifyContent={steps.length > 0 ? "center" : "flex-start"} width="100%">
              <MenuRoot>
                <MenuTrigger asChild>
                  <Button width="min-content" size="sm" variant="outline" mt={-4}>
                    <FaPlus fontSize={13} />
                    Add step
                    <HStack>
                      <Separator />
                      <FaChevronDown />
                    </HStack>
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem
                    value="regex"
                    onClick={() => {
                      setValue(
                        `customPlaceholders.${index}.steps`,
                        steps.concat({
                          id: uuidv4(),
                          type: CustomPlaceholderStepType.Regex,
                          regexSearch: "",
                          replacementString: "",
                        }),
                      );
                    }}
                  >
                    <Box>
                      <Text display="block">Regex Replace</Text>
                      <Text color="fg.muted" display="block" fontSize="sm">
                        Replace or extract text using regular expressions.
                      </Text>
                    </Box>
                  </MenuItem>
                  <MenuItem
                    value="dateformat"
                    onClick={() => {
                      setValue(
                        `customPlaceholders.${index}.steps`,
                        steps.concat({
                          id: uuidv4(),
                          type: CustomPlaceholderStepType.DateFormat,
                          format: preferredFormat || "YYYY-MM-DDTHH:mm:ssZ",
                          locale: preferedLocale || undefined,
                          timezone: preferredTimezone || undefined,
                        }),
                      );
                    }}
                  >
                    <Box>
                      <Text display="block">Date Format</Text>
                      <Text color="fg.muted" display="block" fontSize="sm">
                        Format text as a date. Input must be in a valid date form.
                      </Text>
                    </Box>
                  </MenuItem>
                  <MenuItem
                    value="urlencode"
                    onClick={() => {
                      setValue(
                        `customPlaceholders.${index}.steps`,
                        steps.concat({
                          id: uuidv4(),
                          type: CustomPlaceholderStepType.UrlEncode,
                        }),
                      );
                    }}
                  >
                    <Box>
                      <Text display="block">URL Encode</Text>
                      <Text color="fg.muted" display="block" fontSize="sm">
                        URL-encode the input.
                      </Text>
                    </Box>
                  </MenuItem>
                  <MenuItem
                    value="uppercase"
                    onClick={() => {
                      setValue(
                        `customPlaceholders.${index}.steps`,
                        steps.concat({
                          id: uuidv4(),
                          type: CustomPlaceholderStepType.Uppercase,
                        }),
                      );
                    }}
                  >
                    <Box>
                      <Text display="block">Uppercase</Text>
                      <Text color="fg.muted" display="block" fontSize="sm">
                        Convert the input to uppercase.
                      </Text>
                    </Box>
                  </MenuItem>
                  <MenuItem
                    value="lowercase"
                    onClick={() => {
                      setValue(
                        `customPlaceholders.${index}.steps`,
                        steps.concat({
                          id: uuidv4(),
                          type: CustomPlaceholderStepType.Lowercase,
                        }),
                      );
                    }}
                  >
                    <Box>
                      <Text display="block">Lowercase</Text>
                      <Text color="fg.muted" display="block" fontSize="sm">
                        Convert the input to lowercase.
                      </Text>
                    </Box>
                  </MenuItem>
                </MenuContent>
              </MenuRoot>
            </Flex>
          </Stack>
        )}
      </Field>
      <Separator my={2} />
      <Flex justifyContent="space-between">
        <Box>
          {!isNewField && (
            <ConfirmModal
              onConfirm={onClickDeleteCustomPlaceholder}
              description="Are you sure you want to delete this custom placeholder?"
              title="Delete Custom Placeholder"
              colorScheme="red"
              okText="Delete"
              trigger={<DestructiveActionButton>Delete</DestructiveActionButton>}
            />
          )}
          {isNewField && (
            <DestructiveActionButton onClick={onClickDeleteCustomPlaceholder}>
              <span>Delete</span>
            </DestructiveActionButton>
          )}
        </Box>
      </Flex>
    </Panel>
  );
};
