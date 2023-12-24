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
import { FiMousePointer } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { CustomPlaceholdersFormData } from "./constants/CustomPlaceholderFormSchema";
import { ArticlePropertySelect } from "../ArticlePropertySelect";
import { AnimatedComponent, ConfirmModal } from "../../../../components";
import { CustomPlaceholderPreview } from "./CustomPlaceholderPreview";
import { GetUserFeedArticlesInput } from "../../../feed/api";
import { CustomPlaceholder, FeedConnectionType } from "../../../../types";
import { ArticleSelectDialog } from "../../../feed/components";
import { useUserFeedArticles } from "../../../feed/hooks";
import { notifyError } from "../../../../utils/notifyError";
import { useGetUserFeedArticlesError } from "../../hooks";
import { AutoResizeTextarea } from "../../../../components/AutoResizeTextarea";

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
  step: CustomPlaceholder["steps"][number];
  articleFormat: Props["articleFormat"];
  selectedArticleId?: string;
  feedId: string;
  connectionId: string;
  connectionType: FeedConnectionType;
}

const CustomPlaceholderStep = ({
  customPlaceholderIndex,
  stepIndex,
  step,
  selectedArticleId,
  feedId,
  connectionId,
  articleFormat,
  connectionType,
}: StepProps) => {
  const {
    control,
    formState: { errors },
    setValue,
    watch,
  } = useFormContext<CustomPlaceholdersFormData>();
  const [customPlaceholder] = watch([`customPlaceholders.${customPlaceholderIndex}`]);
  const { steps } = customPlaceholder;

  const regexSearchError =
    errors?.customPlaceholders?.[customPlaceholderIndex]?.steps?.[stepIndex]?.regexSearch;
  const replacementStringError =
    errors?.customPlaceholders?.[customPlaceholderIndex]?.steps?.[stepIndex]?.replacementString;
  const regexFlagsError =
    errors?.customPlaceholders?.[customPlaceholderIndex]?.steps?.[stepIndex]?.regexSearchFlags;

  const customPlaceholderPreviewInput = {
    ...customPlaceholder,
    steps: customPlaceholder.steps.slice(0, stepIndex + 1).map((s) => ({
      ...s,
      regexSearch: s.regexSearch.replaceAll("\\n", "\n"),
      regexSearchFlags: s.regexSearchFlags,
    })),
  };

  return (
    <Stack>
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
        <HStack
          borderStyle="solid"
          borderWidth="2px"
          borderColor="whiteAlpha.300"
          paddingX={5}
          paddingY={5}
          rounded="lg"
          // mb={1}
          alignItems="flex-start"
        >
          <Stack flex={1} spacing={4}>
            <HStack alignItems="flex-start">
              <FormControl isInvalid={!!regexSearchError} flexGrow={1}>
                <FormLabel variant="inline">Regex Search</FormLabel>
                <Controller
                  key={step.id}
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
                    The regular expression to find the text of interest. For more information on
                    your regular expressions, you may visit{" "}
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
                {regexSearchError && (
                  <FormErrorMessage>{regexSearchError.message}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl flex={0}>
                <FormLabel variant="inline">Flags</FormLabel>
                <Controller
                  key={step.id}
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
              <FormLabel variant="inline">Replacement String</FormLabel>
              <Controller
                key={step.id}
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
                  removed from the placeholder.
                </FormHelperText>
              )}
              {replacementStringError && (
                <FormErrorMessage>{replacementStringError.message}</FormErrorMessage>
              )}
            </FormControl>
          </Stack>
          <CloseButton
            size="sm"
            isDisabled={steps.length === 1}
            onClick={() => {
              const newSteps = [...steps];

              newSteps.splice(stepIndex, 1);

              setValue(`customPlaceholders.${customPlaceholderIndex}.steps`, newSteps, {
                shouldTouch: true,
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
          />
        </HStack>
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
            customPlaceholder={customPlaceholderPreviewInput}
            selectedArticleId={selectedArticleId}
          />
        </Stack>
        <Flex justifyContent="center" opacity={stepIndex < steps.length - 1 ? 1 : 0} py={2}>
          <ChevronDownIcon fontSize={24} />
        </Flex>
      </Box>
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
      formatter: articleFormat,
      filters: {
        articleId: selectedArticleId,
      },
    },
  });
  const { hasAlert: hasArticlesAlert, messageRef: userFeedArticlesMessage } =
    useGetUserFeedArticlesError({
      getUserFeedArticlesOutput: dataUserFeedArticles,
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
              articleFormatter={articleFormat}
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
                      isLoading={!!selectedArticleId && fetchStatusUserFeedArticles === "fetching"}
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
                  customPlaceholder={{ ...customPlaceholder, steps: [] }}
                  feedId={feedId}
                  selectedArticleId={selectedArticleId}
                />
              </Stack>
              <Flex justifyContent="center" py={2}>
                <ChevronDownIcon fontSize={24} />
              </Flex>
              <AnimatedComponent>
                {steps.map((step, stepIndex) => {
                  return (
                    <CustomPlaceholderStep
                      key={step.id}
                      customPlaceholderIndex={index}
                      step={step}
                      stepIndex={stepIndex}
                      selectedArticleId={selectedArticleId}
                      articleFormat={articleFormat}
                      connectionId={connectionId}
                      connectionType={connectionType}
                      feedId={feedId}
                    />
                  );
                })}
              </AnimatedComponent>
            </Box>
            <Flex justifyContent={steps.length > 0 ? "center" : "flex-start"} width="100%">
              <Button
                width="min-content"
                size="sm"
                variant="outline"
                leftIcon={<AddIcon fontSize={12} />}
                mt={-4}
                onClick={() => {
                  const newSteps = [
                    ...steps,
                    {
                      id: uuidv4(),
                      regexSearch: "",
                      replacementString: "",
                      regexSearchFlags: "gi",
                    },
                  ];

                  setValue(`customPlaceholders.${index}.steps`, newSteps, {
                    shouldTouch: true,
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
              >
                Add step
              </Button>
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
