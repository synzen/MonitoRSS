import { Box, Field, Separator, Stack, Textarea } from "@chakra-ui/react";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DiscordMessageFormDataLegacy } from "@/types/discord/DiscordMessageFormDataLegacy";

export const DiscordMessageContentFormLegacy = () => {
  const {
    control,
    formState: { errors },
  } = useFormContext<DiscordMessageFormDataLegacy>();
  const { t } = useTranslation();

  return (
    <Stack gap={8} separator={<Separator />}>
      <Field.Root invalid={!!errors.content}>
        <Stack
          direction={{ base: "column", md: "row" }}
          gap={{ base: "1.5", md: "8" }}
          justify="space-between"
        >
          <Box>
            <Field.Label>{t("components.discordMessageForm.contentSectionTitle")}</Field.Label>
            <Field.HelperText>
              You can use the placeholders listed above. A special placeholder, {`{empty}`}, can be
              used to create an empty message, but only if an embed is used. Regular formatting such
              as bold and etc. is also available.
            </Field.HelperText>
          </Box>
          <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
            <Controller
              name="content"
              control={control}
              render={({ field }) => (
                <Textarea size="sm" aria-label="Text content" spellCheck={false} {...field} />
              )}
            />
            {errors.content && <Field.ErrorText>{errors.content.message}</Field.ErrorText>}
          </Stack>
        </Stack>
      </Field.Root>
    </Stack>
  );
};
