import {
  Box,
  Checkbox,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  Input,
  Stack,
  StackDivider,
  Textarea,
} from "@chakra-ui/react";
import { Control, Controller, FieldErrorsImpl, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DiscordMessageFormData } from "@/types/discord";

interface Props {
  control: Control<DiscordMessageFormData>;
  errors: FieldErrorsImpl<DiscordMessageFormData>;
}

export const DiscordMessageContentForm = ({ control, errors }: Props) => {
  const splitOptions = useWatch({
    control,
    name: `splitOptions`,
  });
  const { t } = useTranslation();

  return (
    <Stack spacing={8} divider={<StackDivider />}>
      <Box>
        <Stack
          direction={{ base: "column", md: "row" }}
          spacing={{ base: "1.5", md: "8" }}
          justify="space-between"
        >
          <Heading size="sm" fontWeight={600}>
            {t("components.discordMessageForm.contentSectionTitle")}
          </Heading>
          <Stack spacing={8} width="100%" maxW={{ md: "3xl" }}>
            <FormControl isInvalid={!!errors.content}>
              <Controller
                name="content"
                control={control}
                render={({ field }) => (
                  <Textarea aria-label="Text content" spellCheck={false} {...field} />
                )}
              />
              {errors.content && <FormErrorMessage>{errors.content.message}</FormErrorMessage>}
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
          <Heading size="sm" fontWeight={600}>
            {t("components.discordMessageForm.splitContentSectionTitle")}
          </Heading>
          <Stack spacing={8} width="100%" maxW={{ md: "3xl" }}>
            <FormControl>
              <Controller
                name="splitOptions"
                control={control}
                render={({ field }) => {
                  return (
                    <Checkbox
                      name={field.name}
                      isChecked={!!field.value}
                      onChange={(e) => {
                        if (e.currentTarget.checked) {
                          field.onChange({});
                        } else {
                          field.onChange(null);
                        }
                      }}
                    >
                      {t("components.discordMessageForm.splitContentCheckboxLabel")}
                    </Checkbox>
                  );
                }}
              />
              <FormHelperText>
                {t("components.discordMessageForm.splitContentCheckboxDescription")}
              </FormHelperText>
            </FormControl>
            {splitOptions && (
              <>
                <FormControl>
                  <FormLabel>
                    {t("components.discordMessageForm.splitContentSplitCharLabel")}
                  </FormLabel>
                  <Controller
                    name="splitOptions.splitChar"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        size="sm"
                        aria-label="Split character"
                        spellCheck={false}
                        value={field.value || ""}
                      />
                    )}
                  />
                  <FormHelperText>
                    {t("components.discordMessageForm.splitContentSplitCharDescription")}
                  </FormHelperText>
                </FormControl>
                <FormControl>
                  <FormLabel>
                    {t("components.discordMessageForm.splitContentAppendCharLabel")}
                  </FormLabel>
                  <Controller
                    name="splitOptions.appendChar"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        size="sm"
                        aria-label="Append character"
                        spellCheck={false}
                        value={field.value || ""}
                      />
                    )}
                  />
                  <FormHelperText>
                    {t("components.discordMessageForm.splitContentAppendCharDescription")}
                  </FormHelperText>
                </FormControl>
                <FormControl>
                  <FormLabel>
                    {t("components.discordMessageForm.splitContentPrependCharLabel")}
                  </FormLabel>
                  <Controller
                    name="splitOptions.prependChar"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        size="sm"
                        aria-label="Prepend character"
                        spellCheck={false}
                        value={field.value || ""}
                      />
                    )}
                  />
                  <FormHelperText>
                    {t("components.discordMessageForm.splitContentPrependCharDescription")}
                  </FormHelperText>
                </FormControl>
              </>
            )}
          </Stack>
        </Stack>
      </Box>
    </Stack>
  );
};
