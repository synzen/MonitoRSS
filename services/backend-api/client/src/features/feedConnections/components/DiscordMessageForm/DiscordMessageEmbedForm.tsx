import {
  Box,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  IconButton,
  Input,
  Radio,
  RadioGroup,
  Stack,
  StackDivider,
  Textarea,
  Text,
  HStack,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
  TableContainer,
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  Switch,
} from "@chakra-ui/react";
import { useEffect } from "react";
import { Controller, FieldError, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ChevronDownIcon, ChevronUpIcon, CloseIcon, DeleteIcon } from "@chakra-ui/icons";
import { SketchPicker } from "react-color";
import { motion } from "framer-motion";
import { uniqueId } from "lodash";
import { DiscordMessageFormData } from "@/types/discord";
import { getNestedField } from "@/utils/getNestedField";
import { EMBED_REQUIRES_ONE_OF, EMBED_REQUIRES_ONE_OF_ERROR_KEY } from "./constants";
import getChakraColor from "../../../../utils/getChakraColor";
import { AnimatedComponent } from "../../../../components";

interface Props {
  index: number;
}

export const DiscordMessageEmbedForm = ({ index }: Props) => {
  const {
    control,
    formState: { errors },
    setError,
    clearErrors,
    setValue,
  } = useFormContext<DiscordMessageFormData>();
  const {
    append: addField,
    remove: removeField,
    fields: embedFields,
    move: moveField,
  } = useFieldArray({
    control,
    name: `embeds.${index}.fields`,
  });

  const embed = useWatch({
    control,
    name: `embeds.${index}`,
  });
  const { t } = useTranslation();

  useEffect(
    () => {
      const atLeastOneRequiredValueExists = EMBED_REQUIRES_ONE_OF.some((key) =>
        getNestedField(embed, key)
      );

      if (!atLeastOneRequiredValueExists) {
        EMBED_REQUIRES_ONE_OF.forEach((key) => {
          setError(`embeds.${index}.${key}` as any, {
            type: EMBED_REQUIRES_ONE_OF_ERROR_KEY,
            message: t("features.feedConnections.components.embedForm.errorOneOfRequiredFields"),
          });
        });
      } else {
        EMBED_REQUIRES_ONE_OF.forEach((key) => {
          const existingError = getNestedField(errors, `embeds.${index}.${key}` as any) as
            | FieldError
            | undefined;

          if (existingError?.type === EMBED_REQUIRES_ONE_OF_ERROR_KEY) {
            clearErrors(`embeds.${index}.${key}` as any);
          }
        });
      }
    },
    EMBED_REQUIRES_ONE_OF.map((key) => getNestedField(embed, key))
  );

  const getEmbedError = (fieldName: string) => {
    const error: FieldError | undefined = getNestedField(
      (errors.embeds as any)?.[index],
      fieldName
    );

    return error ? error.message : undefined;
  };

  const colorError = getEmbedError("color");
  const authorIconUrlError = getEmbedError("author.iconUrl");
  const authorNameError = getEmbedError("author.name");
  const authorUrlError = getEmbedError("author.url");
  const descriptionError = getEmbedError("description");
  const footerIconUrlError = getEmbedError("footer.iconUrl");
  const footerTextError = getEmbedError("footer.text");
  const imageUrlError = getEmbedError("image.url");
  const thumbnailUrlError = getEmbedError("thumbnail.url");
  const titleError = getEmbedError("title");
  const urlError = getEmbedError("url");

  return (
    <Stack spacing={8}>
      <Stack spacing={8} divider={<StackDivider />}>
        <FormControl isInvalid={!!colorError}>
          <Stack
            direction={{ base: "column", md: "row" }}
            spacing={{ base: "1.5", md: "8" }}
            justify="space-between"
          >
            <FormLabel>Color</FormLabel>
            <Stack
              spacing={8}
              width="100%"
              maxW={{ md: "md", lg: "2xl", xl: "3xl" }}
              minW={{ md: "md", lg: "2xl", xl: "3xl" }}
            >
              <Controller
                name={`embeds.${index}.color`}
                control={control}
                render={({ field }) => {
                  const hexValue = field.value
                    ? `#${Number(field.value).toString(16).padStart(6, "0")}`
                    : "";

                  return (
                    <HStack>
                      <HStack width="100%">
                        <Popover>
                          <PopoverTrigger>
                            <Button
                              // height="40px"
                              backgroundColor={!hexValue ? "black" : `${hexValue}`}
                              flex={1}
                              borderStyle="solid"
                              borderWidth="1px"
                              borderColor="whiteAlpha.400"
                              aria-label="Pick color"
                              size={["sm", "sm", "md"]}
                              _hover={{
                                background: !hexValue ? "black" : hexValue,
                                outline: `solid 2px ${getChakraColor("blue.300")}`,
                                transition: "outline 0.2s",
                              }}
                            />
                          </PopoverTrigger>
                          <PopoverContent backgroundColor="black.100" width="min-content">
                            <SketchPicker
                              presetColors={[]}
                              disableAlpha
                              color={hexValue}
                              onChange={(c) => {
                                const hexColorAsNumberString = parseInt(
                                  c.hex.replace("#", ""),
                                  16
                                ).toString();

                                field.onChange(hexColorAsNumberString);
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                        <IconButton
                          size={["sm", "sm", "md"]}
                          aria-label="Clear color"
                          icon={<CloseIcon />}
                          isDisabled={!field.value}
                          onClick={() => field.onChange("")}
                        />
                      </HStack>
                    </HStack>
                  );
                }}
              />
              {colorError && <FormErrorMessage>{colorError}</FormErrorMessage>}
            </Stack>
          </Stack>
        </FormControl>
        <Box>
          <Stack
            direction={{ base: "column", md: "row" }}
            spacing={{ base: "1.5", md: "8" }}
            justify="space-between"
          >
            <Text size="sm" fontWeight={400}>
              Author
            </Text>
            <Stack
              spacing={8}
              width="100%"
              maxW={{ md: "md", lg: "2xl", xl: "3xl" }}
              minW={{ md: "md", lg: "2xl", xl: "3xl" }}
            >
              <FormControl isInvalid={!!authorNameError}>
                <FormLabel variant="inline">Author Name</FormLabel>
                <Controller
                  name={`embeds.${index}.author.name`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <Input size="sm" {...field} value={field.value || ""} bg="gray.900" />
                  )}
                />
                {authorNameError && <FormErrorMessage>{authorNameError}</FormErrorMessage>}
              </FormControl>
              <FormControl isInvalid={!!authorUrlError}>
                <FormLabel variant="inline">Author URL</FormLabel>
                <Controller
                  name={`embeds.${index}.author.url`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <Input size="sm" {...field} value={field.value || ""} bg="gray.900" />
                  )}
                />
                {authorUrlError && <FormErrorMessage>{authorUrlError}</FormErrorMessage>}
              </FormControl>
              <FormControl isInvalid={!!authorIconUrlError}>
                <FormLabel variant="inline">Author Icon URL</FormLabel>
                <Controller
                  name={`embeds.${index}.author.iconUrl`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <Input size="sm" {...field} value={field.value || ""} bg="gray.900" />
                  )}
                />
                {authorIconUrlError && <FormErrorMessage>{authorIconUrlError}</FormErrorMessage>}
              </FormControl>
            </Stack>
          </Stack>
        </Box>
        <Box>
          <Stack
            direction={{ base: "column", md: "row" }}
            spacing={{ base: "1.5", md: "8" }}
            justify="space-between"
          >
            <Text size="sm" fontWeight={400}>
              Title
            </Text>
            <Stack
              spacing={8}
              width="100%"
              maxW={{ md: "md", lg: "2xl", xl: "3xl" }}
              minW={{ md: "md", lg: "2xl", xl: "3xl" }}
            >
              <FormControl isInvalid={!!titleError}>
                <FormLabel variant="inline">Title Text</FormLabel>
                <Controller
                  name={`embeds.${index}.title`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <Input size="sm" {...field} value={field.value || ""} bg="gray.900" />
                  )}
                />
                {titleError && <FormErrorMessage>{titleError}</FormErrorMessage>}
              </FormControl>
              <FormControl isInvalid={!!urlError}>
                <FormLabel variant="inline">Title URL</FormLabel>
                <Controller
                  name={`embeds.${index}.url`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <Input size="sm" {...field} value={field.value || ""} bg="gray.900" />
                  )}
                />
                {urlError && <FormErrorMessage>{urlError}</FormErrorMessage>}
              </FormControl>
            </Stack>
          </Stack>
        </Box>
        <Box>
          <Stack
            direction={{ base: "column", md: "row" }}
            spacing={{ base: "1.5", md: "8" }}
            justify="space-between"
          >
            <Text size="sm" fontWeight={400}>
              Description
            </Text>
            <Stack
              spacing={8}
              width="100%"
              maxW={{ md: "md", lg: "2xl", xl: "3xl" }}
              minW={{ md: "md", lg: "2xl", xl: "3xl" }}
            >
              <FormControl isInvalid={!!descriptionError}>
                <FormLabel variant="inline">Description Text</FormLabel>
                <Controller
                  name={`embeds.${index}.description`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <Textarea size="sm" {...field} value={field.value || ""} bg="gray.900" />
                  )}
                />
                {descriptionError && <FormErrorMessage>{descriptionError}</FormErrorMessage>}
              </FormControl>
            </Stack>
          </Stack>
        </Box>
        <Box>
          <Stack
            direction={{ base: "column", md: "row" }}
            spacing={{ base: "1.5", md: "8" }}
            justify="space-between"
          >
            <Text size="sm" fontWeight={400}>
              Image
            </Text>
            <Stack
              spacing={8}
              width="100%"
              maxW={{ md: "md", lg: "2xl", xl: "3xl" }}
              minW={{ md: "md", lg: "2xl", xl: "3xl" }}
            >
              <FormControl isInvalid={!!imageUrlError}>
                <FormLabel variant="inline">Image URL</FormLabel>
                <Controller
                  name={`embeds.${index}.image.url`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <Input size="sm" {...field} value={field.value || ""} bg="gray.900" />
                  )}
                />
                {imageUrlError && <FormErrorMessage>{imageUrlError}</FormErrorMessage>}
              </FormControl>
            </Stack>
          </Stack>
        </Box>
        <Box>
          <Stack
            direction={{ base: "column", md: "row" }}
            spacing={{ base: "1.5", md: "8" }}
            justify="space-between"
          >
            <Text size="sm" fontWeight={400}>
              Thumbnail
            </Text>
            <Stack
              spacing={8}
              width="100%"
              maxW={{ md: "md", lg: "2xl", xl: "3xl" }}
              minW={{ md: "md", lg: "2xl", xl: "3xl" }}
            >
              <FormControl isInvalid={!!thumbnailUrlError}>
                <FormLabel variant="inline">Thumbnail Image URL</FormLabel>
                <Controller
                  name={`embeds.${index}.thumbnail.url`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <Input size="sm" {...field} value={field.value || ""} bg="gray.900" />
                  )}
                />
                {thumbnailUrlError && <FormErrorMessage>{thumbnailUrlError}</FormErrorMessage>}
              </FormControl>
            </Stack>
          </Stack>
        </Box>
        <Box>
          <Stack
            direction={{ base: "column", md: "row" }}
            spacing={{ base: "1.5", md: "8" }}
            justify="space-between"
          >
            <Text size="sm" fontWeight={400}>
              Footer
            </Text>
            <Stack
              spacing={8}
              width="100%"
              maxW={{ md: "md", lg: "2xl", xl: "3xl" }}
              minW={{ md: "md", lg: "2xl", xl: "3xl" }}
            >
              <FormControl isInvalid={!!footerTextError}>
                <FormLabel variant="inline">Footer Text</FormLabel>
                <Controller
                  name={`embeds.${index}.footer.text`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <Input size="sm" {...field} value={field.value || ""} bg="gray.900" />
                  )}
                />
                {footerTextError && <FormErrorMessage>{footerTextError}</FormErrorMessage>}
              </FormControl>
              <FormControl isInvalid={!!footerIconUrlError}>
                <FormLabel variant="inline">Footer Icon URL</FormLabel>
                <Controller
                  name={`embeds.${index}.footer.iconUrl`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <Input size="sm" {...field} value={field.value || ""} bg="gray.900" />
                  )}
                />
                {footerIconUrlError && <FormErrorMessage>{footerIconUrlError}</FormErrorMessage>}
              </FormControl>
            </Stack>
          </Stack>
        </Box>
        <Box>
          <Stack
            direction={{ base: "column", md: "row" }}
            spacing={{ base: "1.5", md: "8" }}
            justify="space-between"
          >
            <Text size="sm" fontWeight={400}>
              Fields
            </Text>
            <Stack
              spacing={8}
              width="100%"
              maxW={{ md: "md", lg: "2xl", xl: "3xl" }}
              minW={{ md: "md", lg: "2xl", xl: "3xl" }}
            >
              <Stack>
                <TableContainer>
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Field Name</Th>
                        <Th>Field Value</Th>
                        <Th>Is Field Inline?</Th>
                        <Th isNumeric>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      <AnimatedComponent>
                        {embed.fields?.map((f, fieldIndex) => {
                          return (
                            <Tr
                              as={motion.tr}
                              key={f.id}
                              exit={{
                                opacity: 0,
                              }}
                              initial={{
                                opacity: 0,
                              }}
                              animate={{
                                opacity: 1,
                              }}
                            >
                              <Td
                                border={
                                  errors.embeds?.[index]?.fields?.[fieldIndex]?.name
                                    ? `solid 2px ${getChakraColor("red.300")}`
                                    : ""
                                }
                                borderRadius="md"
                              >
                                <Input
                                  size="sm"
                                  bg="gray.900"
                                  value={f.name}
                                  placeholder="Field name"
                                  onChange={(e) =>
                                    setValue(
                                      `embeds.${index}.fields.${fieldIndex}.name`,
                                      e.target.value.trim(),
                                      {
                                        shouldDirty: true,
                                        shouldTouch: true,
                                      }
                                    )
                                  }
                                />
                              </Td>
                              <Td
                                border={
                                  errors.embeds?.[index]?.fields?.[fieldIndex]?.value
                                    ? `solid 2px ${getChakraColor("red.300")}`
                                    : ""
                                }
                                borderRadius="md"
                              >
                                <Input
                                  size="sm"
                                  bg="gray.900"
                                  value={f.value}
                                  placeholder="Field value"
                                  onChange={(e) =>
                                    setValue(
                                      `embeds.${index}.fields.${fieldIndex}.value`,
                                      e.target.value.trim(),
                                      {
                                        shouldDirty: true,
                                        shouldTouch: true,
                                      }
                                    )
                                  }
                                />
                              </Td>
                              <Td>
                                <Switch
                                  isChecked={!!f.inline}
                                  aria-label={`Is field ${fieldIndex + 1} inline?`}
                                  onChange={(e) =>
                                    setValue(
                                      `embeds.${index}.fields.${fieldIndex}.inline`,
                                      e.target.checked,
                                      {
                                        shouldDirty: true,
                                        shouldTouch: true,
                                      }
                                    )
                                  }
                                />
                              </Td>
                              <Td isNumeric>
                                <HStack justifyContent="flex-end">
                                  <IconButton
                                    aria-label={`Move field ${fieldIndex + 1} from position ${
                                      fieldIndex + 1
                                    } to position ${fieldIndex <= 0 ? 1 : fieldIndex}`}
                                    icon={<ChevronUpIcon />}
                                    variant="ghost"
                                    size="sm"
                                    isDisabled={fieldIndex === 0}
                                    onClick={() => moveField(fieldIndex, fieldIndex - 1)}
                                  />
                                  <IconButton
                                    aria-label={`Move field ${fieldIndex + 1} from position ${
                                      fieldIndex + 1
                                    } to position ${
                                      fieldIndex + 1 === embedFields.length
                                        ? embedFields.length
                                        : fieldIndex + 2
                                    }`}
                                    icon={<ChevronDownIcon />}
                                    variant="ghost"
                                    size="sm"
                                    isDisabled={fieldIndex === embedFields.length - 1}
                                    onClick={() => moveField(fieldIndex, fieldIndex + 1)}
                                  />
                                  <IconButton
                                    aria-label={`Delete field ${fieldIndex + 1}`}
                                    icon={<DeleteIcon />}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeField(fieldIndex)}
                                  />
                                </HStack>
                              </Td>
                            </Tr>
                          );
                        })}
                      </AnimatedComponent>
                    </Tbody>
                  </Table>
                </TableContainer>
                <Button
                  size="sm"
                  onClick={() =>
                    addField({
                      id: uniqueId("newfield-"),
                      name: "name",
                      value: "value",
                      inline: false,
                    })
                  }
                >
                  Add field
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </Box>
        <Box>
          <Stack
            direction={{ base: "column", md: "row" }}
            spacing={{ base: "1.5", md: "8" }}
            justify="space-between"
          >
            <Text size="sm" fontWeight={400} id="timestamp-label">
              Timestamp
            </Text>
            <Stack
              spacing={8}
              width="100%"
              maxW={{ md: "md", lg: "2xl", xl: "3xl" }}
              minW={{ md: "md", lg: "2xl", xl: "3xl" }}
            >
              <Controller
                name={`embeds.${index}.timestamp`}
                control={control}
                render={({ field }) => (
                  <FormControl>
                    <RadioGroup
                      {...field}
                      value={field.value || ""}
                      aria-labelledby="timestamp-label"
                    >
                      <Stack spacing={4}>
                        <Radio value="" defaultChecked>
                          {t("features.feedConnections.components.embedForm.timestampNone")}
                          <br />
                          <FormHelperText margin="0">
                            {t(
                              "features.feedConnections.components.embedForm.timestampNoneHelperText"
                            )}
                          </FormHelperText>
                        </Radio>
                        <Radio value="article">
                          {t("features.feedConnections.components.embedForm.timestampArticle")}
                          <br />
                          <FormHelperText margin="0">
                            {t(
                              "features.feedConnections.components.embedForm.timestampArticleHelperText"
                            )}
                          </FormHelperText>
                        </Radio>
                        <Radio value="now">
                          {t("features.feedConnections.components.embedForm.timestampNow")}
                          <br />
                          <FormHelperText margin="0">
                            {t(
                              "features.feedConnections.components.embedForm.timestampNowHelperText"
                            )}
                          </FormHelperText>
                        </Radio>
                      </Stack>
                    </RadioGroup>
                  </FormControl>
                )}
              />
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Stack>
  );
};
