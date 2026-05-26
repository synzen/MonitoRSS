import {
  Box,
  Button,
  Code,
  Flex,
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
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
import { AddIcon } from "@chakra-ui/icons";
import { FaEllipsisVertical } from "react-icons/fa6";
import { PlaceholderLimitDialog } from "../PlaceholderLimitDialog";
import MessagePlaceholderText from "../../../../components/MessagePlaceholderText";

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
    <Stack spacing={4}>
      {!excludeDescription && (
        <HStack justifyContent="space-between">
          <Text>
            {t(
              "features.feedConnections.components.discordMessagePlaceholderLimitsForm.description"
            )}
          </Text>
        </HStack>
      )}
      {value.length > 0 && (
        <Box borderStyle="solid" borderWidth="1px" borderRadius="md">
          <TableContainer bg="gray.900" rounded="md">
            <Table size={small ? "sm" : undefined}>
              <Thead>
                <Tr>
                  <Th>
                    {t(
                      "features.feedConnections.components.discordMessagePlaceholderLimitsForm.placeholderColumnLabel"
                    )}
                  </Th>
                  <Th>
                    {t(
                      "features.feedConnections.components.discordMessagePlaceholderLimitsForm.upperCharacterLimitColumnLabel"
                    )}
                  </Th>
                  <Th>
                    {t(
                      "features.feedConnections.components.discordMessagePlaceholderLimitsForm.appendTextColumnLabel"
                    )}
                  </Th>
                  <Th isNumeric>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {value.map((fieldData, index) => {
                  return (
                    <Tr key={fieldData.placeholder}>
                      <Td>
                        <MessagePlaceholderText withBrackets>
                          {fieldData.placeholder}
                        </MessagePlaceholderText>
                      </Td>
                      <Td>{fieldData.characterCount}</Td>
                      <Td>
                        {fieldData.appendString === "\n" && (
                          <Text color="gray.400">
                            <em>(new line)</em>
                          </Text>
                        )}
                        {fieldData.appendString !== "\n" && (
                          <Code>{fieldData.appendString || ""}</Code>
                        )}
                      </Td>
                      <Td isNumeric>
                        <Menu>
                          <MenuButton
                            as={IconButton}
                            aria-label="Placeholder options"
                            icon={<FaEllipsisVertical />}
                            size="sm"
                            variant="ghost"
                          />
                          <MenuList>
                            <PlaceholderLimitDialog
                              mode="update"
                              trigger={<MenuItem>Update</MenuItem>}
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
                              onClick={() => {
                                onChange(value.filter((_, i) => i !== index));
                              }}
                            >
                              Delete
                            </MenuItem>
                          </MenuList>
                        </Menu>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </TableContainer>
        </Box>
      )}
      <Flex>
        <PlaceholderLimitDialog
          trigger={
            <Button size={small ? "sm" : undefined} leftIcon={<AddIcon fontSize="sm" />}>
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
