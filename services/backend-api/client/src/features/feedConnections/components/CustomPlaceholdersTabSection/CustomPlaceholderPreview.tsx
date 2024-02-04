import {
  Alert,
  AlertDescription,
  Badge,
  Box,
  Code,
  Divider,
  HStack,
  SkeletonText,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { CustomPlaceholder, FeedConnectionType } from "../../../../types";
import { useCreateConnectionPreview } from "../../hooks";
import { GetUserFeedArticlesInput } from "../../../feed/api";
import { InlineErrorAlert } from "../../../../components";
import { useDebounce } from "../../../../hooks";
import { CustomPlaceholderStepType } from "../../../../constants";

interface Props {
  customPlaceholder: CustomPlaceholder;
  connectionType: FeedConnectionType;
  feedId: string;
  connectionId: string;
  articleFormat: GetUserFeedArticlesInput["data"]["formatter"];
  selectedArticleId?: string;
  stepIndex: number;
}

export const CustomPlaceholderPreview = ({
  customPlaceholder: inputCustomPlaceholder,
  feedId,
  connectionId,
  articleFormat,
  connectionType,
  selectedArticleId,
  stepIndex,
}: Props) => {
  const previewInputToDebounce: CustomPlaceholder[] = [
    {
      ...inputCustomPlaceholder,
      steps: inputCustomPlaceholder.steps.map((s) => {
        if (s.type === CustomPlaceholderStepType.Regex) {
          return {
            ...s,
            regexSearch: s.regexSearch.replaceAll("\\n", "\n"),
          };
        }

        return s;
      }),
    },
  ];
  const customPlaceholders = useDebounce(previewInputToDebounce, 500);
  const referenceName = customPlaceholders[0]?.referenceName;
  const customPlaceholder = customPlaceholders[0];

  const { t } = useTranslation();
  const allStepsAreComplete = customPlaceholder.steps.every((s) => {
    if (!s.type || s.type === CustomPlaceholderStepType.Regex) {
      return !!s.regexSearch;
    }

    if (s.type === CustomPlaceholderStepType.DateFormat) {
      return !!s.format;
    }

    return true;
  });
  const placeholderIsComplete = !!(
    customPlaceholder.referenceName &&
    customPlaceholder.sourcePlaceholder &&
    allStepsAreComplete
  );

  const input = {
    enabled: placeholderIsComplete && !!selectedArticleId && customPlaceholder.steps.length > 0,
    data: {
      feedId,
      connectionId,
      data: {
        includeCustomPlaceholderPreviews: true,
        article: {
          id: selectedArticleId as string,
        },
        customPlaceholders,
        content: `{{custom::${referenceName}}}`,
        connectionFormatOptions: {
          formatTables: articleFormat.options.formatTables,
          stripImages: articleFormat.options.stripImages,
        },
      },
    },
  };
  const {
    data: dataPreview,
    fetchStatus: fetchStatusPreview,
    error,
  } = useCreateConnectionPreview(connectionType, input);

  const isFetchingNewPreview = fetchStatusPreview === "fetching";

  const previews = dataPreview?.result.customPlaceholderPreviews;

  let errorComponent = null;

  if (error?.statusCode === 422) {
    if (error.errorCode === "INVALID_CUSTOM_PLACEHOLDERS_REGEX_PREVIEW_INPUT") {
      errorComponent = (
        <Text fontSize={13} color="red.300" fontWeight={600}>
          Invalid regex search in current or previous steps
        </Text>
      );
    }
  } else if (error) {
    errorComponent = (
      <InlineErrorAlert description={error.message} title={t("common.errors.somethingWentWrong")} />
    );
  }

  const contentToDisplay = previews?.[0]?.[stepIndex];
  const showLoading = isFetchingNewPreview && placeholderIsComplete;

  return (
    <Stack spacing={4} flex={1}>
      <Box
        bg="whiteAlpha.200"
        borderStyle="solid"
        borderWidth="1px"
        borderColor="whiteAlpha.300"
        py={4}
        px={4}
        rounded="lg"
        minHeight={250}
        maxHeight={250}
        overflow={showLoading ? "hidden" : "auto"}
      >
        <HStack pb={2} flexWrap="wrap">
          <Badge variant="subtle" size="sm">
            Preview
          </Badge>
          <Code fontSize={12} display="inline-block">{`{{custom::${referenceName}}}`}</Code>
        </HStack>
        <Divider mt={1} mb={3} />
        {showLoading && <SkeletonText noOfLines={7} spacing="2" skeletonHeight="6" />}
        {!selectedArticleId && placeholderIsComplete && !isFetchingNewPreview && (
          <Text color="gray.400">
            <em>No article selected for preview</em>
          </Text>
        )}
        {!isFetchingNewPreview && placeholderIsComplete && previews && (
          <Box>
            {!contentToDisplay && (
              <Text color="gray.400">
                <em>(empty)</em>
              </Text>
            )}
            {contentToDisplay &&
              contentToDisplay.split("\n")?.map((line, idx) => (
                // eslint-disable-next-line react/no-array-index-key
                <span key={idx}>
                  {line} <br />
                </span>
              ))}
          </Box>
        )}
        {!isFetchingNewPreview &&
          placeholderIsComplete &&
          dataPreview?.result &&
          !dataPreview?.result.messages.length && (
            <Alert status="warning">
              <AlertDescription>No article found for preview</AlertDescription>
            </Alert>
          )}
        {errorComponent}
        {!error && !placeholderIsComplete && (
          <Text fontSize={13} color="red.300" fontWeight="600">
            Incomplete inputs in current or previous steps
          </Text>
        )}
      </Box>
    </Stack>
  );
};
