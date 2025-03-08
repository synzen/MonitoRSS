import { CheckIcon, CloseIcon } from "@chakra-ui/icons";
import {
  Box,
  Skeleton,
  Table,
  TableContainer,
  TableHeadProps,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

interface Props {
  displayPropertyName: string;
  articles: Array<{
    id: string;
    propertyValue: string;
    passedFilters?: boolean;
  }>;
  isLoading?: boolean;
  theadProps?: TableHeadProps;
}

export const ArticleFilterResultsView = ({
  articles,
  displayPropertyName,
  isLoading,
  theadProps,
}: Props) => {
  const { t } = useTranslation();

  return (
    <Box position="relative" rounded="md">
      <Box position="relative" border="solid 1px" borderColor="gray.700" rounded="md">
        <Box maxHeight="sm" overflow="auto" rounded="md">
          <TableContainer rounded="md">
            <Table size="sm" rounded="md">
              <Thead borderTopLeftRadius="md" {...theadProps}>
                <Tr>
                  <Th>
                    {t(
                      "features.feedConnections.components" +
                        ".articleFilterResultsTable.columnHeaderPassedFilters"
                    )}
                  </Th>
                  <Th width="100%">Article {displayPropertyName}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {articles.map(({ passedFilters, propertyValue, id }) => {
                  let valueColor: string | undefined;

                  if (isLoading) {
                    valueColor = undefined;
                  } else if (passedFilters === true) {
                    valueColor = "rgba(23, 99, 27, 0.5)";
                  } else if (passedFilters === false) {
                    valueColor = "rgba(99, 23, 27, 0.5)";
                  }

                  return (
                    <Tr key={id} bg={valueColor}>
                      <Td>
                        <Skeleton isLoaded={!isLoading}>
                          {passedFilters === true && (
                            <CheckIcon aria-label="passed" color="green.500" />
                          )}
                          {passedFilters === false && (
                            <CloseIcon aria-label="blocked" color="red.500" />
                          )}
                          {passedFilters === undefined && <span>?</span>}
                        </Skeleton>
                      </Td>
                      <Td>
                        <Skeleton isLoaded={!isLoading}>
                          {isLoading ? "loading..." : propertyValue}
                        </Skeleton>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </TableContainer>
        </Box>
      </Box>
    </Box>
  );
};
