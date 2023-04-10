import {
  Box,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Stack,
  StackDivider,
  Textarea,
} from "@chakra-ui/react";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DiscordMessageFormDataLegacy } from "../../../../types/discord/DiscordMessageFormDataLegacy";

export const DiscordMessageContentFormLegacy = () => {
  const {
    control,
    formState: { errors },
  } = useFormContext<DiscordMessageFormDataLegacy>();
  const { t } = useTranslation();

  return (
    <Stack spacing={8} divider={<StackDivider />}>
      <FormControl isInvalid={!!errors.content}>
        <Stack
          direction={{ base: "column", md: "row" }}
          spacing={{ base: "1.5", md: "8" }}
          justify="space-between"
        >
          <Box>
            <FormLabel>{t("components.discordMessageForm.contentSectionTitle")}</FormLabel>
            <FormHelperText>
              You can use the placeholders listed above. A special placeholder, {`{empty}`}, can be
              used to create an empty message, but only if an embed is used. Regular formatting such
              as bold and etc. is also available.
            </FormHelperText>
          </Box>
          <Stack spacing={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
            <Controller
              name="content"
              control={control}
              render={({ field }) => (
                <Textarea size="sm" aria-label="Text content" spellCheck={false} {...field} />
              )}
            />
            {errors.content && <FormErrorMessage>{errors.content.message}</FormErrorMessage>}
          </Stack>
        </Stack>
      </FormControl>
    </Stack>
  );
};
