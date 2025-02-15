import {
  Button,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Stack,
} from "@chakra-ui/react";
import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { InferType, object, string } from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { useEffect } from "react";
import { useFeed } from "../../hooks";
import { DiscordChannelDropdown } from "@/features/discordServers";
import { notifySuccess } from "@/utils/notifySuccess";
import { useUpdateFeed } from "../../hooks/useUpdateFeed";
import { Feed } from "@/types";
import { notifyError } from "@/utils/notifyError";
import { UpdateFeedInput } from "../../api";

const formSchema = object({
  channelId: string(),
  title: string(),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  feedId: string;
  serverId: string;
  onUpdated: (feed: Feed) => void;
}

export const SettingsForm: React.FC<Props> = ({ feedId, serverId, onUpdated }) => {
  const { t } = useTranslation();
  const { feed } = useFeed({
    feedId,
  });
  const { mutateAsync } = useUpdateFeed();
  const defaultFormValues: FormData = {
    channelId: feed?.channel,
    title: feed?.title,
  };
  const {
    handleSubmit,
    control,
    reset,
    formState: { isDirty, isSubmitting },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    defaultValues: defaultFormValues,
  });

  const resetForm = () => {
    reset(defaultFormValues);
  };

  const onSubmit = async (formData: FormData) => {
    try {
      const input: UpdateFeedInput = {
        feedId,
        details: {},
      };

      if (formData.channelId !== feed?.channel) {
        input.details.channelId = formData.channelId;
      }

      if (formData.title !== feed?.title) {
        input.details.title = formData.title;
      }

      const updatedFeed = await mutateAsync(input);
      onUpdated(updatedFeed.result);
      await notifySuccess(t("features.feed.components.sidebar.updateSuccess"));
      reset({
        channelId: updatedFeed.result.channel,
        title: updatedFeed.result.title,
      });
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  useEffect(() => {
    resetForm();
  }, [feed]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={4}>
        <FormControl>
          <FormLabel htmlFor="title">
            {t("features.feed.components.sidebar.titleFormLabel")}
          </FormLabel>
          <Controller name="title" control={control} render={({ field }) => <Input {...field} />} />
          <FormHelperText>{t("features.feed.components.sidebar.titleFormHint")}</FormHelperText>
        </FormControl>
        <FormControl>
          <FormLabel htmlFor="channel-select" id="channel-select-label">
            {t("features.feed.components.sidebar.channelFormLabel")}
          </FormLabel>
          <Controller
            name="channelId"
            control={control}
            render={({ field }) => (
              <DiscordChannelDropdown
                isInvalid={false}
                onBlur={field.onBlur}
                onChange={field.onChange}
                serverId={serverId}
                value={field.value}
                inputId="channel-select"
                ariaLabelledBy="channel-select-label"
              />
            )}
          />
        </FormControl>
        <Flex justifyContent="flex-end">
          <HStack>
            <Button onClick={() => reset()} variant="ghost" isDisabled={!isDirty || isSubmitting}>
              <span>{t("features.feed.components.sidebar.resetButton")}</span>
            </Button>
            <Button
              type="submit"
              colorScheme="blue"
              isDisabled={isSubmitting || !isDirty}
              isLoading={isSubmitting}
            >
              <span>{t("features.feed.components.sidebar.saveButton")}</span>
            </Button>
          </HStack>
        </Flex>
      </Stack>
    </form>
  );
};
