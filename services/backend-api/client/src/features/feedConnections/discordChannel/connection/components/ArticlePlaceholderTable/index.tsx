import {
  Box,
  HStack,
  Spinner,
  Stack,
  TableBody,
  TableCell,
  TableColumnHeader,
  TableHeader,
  TableRoot,
  TableRow,
  TableScrollArea,
  Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import MessagePlaceholderText from "../../../messageBuilder/components/MessagePlaceholderText";

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
  withBrackets,
  withoutCopy,
}: {
  placeholderKey: string;
  value: string;
  withBrackets?: boolean;
  withoutCopy?: boolean;
}) => {
  return (
    <TableRow
      css={{
        "&:hover .copy-button": {
          opacity: 1,
        },
      }}
    >
      <TableCell>
        <HStack width="auto">
          <MessagePlaceholderText withoutCopy={withoutCopy} withBrackets={withBrackets}>
            {placeholderKey}
          </MessagePlaceholderText>
        </HStack>
      </TableCell>
      <TableCell whiteSpace="normal">
        <Box maxHeight={150} overflow="auto" tabIndex={0} minHeight="1.1rem">
          {value.split("\n").map((line, idx) => (
            // eslint-disable-next-line react/no-array-index-key
            <span key={idx}>
              {line} <br />
            </span>
          ))}
        </Box>
      </TableCell>
    </TableRow>
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
    <Stack position="relative" borderColor="border" borderRadius="l3" overflow="auto">
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
          <TableScrollArea>
            <TableRoot size="sm">
              <TableHeader>
                <TableRow>
                  <TableColumnHeader>
                    {asPlaceholders
                      ? t(
                          "features.feedConnections.components" +
                            ".articlePlaceholderTable.columnHeaderPlaceholder",
                        )
                      : t(
                          "features.feedConnections.components" +
                            ".articlePlaceholderTable.columnHeaderProperty",
                        )}
                  </TableColumnHeader>
                  <TableColumnHeader>
                    {t(
                      "features.feedConnections.components" +
                        ".articlePlaceholderTable.columnHeaderValue",
                    )}
                  </TableColumnHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
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
                      withBrackets={asPlaceholders}
                      withoutCopy={withoutCopy}
                    />
                  );
                })}
              </TableBody>
            </TableRoot>
          </TableScrollArea>
        )}
      </Box>
    </Stack>
  );
};
