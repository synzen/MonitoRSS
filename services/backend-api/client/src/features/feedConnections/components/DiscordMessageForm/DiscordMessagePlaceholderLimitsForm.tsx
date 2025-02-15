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
import { useFieldArray, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { AddIcon } from "@chakra-ui/icons";
import { FaEllipsisVertical } from "react-icons/fa6";
import { DiscordMessageFormData } from "@/types/discord";
import { PlaceholderLimitDialog } from "../PlaceholderLimitDialog";
import MessagePlaceholderText from "../../../../components/MessagePlaceholderText";

export const DiscordMessagePlaceholderLimitsForm = () => {
  const { control } = useFormContext<DiscordMessageFormData>();
  const { t } = useTranslation();
  const { fields, append, update, remove } = useFieldArray({
    control,
    name: "placeholderLimits",
  });

  const onSubmitNewLimit = (limit: {
    characterCount: number;
    placeholder: string;
    appendString: string;
  }) => {
    const existingIndex = fields.findIndex((f) => f.placeholder === limit.placeholder);

    if (existingIndex === -1) {
      append(limit);
    } else {
      update(existingIndex, limit);
    }
  };

  return (
    <Stack spacing={4}>
      <HStack justifyContent="space-between">
        <Text>
          {t("features.feedConnections.components.discordMessagePlaceholderLimitsForm.description")}
        </Text>
      </HStack>
      {fields.length && (
        <Box borderStyle="solid" borderWidth="1px" borderRadius="md">
          <TableContainer bg="gray.900" rounded="md">
            <Table>
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
                {fields.map((field, index) => {
                  return (
                    <Tr key={field.placeholder}>
                      <Td>
                        <MessagePlaceholderText withBrackets>
                          {field.placeholder}
                        </MessagePlaceholderText>
                      </Td>
                      <Td>{field.characterCount}</Td>
                      <Td>
                        {field.appendString === "\n" && (
                          <Text color="gray.400">
                            <em>(new line)</em>
                          </Text>
                        )}
                        {field.appendString !== "\n" && <Code>{field.appendString || ""}</Code>}
                      </Td>
                      <Td isNumeric>
                        <Menu>
                          <MenuButton
                            as={IconButton}
                            icon={<FaEllipsisVertical />}
                            size="sm"
                            variant="ghost"
                          />
                          <MenuList>
                            <PlaceholderLimitDialog
                              mode="update"
                              trigger={<MenuItem>Update</MenuItem>}
                              onSubmit={(limit) => {
                                update(index, limit);
                              }}
                              defaultValues={{
                                placeholder: field.placeholder,
                                appendString: field.appendString || "",
                                characterCount: field.characterCount,
                              }}
                            />
                            <MenuItem onClick={() => remove(index)}>Delete</MenuItem>
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
          trigger={<Button leftIcon={<AddIcon fontSize="sm" />}>Add placeholder limit</Button>}
          onSubmit={onSubmitNewLimit}
          mode="add"
        />
      </Flex>
    </Stack>
  );
};
