import {
  Box,
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

interface Props {
  article: Record<string, string>;
  asPlaceholders?: boolean;
  searchText?: string;
  hideEmptyPlaceholders?: boolean;
  isFetching?: boolean;
}

export const ArticlePlaceholderTable = ({
  article,
  asPlaceholders,
  searchText,
  hideEmptyPlaceholders,
  isFetching,
}: Props) => {
  const { t } = useTranslation();

  return (
    <Box>
      <Box
        position="relative"
        border="solid 1px"
        borderColor="gray.700"
        borderRadius="md"
        // bg="whiteAlpha.100"
        // boxShadow="dark-lg"
      >
        <Box maxHeight="sm" overflowY="auto" padding={4}>
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
                    const placeholderKey = asPlaceholders ? `{{${key}}}` : key;

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
                      <Tr key={key}>
                        <Td>{placeholderKey}</Td>
                        <Td whiteSpace="normal">
                          {value.split("\n").map((line, idx) => (
                            // eslint-disable-next-line react/no-array-index-key
                            <span key={idx}>
                              {line} <br />
                            </span>
                          ))}
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Box>
    </Box>
  );
};
