import {
  Box,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  Stack,
  StackDivider,
  Switch,
} from "@chakra-ui/react";
import { Controller, useFormContext } from "react-hook-form";
import { DiscordMessageFormData } from "@/types/discord";
import MessagePlaceholderText from "../../../../components/MessagePlaceholderText";

export const DiscordMessageChannelThreadForm = () => {
  const {
    control,
    formState: { errors },
  } = useFormContext<DiscordMessageFormData>();

  return (
    <Stack spacing={8} divider={<StackDivider />}>
      <FormControl isInvalid={!!errors.channelNewThreadTitle}>
        <Stack
          direction={{ base: "column", md: "row" }}
          spacing={{ base: "1.5", md: "8" }}
          justify="space-between"
        >
          <Box>
            <FormLabel>Thread Title</FormLabel>
            <FormHelperText>
              The title of the thread that will be created per new article. You may use
              placeholders. The default is{" "}
              <MessagePlaceholderText withBrackets>title</MessagePlaceholderText>
            </FormHelperText>
          </Box>
          <Stack
            spacing={8}
            width="100%"
            maxW={{ md: "3xl" }}
            minW={{ md: "md", lg: "lg", xl: "3xl" }}
          >
            <Controller
              name="channelNewThreadTitle"
              control={control}
              render={({ field }) => (
                <Input size="sm" {...field} bg="gray.900" value={field.value || ""} />
              )}
            />
            <FormErrorMessage>{errors.channelNewThreadTitle?.message}</FormErrorMessage>
          </Stack>
        </Stack>
      </FormControl>
      <FormControl isInvalid={!!errors.channelNewThreadExcludesPreview}>
        <Stack
          direction={{ base: "column", md: "row" }}
          spacing={{ base: "1.5", md: "8" }}
          justify="space-between"
        >
          <Box>
            <FormLabel id="thread-hide-message">Hide Message in Channel</FormLabel>
            <FormHelperText id="thread-hide-message-helper">
              If enabled, the message contents will only be shown inside the thread. Only the thread
              title will be shown in the channel.
              <MessagePlaceholderText withBrackets>title</MessagePlaceholderText>
            </FormHelperText>
          </Box>
          <Stack
            spacing={8}
            width="100%"
            maxW={{ md: "3xl" }}
            minW={{ md: "md", lg: "lg", xl: "3xl" }}
          >
            <Controller
              name="channelNewThreadExcludesPreview"
              control={control}
              render={({ field }) => (
                <Switch
                  isChecked={field.value || false}
                  name={field.name}
                  onChange={(e) => field.onChange(e.target.checked)}
                  onBlur={field.onBlur}
                  aria-describedby="thread-hide-message-helper"
                  aria-labelledby="thread-hide-message"
                />
              )}
            />
            <FormErrorMessage>{errors.channelNewThreadExcludesPreview?.message}</FormErrorMessage>
          </Stack>
        </Stack>
      </FormControl>
    </Stack>
  );
};
