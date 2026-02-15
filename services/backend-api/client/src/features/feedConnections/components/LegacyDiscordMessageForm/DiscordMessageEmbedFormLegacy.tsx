import {
  Box,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  IconButton,
  Input,
  Radio,
  RadioGroup,
  Stack,
  StackDivider,
  Textarea,
  Text,
} from "@chakra-ui/react";
import { useEffect } from "react";
import { Controller, FieldError, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { CloseIcon } from "@chakra-ui/icons";
import { getNestedField } from "@/utils/getNestedField";
import { EMBED_REQUIRES_ONE_OF, EMBED_REQUIRES_ONE_OF_ERROR_KEY } from "./constants";
import { DiscordMessageFormDataLegacy } from "../../../../types/discord/DiscordMessageFormDataLegacy";

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
    <Stack spacing={8}>
      <Stack spacing={8} divider={<StackDivider />}>
        <FormControl isInvalid={!!colorError}>
          <Stack
            direction={{ base: "column", md: "row" }}
            spacing={{ base: "1.5", md: "8" }}
            justify="space-between"
          >
            <FormLabel>Color</FormLabel>
            <Stack spacing={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
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
                        icon={<CloseIcon />}
                        isDisabled={!field.value}
                        onClick={() => field.onChange("")}
                      />
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
            <Stack spacing={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
              <FormControl isInvalid={!!authorNameError}>
                <FormLabel variant="inline">Name</FormLabel>
                <Controller
                  name={`embeds.${index}.author.name`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
                />
                {authorNameError && <FormErrorMessage>{authorNameError}</FormErrorMessage>}
              </FormControl>
              <FormControl isInvalid={!!authorUrlError}>
                <FormLabel variant="inline">URL</FormLabel>
                <Controller
                  name={`embeds.${index}.author.url`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
                />
                {authorUrlError && <FormErrorMessage>{authorUrlError}</FormErrorMessage>}
              </FormControl>
              <FormControl isInvalid={!!authorIconUrlError}>
                <FormLabel variant="inline">Icon URL</FormLabel>
                <Controller
                  name={`embeds.${index}.author.iconUrl`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
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
            <Stack spacing={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
              <FormControl isInvalid={!!titleError}>
                <FormLabel variant="inline">Text</FormLabel>
                <Controller
                  name={`embeds.${index}.title`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
                />
                {titleError && <FormErrorMessage>{titleError}</FormErrorMessage>}
              </FormControl>
              <FormControl isInvalid={!!urlError}>
                <FormLabel variant="inline">URL</FormLabel>
                <Controller
                  name={`embeds.${index}.url`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
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
            <Stack spacing={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
              <FormControl isInvalid={!!descriptionError}>
                <FormLabel variant="inline">Text</FormLabel>
                <Controller
                  name={`embeds.${index}.description`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <Textarea size="sm" {...field} value={field.value || ""} />
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
            <Stack spacing={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
              <FormControl isInvalid={!!imageUrlError}>
                <FormLabel variant="inline">Image URL</FormLabel>
                <Controller
                  name={`embeds.${index}.image.url`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
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
            <Stack spacing={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
              <FormControl isInvalid={!!thumbnailUrlError}>
                <FormLabel variant="inline">Image URL</FormLabel>
                <Controller
                  name={`embeds.${index}.thumbnail.url`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
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
            <Stack spacing={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
              <FormControl isInvalid={!!footerTextError}>
                <FormLabel variant="inline">Text</FormLabel>
                <Controller
                  name={`embeds.${index}.footer.text`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
                />
                {footerTextError && <FormErrorMessage>{footerTextError}</FormErrorMessage>}
              </FormControl>
              <FormControl isInvalid={!!footerIconUrlError}>
                <FormLabel variant="inline">Icon URL</FormLabel>
                <Controller
                  name={`embeds.${index}.footer.iconUrl`}
                  control={control}
                  defaultValue=""
                  render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
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
              Timestamp
            </Text>
            <Stack spacing={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
              <Controller
                name={`embeds.${index}.timestamp`}
                control={control}
                render={({ field }) => (
                  <FormControl>
                    <RadioGroup {...field} value={field.value || ""}>
                      <Stack spacing={4}>
                        <Radio value="" defaultChecked>
                          {t("features.feedConnections.components.embedForm.timestampNone")}
                          <br />
                          <FormHelperText margin="0">
                            {t(
                              "features.feedConnections.components.embedForm.timestampNoneHelperText",
                            )}
                          </FormHelperText>
                        </Radio>
                        <Radio value="article">
                          {t("features.feedConnections.components.embedForm.timestampArticle")}
                          <br />
                          <FormHelperText margin="0">
                            {t(
                              "features.feedConnections.components.embedForm.timestampArticleHelperText",
                            )}
                          </FormHelperText>
                        </Radio>
                        <Radio value="now">
                          {t("features.feedConnections.components.embedForm.timestampNow")}
                          <br />
                          <FormHelperText margin="0">
                            {t(
                              "features.feedConnections.components.embedForm.timestampNowHelperText",
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
