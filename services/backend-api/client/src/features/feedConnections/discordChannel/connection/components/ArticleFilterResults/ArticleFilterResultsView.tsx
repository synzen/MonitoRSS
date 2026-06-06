import { FaCheck, FaXmark } from "react-icons/fa6";
import { Box, Icon, Skeleton, Table, TableHeaderProps } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

interface Props {
  displayPropertyName: string;
  articles: Array<{
    id: string;
    propertyValue: string;
    passedFilters?: boolean;
  }>;
  isLoading?: boolean;
  theadProps?: TableHeaderProps;
}

export const ArticleFilterResultsView = ({
  articles,
  displayPropertyName,
  isLoading,
  theadProps,
}: Props) => {
  const { t } = useTranslation();

  return (
    <Box position="relative" rounded="l3">
      <Box
        position="relative"
        borderWidth="1px"
        borderStyle="solid"
        borderColor="border.emphasized"
        rounded="l3"
      >
        <Box maxHeight="sm" overflow="auto" rounded="l3">
          <Table.ScrollArea>
            <Table.Root size="sm">
              <Table.Header borderTopLeftRadius="md" {...theadProps}>
                <Table.Row>
                  <Table.ColumnHeader>
                    {t(
                      "features.feedConnections.components" +
                        ".articleFilterResultsTable.columnHeaderPassedFilters",
                    )}
                  </Table.ColumnHeader>
                  <Table.ColumnHeader width="100%">
                    Article {displayPropertyName}
                  </Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {articles.map(({ passedFilters, propertyValue, id }) => {
                  let rowBg: string | undefined;

                  if (isLoading) {
                    rowBg = undefined;
                  } else if (passedFilters === true) {
                    rowBg = "green.subtle";
                  } else if (passedFilters === false) {
                    rowBg = "red.subtle";
                  }

                  return (
                    <Table.Row key={id} bg={rowBg}>
                      <Table.Cell>
                        <Skeleton loading={isLoading}>
                          {passedFilters === true && (
                            <Icon as={FaCheck} aria-label="passed" color="text.success" />
                          )}
                          {passedFilters === false && (
                            <Icon as={FaXmark} aria-label="blocked" color="text.error" />
                          )}
                          {passedFilters === undefined && <span>?</span>}
                        </Skeleton>
                      </Table.Cell>
                      <Table.Cell>
                        <Skeleton loading={isLoading}>
                          {isLoading ? "loading..." : propertyValue}
                        </Skeleton>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
        </Box>
      </Box>
    </Box>
  );
};
