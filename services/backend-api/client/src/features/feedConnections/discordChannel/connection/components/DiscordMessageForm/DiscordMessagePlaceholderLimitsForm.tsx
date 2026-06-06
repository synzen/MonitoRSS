import { Box, Button, Code, Flex, HStack, IconButton, Stack, Table, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FaPlus, FaEllipsisVertical } from "react-icons/fa6";
import { MenuRoot, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { PlaceholderLimitDialog } from "../PlaceholderLimitDialog";
import MessagePlaceholderText from "../../../messageBuilder/components/MessagePlaceholderText";

export interface PlaceholderLimit {
  characterCount: number;
  placeholder: string;
  appendString?: string | null;
}

interface Props {
  value: PlaceholderLimit[];
  onChange: (value: PlaceholderLimit[]) => void;
  excludeDescription?: boolean;
  small?: boolean;
}

export const DiscordMessagePlaceholderLimitsForm = ({
  value,
  onChange,
  excludeDescription,
  small,
}: Props) => {
  const { t } = useTranslation();

  const onSubmitNewLimit = (limit: {
    characterCount: number;
    placeholder: string;
    appendString: string;
  }) => {
    const existingIndex = value.findIndex((f) => f.placeholder === limit.placeholder);

    if (existingIndex === -1) {
      onChange([...value, limit]);
    } else {
      const copy = [...value];
      copy[existingIndex] = limit;
      onChange(copy);
    }
  };

  return (
    <Stack gap={4}>
      {!excludeDescription && (
        <HStack justifyContent="space-between">
          <Text>
            {t(
              "features.feedConnections.components.discordMessagePlaceholderLimitsForm.description",
            )}
          </Text>
        </HStack>
      )}
      {value.length > 0 && (
        <Box borderStyle="solid" borderWidth="1px" borderRadius="l3">
          <Table.ScrollArea bg="bg.subtle" rounded="l3">
            <Table.Root size={small ? "sm" : undefined}>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>
                    {t(
                      "features.feedConnections.components.discordMessagePlaceholderLimitsForm.placeholderColumnLabel",
                    )}
                  </Table.ColumnHeader>
                  <Table.ColumnHeader>
                    {t(
                      "features.feedConnections.components.discordMessagePlaceholderLimitsForm.upperCharacterLimitColumnLabel",
                    )}
                  </Table.ColumnHeader>
                  <Table.ColumnHeader>
                    {t(
                      "features.feedConnections.components.discordMessagePlaceholderLimitsForm.appendTextColumnLabel",
                    )}
                  </Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Actions</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {value.map((fieldData, index) => {
                  return (
                    <Table.Row key={fieldData.placeholder}>
                      <Table.Cell>
                        <MessagePlaceholderText withBrackets>
                          {fieldData.placeholder}
                        </MessagePlaceholderText>
                      </Table.Cell>
                      <Table.Cell>{fieldData.characterCount}</Table.Cell>
                      <Table.Cell>
                        {fieldData.appendString === "\n" && (
                          <Text color="fg.muted">
                            <em>(new line)</em>
                          </Text>
                        )}
                        {fieldData.appendString !== "\n" && (
                          <Code>{fieldData.appendString || ""}</Code>
                        )}
                      </Table.Cell>
                      <Table.Cell textAlign="end">
                        <MenuRoot>
                          <MenuTrigger asChild>
                            <IconButton aria-label="Placeholder options" size="sm" variant="ghost">
                              <FaEllipsisVertical />
                            </IconButton>
                          </MenuTrigger>
                          <MenuContent>
                            <PlaceholderLimitDialog
                              mode="update"
                              trigger={<MenuItem value="update">Update</MenuItem>}
                              onSubmit={(limit) => {
                                const copy = [...value];
                                copy[index] = limit;
                                onChange(copy);
                              }}
                              defaultValues={{
                                placeholder: fieldData.placeholder,
                                appendString: fieldData.appendString || "",
                                characterCount: fieldData.characterCount,
                              }}
                            />
                            <MenuItem
                              value="delete"
                              onClick={() => {
                                onChange(value.filter((_, i) => i !== index));
                              }}
                            >
                              Delete
                            </MenuItem>
                          </MenuContent>
                        </MenuRoot>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
        </Box>
      )}
      <Flex>
        <PlaceholderLimitDialog
          trigger={
            <Button size={small ? "sm" : undefined} variant="outline" colorPalette="brand">
              <FaPlus fontSize="sm" />
              Add placeholder limit
            </Button>
          }
          onSubmit={onSubmitNewLimit}
          mode="add"
        />
      </Flex>
    </Stack>
  );
};
