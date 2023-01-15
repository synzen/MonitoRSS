import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Heading,
  HStack,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useUserFeedArticleProperties } from "../../../feed/hooks";
import { AddComparisonSelect } from "./AddComparisonSelect";
import { ComparisonTab } from "./ComparisonTab";

interface Props {
  feedId: string;
  passingComparisons?: string[];
  blockingComparisons?: string[];
  onUpdate: (data: {
    passingComparisons?: string[];
    blockingComparisons?: string[];
  }) => Promise<void>;
}

export const ComparisonsTabSection = ({
  feedId,
  blockingComparisons,
  passingComparisons,
  onUpdate,
}: Props) => {
  const { t } = useTranslation();
  const { data, error, status, fetchStatus } = useUserFeedArticleProperties({
    feedId,
  });

  const passingComaprisonsToAdd = data?.result.properties.filter(
    (property) => !passingComparisons?.includes(property)
  );

  const blockingComparisonsToAdd = data?.result.properties.filter(
    (property) => !blockingComparisons?.includes(property)
  );

  const onAddPassingComparison = async (value: string) => {
    await onUpdate({
      passingComparisons: [...(passingComparisons || []), value],
      blockingComparisons,
    });
  };

  const onAddBlockingComparison = async (value: string) => {
    await onUpdate({
      passingComparisons,
      blockingComparisons: [...(blockingComparisons || []), value],
    });
  };

  const onRemovePassingComparison = async (value: string) => {
    await onUpdate({
      passingComparisons: passingComparisons?.filter((comparison) => comparison !== value),
      blockingComparisons,
    });
  };

  const onRemoveBlockingComparison = async (value: string) => {
    await onUpdate({
      passingComparisons,
      blockingComparisons: blockingComparisons?.filter((comparison) => comparison !== value),
    });
  };

  return (
    <Stack spacing={12} marginBottom={8}>
      <Stack spacing={4}>
        <Heading size="md" as="h3">
          {t("features.feedConnections.components.comparisonsTabSection.title")}
        </Heading>
        <Text>{t("features.feedConnections.components.comparisonsTabSection.description")}</Text>
        {error && (
          <Alert status="error">
            <AlertIcon />
            <AlertTitle>
              {t(
                "features.feedConnections.components.comparisonsTabSection.errorFailedToGetPropertiesTitle"
              )}
            </AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
      </Stack>
      <Stack spacing={4}>
        <Heading size="sm" as="h3">
          {t("features.feedConnections.components.comparisonsTabSection.passingComparisonsTitle")}
        </Heading>
        <Text>
          {t(
            "features.feedConnections.components.comparisonsTabSection.passingComparisonsDescription"
          )}
        </Text>
        <HStack flexWrap="wrap">
          {passingComparisons?.map((comparison) => (
            <ComparisonTab
              title={comparison}
              colorScheme="cyan"
              onDelete={() => onRemovePassingComparison(comparison)}
            />
          ))}
          <AddComparisonSelect
            isDisabled={status !== "success"}
            isLoading={status === "loading" || fetchStatus === "fetching"}
            onChange={onAddPassingComparison}
            properties={passingComaprisonsToAdd}
          />
        </HStack>
      </Stack>
      <Stack spacing={4}>
        <Heading size="sm" as="h3">
          {t("features.feedConnections.components.comparisonsTabSection.blockingComparisonsTitle")}
        </Heading>
        <Text>
          {t(
            "features.feedConnections.components.comparisonsTabSection.blockingComparisonsDescription"
          )}
        </Text>
        <HStack flexWrap="wrap">
          {blockingComparisons?.map((comparison) => (
            <ComparisonTab
              title={comparison}
              colorScheme="red"
              onDelete={() => onRemoveBlockingComparison(comparison)}
            />
          ))}
          <AddComparisonSelect
            isDisabled={status !== "success"}
            isLoading={status === "loading" || fetchStatus === "fetching"}
            onChange={onAddBlockingComparison}
            properties={blockingComparisonsToAdd}
          />
        </HStack>
      </Stack>
    </Stack>
  );
};
