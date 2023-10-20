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

interface Props {
  feedId: string;
}

export const DiscordMessagePlaceholderLimitsForm = ({ feedId }: Props) => {
  const { control } = useFormContext<DiscordMessageFormData>();
  const { t } = useTranslation();
  const { fields, append, update, remove } = useFieldArray({
    control,
    name: "placeholderLimits",
  });

  const currentPlaceholders = fields.map((f) => f.placeholder);

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
        {fields.length && (
          <PlaceholderLimitDialog
            feedId={feedId}
            excludePlaceholders={currentPlaceholders}
            trigger={
              <Button leftIcon={<AddIcon fontSize="xs" />} size="sm">
                {t("common.buttons.add")}
              </Button>
            }
            onSubmit={onSubmitNewLimit}
            mode="add"
          />
        )}
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
                  <Th isNumeric />
                </Tr>
              </Thead>
              <Tbody>
                {fields.map((field, index) => {
                  return (
                    <Tr key={field.placeholder}>
                      <Td>{field.placeholder}</Td>
                      <Td>{field.characterCount}</Td>
                      <Td>
                        <Code> {field.appendString || ""}</Code>
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
                              excludePlaceholders={currentPlaceholders}
                              mode="update"
                              trigger={<MenuItem>{t("common.buttons.edit")}</MenuItem>}
                              onSubmit={(limit) => {
                                update(index, limit);
                              }}
                              defaultValues={{
                                placeholder: field.placeholder,
                                appendString: field.appendString || "",
                                characterCount: field.characterCount,
                              }}
                              feedId={feedId}
                            />
                            <MenuItem onClick={() => remove(index)}>
                              {t("common.buttons.delete")}
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
      {!fields.length && (
        <Flex>
          <PlaceholderLimitDialog
            feedId={feedId}
            excludePlaceholders={currentPlaceholders}
            trigger={
              <Button leftIcon={<AddIcon fontSize="sm" />} variant="ghost">
                {t("common.buttons.add")}
              </Button>
            }
            onSubmit={onSubmitNewLimit}
            mode="add"
          />
        </Flex>
      )}
    </Stack>
  );
};
