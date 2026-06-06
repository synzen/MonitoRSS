import { Box, HStack, IconButton, Input, Separator, Stack, Textarea, Text } from "@chakra-ui/react";
import { useEffect } from "react";
import { Controller, FieldError, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FaXmark } from "react-icons/fa6";
import { getNestedField } from "@/utils/getNestedField";
import { EMBED_REQUIRES_ONE_OF, EMBED_REQUIRES_ONE_OF_ERROR_KEY } from "./constants";
import { DiscordMessageFormDataLegacy } from "@/types/discord/DiscordMessageFormDataLegacy";
import { Field } from "@/components/ui/field";
import { Radio, RadioGroup } from "@/components/ui/radio";

interface Props {
  index: number;
}

export const DiscordMessageEmbedFormLegacy = ({ index }: Props) => {
  const {
    control,
    formState: { errors },
    setError,
    clearErrors,
  } = useFormContext<DiscordMessageFormDataLegacy>();
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
            <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
              <Controller
                name={`embeds.${index}.color`}
                control={control}
                render={({ field }) => {
                  const hexValue = field.value
                    ? `#${Number(field.value).toString(16).padStart(6, "0")}`
                    : "";

                  return (
                    <HStack>
                      <input
                        type="color"
                        {...field}
                        value={hexValue}
                        onChange={(e) => {
                          const hexColorAsNumberString = parseInt(
                            e.target.value.replace("#", ""),
                            16,
                          ).toString();

                          field.onChange(hexColorAsNumberString);
                        }}
                        style={{
                          cursor: "pointer",
                          width: "100%",
                        }}
                      />
                      <IconButton
                        size="xs"
                        aria-label="Clear color"
                        disabled={!field.value}
                        onClick={() => field.onChange("")}
                      >
                        <FaXmark />
                      </IconButton>
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
            <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
              <Field invalid={!!authorNameError} errorText={authorNameError} label="Name">
                <Controller
                  name={`embeds.${index}.author.name`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
                />
              </Field>
              <Field invalid={!!authorUrlError} errorText={authorUrlError} label="URL">
                <Controller
                  name={`embeds.${index}.author.url`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
                />
              </Field>
              <Field invalid={!!authorIconUrlError} errorText={authorIconUrlError} label="Icon URL">
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
            <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
              <Field invalid={!!titleError} errorText={titleError} label="Text">
                <Controller
                  name={`embeds.${index}.title`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
                />
              </Field>
              <Field invalid={!!urlError} errorText={urlError} label="URL">
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
            <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
              <Field invalid={!!descriptionError} errorText={descriptionError} label="Text">
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
            <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
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
            <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
              <Field invalid={!!thumbnailUrlError} errorText={thumbnailUrlError} label="Image URL">
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
            <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
              <Field invalid={!!footerTextError} errorText={footerTextError} label="Text">
                <Controller
                  name={`embeds.${index}.footer.text`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
                />
              </Field>
              <Field invalid={!!footerIconUrlError} errorText={footerIconUrlError} label="Icon URL">
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
              Timestamp
            </Text>
            <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
              <Controller
                name={`embeds.${index}.timestamp`}
                control={control}
                render={({ field }) => (
                  <Field>
                    <RadioGroup
                      value={field.value || ""}
                      onValueChange={(details) => field.onChange(details.value)}
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
