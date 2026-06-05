import { Box, Field, Input, Separator, Stack } from "@chakra-ui/react";
import { Controller, useFormContext } from "react-hook-form";
import { Switch } from "@/components/ui/switch";
import { DiscordMessageFormData } from "@/types/discord";
import MessagePlaceholderText from "../../../messageBuilder/components/MessagePlaceholderText";

export const DiscordMessageChannelThreadForm = () => {
  const {
    control,
    formState: { errors },
  } = useFormContext<DiscordMessageFormData>();

  return (
    <Stack gap={8} separator={<Separator />}>
      <Field.Root invalid={!!errors.channelNewThreadTitle}>
        <Stack
          direction={{ base: "column", md: "row" }}
          gap={{ base: "1.5", md: "8" }}
          justify="space-between"
        >
          <Box>
            <Field.Label>Thread Title</Field.Label>
            <Field.HelperText>
              The title of the thread that will be created per new article. You may use
              placeholders. The default is{" "}
              <MessagePlaceholderText withBrackets>title</MessagePlaceholderText>
            </Field.HelperText>
          </Box>
          <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "md", lg: "lg", xl: "3xl" }}>
            <Controller
              name="channelNewThreadTitle"
              control={control}
              render={({ field }) => <Input size="sm" {...field} value={field.value || ""} />}
            />
            <Field.ErrorText>{errors.channelNewThreadTitle?.message}</Field.ErrorText>
          </Stack>
        </Stack>
      </Field.Root>
      <Field.Root invalid={!!errors.channelNewThreadExcludesPreview}>
        <Stack
          direction={{ base: "column", md: "row" }}
          gap={{ base: "1.5", md: "8" }}
          justify="space-between"
        >
          <Box>
            <Field.Label id="thread-hide-message">Hide Message in Channel</Field.Label>
            <Field.HelperText id="thread-hide-message-helper">
              If enabled, the message contents will only be shown inside the thread. Only the thread
              title will be shown in the channel.
              <MessagePlaceholderText withBrackets>title</MessagePlaceholderText>
            </Field.HelperText>
          </Box>
          <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "md", lg: "lg", xl: "3xl" }}>
            <Controller
              name="channelNewThreadExcludesPreview"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value || false}
                  name={field.name}
                  onCheckedChange={(details) => field.onChange(details.checked)}
                  onBlur={field.onBlur}
                  aria-describedby="thread-hide-message-helper"
                  aria-labelledby="thread-hide-message"
                />
              )}
            />
            <Field.ErrorText>{errors.channelNewThreadExcludesPreview?.message}</Field.ErrorText>
          </Stack>
        </Stack>
      </Field.Root>
    </Stack>
  );
};
