import {
  Box,
  IconButton,
  Input,
  Separator,
  Stack,
  Textarea,
  Text,
  HStack,
  Button,
  Table,
} from "@chakra-ui/react";
import { useEffect } from "react";
import { Controller, FieldError, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FaChevronDown, FaChevronUp, FaXmark, FaTrash } from "react-icons/fa6";
import { SketchPicker } from "react-color";
import { motion } from "motion/react";
import { uniqueId } from "lodash";
import { DiscordMessageFormData } from "@/types/discord";
import { getNestedField } from "@/utils/getNestedField";
import { EMBED_REQUIRES_ONE_OF, EMBED_REQUIRES_ONE_OF_ERROR_KEY } from "./constants";
import { AnimatedComponent } from "@/components";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Radio, RadioGroup } from "@/components/ui/radio";
import { PopoverRoot, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

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
        getNestedField(embed, key),
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
    EMBED_REQUIRES_ONE_OF.map((key) => getNestedField(embed, key)),
  );

  const getEmbedError = (fieldName: string) => {
    const error: FieldError | undefined = getNestedField(
      (errors.embeds as any)?.[index],
      fieldName,
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
    <Stack gap={8}>
      <Stack gap={8} separator={<Separator />}>
        <Field invalid={!!colorError} errorText={colorError}>
          <Stack
            direction={{ base: "column", md: "row" }}
            gap={{ base: "1.5", md: "8" }}
            justify="space-between"
          >
            <label>Color</label>
            <Stack
              gap={8}
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
                        <PopoverRoot>
                          <PopoverTrigger asChild>
                            <Button
                              // height="40px"
                              backgroundColor={!hexValue ? "black" : `${hexValue}`}
                              flex={1}
                              borderStyle="solid"
                              borderWidth="1px"
                              borderColor="border.emphasized"
                              aria-label="Pick color"
                              size={["sm", "sm", "md"]}
                              _hover={{
                                background: !hexValue ? "black" : hexValue,
                                outline: "solid 2px var(--app-accent-focus-ring)",
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
                                  16,
                                ).toString();

                                field.onChange(hexColorAsNumberString);
                              }}
                            />
                          </PopoverContent>
                        </PopoverRoot>
                        <IconButton
                          size={["sm", "sm", "md"]}
                          aria-label="Clear color"
                          disabled={!field.value}
                          onClick={() => field.onChange("")}
                        >
                          <FaXmark />
                        </IconButton>
                      </HStack>
                    </HStack>
                  );
                }}
              />
            </Stack>
          </Stack>
        </Field>
        <Box>
          <Stack
            direction={{ base: "column", md: "row" }}
            gap={{ base: "1.5", md: "8" }}
            justify="space-between"
          >
            <Text textStyle="sm" fontWeight={400}>
              Author
            </Text>
            <Stack
              gap={8}
              width="100%"
              maxW={{ md: "md", lg: "2xl", xl: "3xl" }}
              minW={{ md: "md", lg: "2xl", xl: "3xl" }}
            >
              <Field invalid={!!authorNameError} errorText={authorNameError} label="Author Name">
                <Controller
                  name={`embeds.${index}.author.name`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
                />
              </Field>
              <Field invalid={!!authorUrlError} errorText={authorUrlError} label="Author URL">
                <Controller
                  name={`embeds.${index}.author.url`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
                />
              </Field>
              <Field
                invalid={!!authorIconUrlError}
                errorText={authorIconUrlError}
                label="Author Icon URL"
              >
                <Controller
                  name={`embeds.${index}.author.iconUrl`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
                />
              </Field>
            </Stack>
          </Stack>
        </Box>
        <Box>
          <Stack
            direction={{ base: "column", md: "row" }}
            gap={{ base: "1.5", md: "8" }}
            justify="space-between"
          >
            <Text textStyle="sm" fontWeight={400}>
              Title
            </Text>
            <Stack
              gap={8}
              width="100%"
              maxW={{ md: "md", lg: "2xl", xl: "3xl" }}
              minW={{ md: "md", lg: "2xl", xl: "3xl" }}
            >
              <Field invalid={!!titleError} errorText={titleError} label="Title Text">
                <Controller
                  name={`embeds.${index}.title`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
                />
              </Field>
              <Field invalid={!!urlError} errorText={urlError} label="Title URL">
                <Controller
                  name={`embeds.${index}.url`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
                />
              </Field>
            </Stack>
          </Stack>
        </Box>
        <Box>
          <Stack
            direction={{ base: "column", md: "row" }}
            gap={{ base: "1.5", md: "8" }}
            justify="space-between"
          >
            <Text textStyle="sm" fontWeight={400}>
              Description
            </Text>
            <Stack
              gap={8}
              width="100%"
              maxW={{ md: "md", lg: "2xl", xl: "3xl" }}
              minW={{ md: "md", lg: "2xl", xl: "3xl" }}
            >
              <Field
                invalid={!!descriptionError}
                errorText={descriptionError}
                label="Description Text"
              >
                <Controller
                  name={`embeds.${index}.description`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <Textarea size="sm" {...field} value={field.value || ""} />
                  )}
                />
              </Field>
            </Stack>
          </Stack>
        </Box>
        <Box>
          <Stack
            direction={{ base: "column", md: "row" }}
            gap={{ base: "1.5", md: "8" }}
            justify="space-between"
          >
            <Text textStyle="sm" fontWeight={400}>
              Image
            </Text>
            <Stack
              gap={8}
              width="100%"
              maxW={{ md: "md", lg: "2xl", xl: "3xl" }}
              minW={{ md: "md", lg: "2xl", xl: "3xl" }}
            >
              <Field invalid={!!imageUrlError} errorText={imageUrlError} label="Image URL">
                <Controller
                  name={`embeds.${index}.image.url`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
                />
              </Field>
            </Stack>
          </Stack>
        </Box>
        <Box>
          <Stack
            direction={{ base: "column", md: "row" }}
            gap={{ base: "1.5", md: "8" }}
            justify="space-between"
          >
            <Text textStyle="sm" fontWeight={400}>
              Thumbnail
            </Text>
            <Stack
              gap={8}
              width="100%"
              maxW={{ md: "md", lg: "2xl", xl: "3xl" }}
              minW={{ md: "md", lg: "2xl", xl: "3xl" }}
            >
              <Field
                invalid={!!thumbnailUrlError}
                errorText={thumbnailUrlError}
                label="Thumbnail Image URL"
              >
                <Controller
                  name={`embeds.${index}.thumbnail.url`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
                />
              </Field>
            </Stack>
          </Stack>
        </Box>
        <Box>
          <Stack
            direction={{ base: "column", md: "row" }}
            gap={{ base: "1.5", md: "8" }}
            justify="space-between"
          >
            <Text textStyle="sm" fontWeight={400}>
              Footer
            </Text>
            <Stack
              gap={8}
              width="100%"
              maxW={{ md: "md", lg: "2xl", xl: "3xl" }}
              minW={{ md: "md", lg: "2xl", xl: "3xl" }}
            >
              <Field invalid={!!footerTextError} errorText={footerTextError} label="Footer Text">
                <Controller
                  name={`embeds.${index}.footer.text`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
                />
              </Field>
              <Field
                invalid={!!footerIconUrlError}
                errorText={footerIconUrlError}
                label="Footer Icon URL"
              >
                <Controller
                  name={`embeds.${index}.footer.iconUrl`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
                />
              </Field>
            </Stack>
          </Stack>
        </Box>
        <Box>
          <Stack
            direction={{ base: "column", md: "row" }}
            gap={{ base: "1.5", md: "8" }}
            justify="space-between"
          >
            <Text textStyle="sm" fontWeight={400}>
              Fields
            </Text>
            <Stack
              gap={8}
              width="100%"
              maxW={{ md: "md", lg: "2xl", xl: "3xl" }}
              minW={{ md: "md", lg: "2xl", xl: "3xl" }}
            >
              <Stack>
                <Table.ScrollArea>
                  <Table.Root size="sm">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Field Name</Table.ColumnHeader>
                        <Table.ColumnHeader>Field Value</Table.ColumnHeader>
                        <Table.ColumnHeader>Is Field Inline?</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="right">Actions</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      <AnimatedComponent>
                        {embed.fields?.map((f, fieldIndex) => {
                          return (
                            <Table.Row key={f.id} asChild>
                              <motion.tr
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
                                <Table.Cell
                                  border={
                                    errors.embeds?.[index]?.fields?.[fieldIndex]?.name
                                      ? "solid 2px var(--app-error)"
                                      : ""
                                  }
                                  borderRadius="l3"
                                >
                                  <Input
                                    size="sm"
                                    value={f.name}
                                    placeholder="Field name"
                                    onChange={(e) =>
                                      setValue(
                                        `embeds.${index}.fields.${fieldIndex}.name`,
                                        e.target.value.trim(),
                                        {
                                          shouldDirty: true,
                                          shouldTouch: true,
                                        },
                                      )
                                    }
                                  />
                                </Table.Cell>
                                <Table.Cell
                                  border={
                                    errors.embeds?.[index]?.fields?.[fieldIndex]?.value
                                      ? "solid 2px var(--app-error)"
                                      : ""
                                  }
                                  borderRadius="l3"
                                >
                                  <Input
                                    size="sm"
                                    value={f.value}
                                    placeholder="Field value"
                                    onChange={(e) =>
                                      setValue(
                                        `embeds.${index}.fields.${fieldIndex}.value`,
                                        e.target.value.trim(),
                                        {
                                          shouldDirty: true,
                                          shouldTouch: true,
                                        },
                                      )
                                    }
                                  />
                                </Table.Cell>
                                <Table.Cell>
                                  <Switch
                                    checked={!!f.inline}
                                    aria-label={`Is field ${fieldIndex + 1} inline?`}
                                    onCheckedChange={(e) =>
                                      setValue(
                                        `embeds.${index}.fields.${fieldIndex}.inline`,
                                        e.checked,
                                        {
                                          shouldDirty: true,
                                          shouldTouch: true,
                                        },
                                      )
                                    }
                                  />
                                </Table.Cell>
                                <Table.Cell textAlign="right">
                                  <HStack justifyContent="flex-end">
                                    <IconButton
                                      aria-label={`Move field ${fieldIndex + 1} from position ${
                                        fieldIndex + 1
                                      } to position ${fieldIndex <= 0 ? 1 : fieldIndex}`}
                                      variant="ghost"
                                      size="sm"
                                      disabled={fieldIndex === 0}
                                      onClick={() => moveField(fieldIndex, fieldIndex - 1)}
                                    >
                                      <FaChevronUp />
                                    </IconButton>
                                    <IconButton
                                      aria-label={`Move field ${fieldIndex + 1} from position ${
                                        fieldIndex + 1
                                      } to position ${
                                        fieldIndex + 1 === embedFields.length
                                          ? embedFields.length
                                          : fieldIndex + 2
                                      }`}
                                      variant="ghost"
                                      size="sm"
                                      disabled={fieldIndex === embedFields.length - 1}
                                      onClick={() => moveField(fieldIndex, fieldIndex + 1)}
                                    >
                                      <FaChevronDown />
                                    </IconButton>
                                    <IconButton
                                      aria-label={`Delete field ${fieldIndex + 1}`}
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeField(fieldIndex)}
                                    >
                                      <FaTrash />
                                    </IconButton>
                                  </HStack>
                                </Table.Cell>
                              </motion.tr>
                            </Table.Row>
                          );
                        })}
                      </AnimatedComponent>
                    </Table.Body>
                  </Table.Root>
                </Table.ScrollArea>
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
            gap={{ base: "1.5", md: "8" }}
            justify="space-between"
          >
            <Text textStyle="sm" fontWeight={400} id="timestamp-label">
              Timestamp
            </Text>
            <Stack
              gap={8}
              width="100%"
              maxW={{ md: "md", lg: "2xl", xl: "3xl" }}
              minW={{ md: "md", lg: "2xl", xl: "3xl" }}
            >
              <Controller
                name={`embeds.${index}.timestamp`}
                control={control}
                render={({ field }) => (
                  <Field>
                    <RadioGroup
                      value={field.value || ""}
                      onValueChange={(details) => field.onChange(details.value)}
                      aria-labelledby="timestamp-label"
                    >
                      <Stack gap={4}>
                        <Radio value="" defaultChecked>
                          {t("features.feedConnections.components.embedForm.timestampNone")}
                          <br />
                          <Text as="span" fontSize="sm" color="fg.muted" margin="0">
                            {t(
                              "features.feedConnections.components.embedForm.timestampNoneHelperText",
                            )}
                          </Text>
                        </Radio>
                        <Radio value="article">
                          {t("features.feedConnections.components.embedForm.timestampArticle")}
                          <br />
                          <Text as="span" fontSize="sm" color="fg.muted" margin="0">
                            {t(
                              "features.feedConnections.components.embedForm.timestampArticleHelperText",
                            )}
                          </Text>
                        </Radio>
                        <Radio value="now">
                          {t("features.feedConnections.components.embedForm.timestampNow")}
                          <br />
                          <Text as="span" fontSize="sm" color="fg.muted" margin="0">
                            {t(
                              "features.feedConnections.components.embedForm.timestampNowHelperText",
                            )}
                          </Text>
                        </Radio>
                      </Stack>
                    </RadioGroup>
                  </Field>
                )}
              />
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Stack>
  );
};
