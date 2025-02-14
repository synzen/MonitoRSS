import {
  Box,
  HStack,
  Spinner,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import MessagePlaceholderText from "../../../../components/MessagePlaceholderText";

interface Props {
  article: Record<string, string>;
  asPlaceholders?: boolean;
  searchText?: string;
  hideEmptyPlaceholders?: boolean;
  isFetching?: boolean;
  withoutCopy?: boolean;
}

const PlaceholderRow = ({
  placeholderKey,
  value,
  withBraces,
  withoutCopy,
}: {
  placeholderKey: string;
  value: string;
  withBraces?: boolean;
  withoutCopy?: boolean;
}) => {
  return (
    <Tr
      _hover={{
        ".copy-button": {
          opacity: 1,
        },
      }}
    >
      <Td>
        <HStack width="auto">
          <MessagePlaceholderText withoutCopy={withoutCopy} withBraces={withBraces}>
            {placeholderKey}
          </MessagePlaceholderText>
        </HStack>
      </Td>
      <Td whiteSpace="normal">
        <Box maxHeight={150} overflow="auto" tabIndex={0}>
          {value.split("\n").map((line, idx) => (
            // eslint-disable-next-line react/no-array-index-key
            <span key={idx}>
              {line} <br />
            </span>
          ))}
        </Box>
      </Td>
    </Tr>
  );
};

export const ArticlePlaceholderTable = ({
  article,
  asPlaceholders,
  searchText,
  hideEmptyPlaceholders,
  isFetching,
  withoutCopy,
}: Props) => {
  const { t } = useTranslation();

  return (
    <Stack position="relative" borderColor="gray.700" borderRadius="md" overflow="auto">
      <Box>
        {isFetching && (
          <Stack alignItems="center">
            <Spinner size="xl" />
            <Text>
              {t("features.feedConnections.components.articlePlaceholderTable.loadingArticle")}
            </Text>
          </Stack>
        )}
        {!isFetching && (
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>
                    {asPlaceholders
                      ? t(
                          "features.feedConnections.components" +
                            ".articlePlaceholderTable.columnHeaderPlaceholder"
                        )
                      : t(
                          "features.feedConnections.components" +
                            ".articlePlaceholderTable.columnHeaderProperty"
                        )}
                  </Th>
                  <Th>
                    {t(
                      "features.feedConnections.components" +
                        ".articlePlaceholderTable.columnHeaderValue"
                    )}
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {Object.entries(article).map(([key, value]) => {
                  const placeholderKey = key;

                  if (hideEmptyPlaceholders && !value) {
                    return null;
                  }

                  if (
                    searchText &&
                    !key.toLowerCase().includes(searchText) &&
                    !value.toLowerCase().includes(searchText) &&
                    !placeholderKey.toLowerCase().includes(searchText)
                  ) {
                    return null;
                  }

                  return (
                    <PlaceholderRow
                      key={key}
                      placeholderKey={placeholderKey}
                      value={value}
                      withBraces={asPlaceholders}
                      withoutCopy={withoutCopy}
                    />
                  );
                })}
              </Tbody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Stack>
  );
};
