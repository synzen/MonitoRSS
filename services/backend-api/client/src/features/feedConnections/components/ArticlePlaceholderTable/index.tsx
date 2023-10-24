import {
  Box,
  Code,
  HStack,
  IconButton,
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
  useClipboard,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { CopyIcon } from "@chakra-ui/icons";
import { useEffect } from "react";
import { notifyInfo } from "../../../../utils/notifyInfo";

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
  withoutCopy,
}: {
  placeholderKey: string;
  value: string;
  withoutCopy?: boolean;
}) => {
  const { onCopy, setValue, value: copiedVal } = useClipboard("");

  const onClickCopy = (val: string) => {
    notifyInfo("Copied to clipboard!");
    setValue(val);
  };

  useEffect(() => {
    if (copiedVal) {
      onCopy();
    }
  }, [copiedVal]);

  return (
    <Tr
      _hover={{
        ".copy-button": {
          opacity: 1,
        },
      }}
    >
      <Td>
        <HStack width="min-content">
          <Code>{placeholderKey}</Code>
          <IconButton
            display={withoutCopy ? "none" : "block"}
            opacity={0}
            className="copy-button"
            onClick={() => onClickCopy(placeholderKey)}
            icon={<CopyIcon />}
            size="xs"
            variant="link"
            aria-label="Copy to clipboard"
          />
        </HStack>
      </Td>
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
    <Stack
      position="relative"
      // border="solid 1px"
      borderColor="gray.700"
      borderRadius="md"
      overflow="auto"
      // flex={1}
      // bg="whiteAlpha.100"
      // boxShadow="dark-lg"
    >
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
                    <PlaceholderRow
                      withoutCopy={withoutCopy}
                      key={key}
                      placeholderKey={placeholderKey}
                      value={value}
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
