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

interface Props {
  path?: string;
  excludeDescription?: boolean;
  small?: boolean;
}

export const DiscordMessagePlaceholderLimitsForm = ({
  path = "placeholderLimits",
  excludeDescription,
  small,
}: Props) => {
  const { control } = useFormContext<DiscordMessageFormData>();
  const { t } = useTranslation();
  const { fields, append, update, remove } = useFieldArray({
    control,
    name: path as any,
  });

  const onSubmitNewLimit = (limit: {
    characterCount: number;
    placeholder: string;
    appendString: string;
  }) => {
    const existingIndex = fields.findIndex((f) => (f as any).placeholder === limit.placeholder);

    if (existingIndex === -1) {
      append(limit);
    } else {
      update(existingIndex, limit);
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
      {fields.length && (
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
                {fields.map((field, index) => {
                  const fieldData = field as any;

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
                                update(index, limit);
                              }}
                              defaultValues={{
                                placeholder: fieldData.placeholder,
                                appendString: fieldData.appendString || "",
                                characterCount: fieldData.characterCount,
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
