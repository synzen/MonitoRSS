import { Controller, useFormContext } from "react-hook-form";
import {
  Alert,
  AlertDescription,
  AlertTitle,
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
  IconButton,
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
  chakra,
} from "@chakra-ui/react";
import { AddIcon, ChevronDownIcon } from "@chakra-ui/icons";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { v4 as uuidv4 } from "uuid";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { FiMousePointer, FiChevronUp, FiChevronDown } from "react-icons/fi";
import { CustomPlaceholdersFormData } from "./constants/CustomPlaceholderFormSchema";
import { AnimatedComponent, ConfirmModal } from "../../../../components";
import { CustomPlaceholderPreview } from "./CustomPlaceholderPreview";
import { CustomPlaceholderDateFormatStep } from "../../../../types";
import { useGetUserFeedArticlesError } from "../../hooks";
import { AutoResizeTextarea } from "../../../../components/AutoResizeTextarea";
import { CustomPlaceholderStepType } from "../../../../constants";
import { DatePreferencesForm } from "../../../../components/DatePreferencesForm";
import { ArticlePropertySelect } from "../ArticlePropertySelect";
import { ArticleSelectDialog } from "../../../feed/components";
import { useUserFeedArticles } from "../../../feed";
import { useUserMe } from "../../../discordUser";
import { useUserFeedConnectionContext } from "../../../../contexts/UserFeedConnectionContext";
import { notifyInfo } from "../../../../utils/notifyInfo";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";

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
          <FormLabel variant="inline" whiteSpace="nowrap">
            Regex Flags
          </FormLabel>
          <Controller
            name={`customPlaceholders.${customPlaceholderIndex}.steps.${stepIndex}.regexSearchFlags`}
            control={control}
            render={({ field }) => {
              return (
                <Menu closeOnSelect={false}>
                  <MenuButton
                    as={Button}
                    size="sm"
                    bg="gray.800"
                    rightIcon={<ChevronDownIcon />}
                    aria-label="Regex Flags"
                  >
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
                          <Text>
                            <chakra.strong color="blue.300">g</chakra.strong>lobal
                          </Text>
                          <Text color="whiteAlpha.600">
                            Don&apos;t return after the first match
                          </Text>
                        </Box>
                      </MenuItemOption>
                      <MenuItemOption value="i">
                        <Text>
                          case <chakra.strong color="blue.300">i</chakra.strong>nsensitive
                        </Text>
                        <Text color="whiteAlpha.600">Case insensitive match</Text>
                      </MenuItemOption>
                      <MenuItemOption value="m">
                        <Text>
                          <chakra.strong color="blue.300">m</chakra.strong>ultiline
                        </Text>
                        <Text color="whiteAlpha.600">^ and $ match start/end of line</Text>
                      </MenuItemOption>
                      <MenuItemOption value="y">
                        <Text>
                          stick<chakra.strong color="blue.300">y</chakra.strong>
                        </Text>
                        <Text color="whiteAlpha.600">
                          Anchor to start of pattern, or at the end of the most recent match
                        </Text>
                      </MenuItemOption>
                      <MenuItemOption value="v">
                        <Text>
                          <chakra.strong color="blue.300">v</chakra.strong>nicode
                        </Text>
                        <Text color="whiteAlpha.600">
                          Enable all unicode and character set features
                        </Text>
                      </MenuItemOption>
                      <MenuItemOption value="s">
                        <Text>
                          <chakra.strong color="blue.300">s</chakra.strong>ingle line
                        </Text>
                        <Text color="whiteAlpha.600">Dot matches newline</Text>
                      </MenuItemOption>
                      <MenuItemOption value="d">
                        <Text>
                          in<chakra.strong color="blue.300">d</chakra.strong>ices
                        </Text>
                        <Text color="whiteAlpha.600">The regex engine returns match indices</Text>
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

const NoOptionsAvailableStep = (_: StepProps) => {
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

export const CustomPlaceholderForm = ({ index, onDelete, isExpanded }: Props) => {
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
    <Stack background="gray.700" p={4} spacing={4} rounded="lg">
      <FormControl isInvalid={!!referenceNameError} isRequired>
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
              ref={null}
            />
          )}
        />
        <FormErrorMessage>{referenceNameError?.message}</FormErrorMessage>
        <FormHelperText>
          The reference name for this custom placeholder. For example, if the reference name is{" "}
          <Code>mytitle</Code>, then the placeholder to use into your custom message contente will
          be <Code>{`{{custom::mytitle}}`}</Code>.
        </FormHelperText>
      </FormControl>
      <FormControl isInvalid={!!sourcePlaceholderError} isRequired>
        <FormLabel
          variant="inline"
          id="source-placeholder-label"
          htmlFor="source-placeholder-select"
        >
          Source Placeholder
        </FormLabel>
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
        <FormErrorMessage>{sourcePlaceholderError?.message}</FormErrorMessage>
        <FormHelperText>The placeholder where the content should originate from.</FormHelperText>
      </FormControl>
      <FormControl isInvalid={!!hasStepsError}>
        <FormLabel variant="inline">Transformation Steps</FormLabel>
        <FormHelperText pb={2}>
          The steps to apply in sequence to the content of the source placeholder. The final result
          will be the content of the custom placeholder. At least 1 step must be defined.
        </FormHelperText>
        {isNewAndIncompletePlaceholder && (
          <Alert role={undefined}>
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
                      <span>Select preview placeholder content</span>
                    </Button>
                  }
                  feedId={userFeed.id}
                  onArticleSelected={setSelectedArticleId}
                  onClickRandomArticle={onClickRandomFeedArticle}
                  articleFormatOptions={articleFormatOptions}
                />
                <Text fontSize={12} color="whiteAlpha.700">
                  Preview Input
                </Text>
                <CustomPlaceholderPreview
                  customPlaceholder={{ ...customPlaceholder, steps: [] }}
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
                                <Text fontSize={12} color="whiteAlpha.700">
                                  For the most accurate result, ensure the input date complies with
                                  the{" "}
                                  <Link
                                    color="blue.300"
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
                                icon={<FiChevronUp />}
                                aria-label="Move step up"
                                size="sm"
                                variant="ghost"
                                isDisabled={stepIndex === 0}
                                onClick={() => moveStepUp(stepIndex)}
                              />
                              <IconButton
                                icon={<FiChevronDown />}
                                aria-label="Move step down"
                                size="sm"
                                variant="ghost"
                                isDisabled={stepIndex === steps.length - 1}
                                onClick={() => moveStepDown(stepIndex)}
                              />
                              <Button
                                colorScheme="red"
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
                                    }
                                  );
                                }}
                              >
                                Delete Step
                              </Button>
                            </HStack>
                          </Flex>
                          <Divider mb={2} />
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
                          type: CustomPlaceholderStepType.DateFormat,
                          format: preferredFormat || "YYYY-MM-DDTHH:mm:ssZ",
                          locale: preferedLocale || undefined,
                          timezone: preferredTimezone || undefined,
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
                          type: CustomPlaceholderStepType.Uppercase,
                        })
                      );
                    }}
                  >
                    <Box>
                      <Text display="block">Uppercase</Text>
                      <Text color="whiteAlpha.600" display="block" fontSize="sm">
                        Convert the input to uppercase.
                      </Text>
                    </Box>
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setValue(
                        `customPlaceholders.${index}.steps`,
                        steps.concat({
                          id: uuidv4(),
                          type: CustomPlaceholderStepType.Lowercase,
                        })
                      );
                    }}
                  >
                    <Box>
                      <Text display="block">Lowercase</Text>
                      <Text color="whiteAlpha.600" display="block" fontSize="sm">
                        Convert the input to lowercase.
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
              <span>Delete</span>
            </Button>
          )}
        </Box>
      </Flex>
    </Stack>
  );
};
