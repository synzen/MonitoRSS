import {
  Box,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  Stack,
  StackDivider,
} from "@chakra-ui/react";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DiscordMessageFormData } from "@/types/discord";

export const DiscordMessageForumThreadForm = () => {
  const {
    control,
    formState: { errors },
  } = useFormContext<DiscordMessageFormData>();
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
            <FormLabel>{t("components.discordMessageForumThreadForm.threadTitleLabel")}</FormLabel>
            <FormHelperText>
              {t("components.discordMessageForumThreadForm.threadTitleDescription")}
            </FormHelperText>
          </Box>
          <Stack spacing={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
            <Controller
              name="forumThreadTitle"
              control={control}
              render={({ field }) => (
                <Input size="sm" aria-label="Forum thread title" spellCheck={false} {...field} />
              )}
            />
            {errors.content && <FormErrorMessage>{errors.content.message}</FormErrorMessage>}
          </Stack>
        </Stack>
      </FormControl>
    </Stack>
  );
};
