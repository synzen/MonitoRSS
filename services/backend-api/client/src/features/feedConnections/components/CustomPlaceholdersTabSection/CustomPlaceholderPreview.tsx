import {
  Alert,
  AlertDescription,
  Badge,
  Box,
  Code,
  HStack,
  Spinner,
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
}

export const CustomPlaceholderPreview = ({
  customPlaceholder: inputCustomPlaceholder,
  feedId,
  connectionId,
  articleFormat,
  connectionType,
  selectedArticleId,
}: Props) => {
  const previewInputToDebounce = [inputCustomPlaceholder];
  const customPlaceholders = useDebounce(previewInputToDebounce, 500);
  const referenceName = customPlaceholders[0]?.referenceName;
  const customPlaceholder = customPlaceholders[0];

  const { t } = useTranslation();
  const allStepsAreComplete = customPlaceholder.steps.every((s) => {
    if (!s.type || s.type === CustomPlaceholderStepType.Regex) {
      return !!s.regexSearch;
    }

    return true;
  });
  const placeholderIsComplete = !!(
    customPlaceholder.referenceName &&
    customPlaceholder.sourcePlaceholder &&
    allStepsAreComplete
  );

  const {
    data: dataPreview,
    fetchStatus: fetchStatusPreview,
    error,
  } = useCreateConnectionPreview(connectionType, {
    enabled: placeholderIsComplete && !!selectedArticleId,
    data: {
      feedId,
      connectionId,
      data: {
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
  });

  const isFetchingNewPreview = fetchStatusPreview === "fetching";

  const messages = dataPreview?.result?.messages;

  let errorComponent = null;

  if (error?.statusCode === 422) {
    errorComponent = (
      <Text fontSize={13} color="red.300" fontWeight={600}>
        Invalid regex search in current or previous steps
      </Text>
    );
  } else if (error) {
    errorComponent = (
      <InlineErrorAlert description={error.message} title={t("common.errors.somethingWentWrong")} />
    );
  }

  return (
    <Stack spacing={4} flex={1}>
      <Stack>
        <Box
          bg="whiteAlpha.200"
          borderStyle="solid"
          borderWidth="1px"
          borderColor="whiteAlpha.300"
          py={4}
          px={4}
          rounded="lg"
        >
          <HStack pb={2} flexWrap="wrap">
            <Badge variant="subtle" size="sm">
              Preview
            </Badge>
            <Code fontSize={12} display="inline-block">{`{{custom::${referenceName}}}`}</Code>
          </HStack>
          {isFetchingNewPreview && placeholderIsComplete && <Spinner display="block" size="sm" />}
          {!selectedArticleId && placeholderIsComplete && !isFetchingNewPreview && (
            <Text color="gray.400">
              <em>No article selected for preview</em>
            </Text>
          )}
          {!isFetchingNewPreview && placeholderIsComplete && messages?.[0] && (
            <Box>
              {!messages[0].content && (
                <Text color="gray.400">
                  <em>(empty)</em>
                </Text>
              )}
              {messages[0].content &&
                messages[0].content.split("\n")?.map((line, idx) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <span key={idx}>
                    {line} <br />
                  </span>
                ))}
            </Box>
          )}
          {!isFetchingNewPreview && placeholderIsComplete && messages && !messages.length && (
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
    </Stack>
  );
};
