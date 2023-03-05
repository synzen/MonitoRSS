import {
  Button,
  Center,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Link,
  Stack,
  Text,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import dayjs from "dayjs";
import { Controller, useForm } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { InferType, object, string } from "yup";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { InlineErrorAlert, Loading } from "../../../../components";
import { notifyError } from "../../../../utils/notifyError";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { useUpdateUserFeed, useUserFeed } from "../../../feed/hooks";

dayjs.extend(utc);
dayjs.extend(timezone);

interface Props {
  feedId: string;
}

const FormSchema = object({
  dateFormat: string().optional(),
  dateTimezone: string().test("is-timezone", "Must be a valid timezone", (val) => {
    if (!val) {
      return true;
    }

    try {
      dayjs().tz(val);

      return true;
    } catch (err) {
      if (err instanceof RangeError) {
        return false;
      }

      throw err;
    }
  }),
});

type FormValues = InferType<typeof FormSchema>;

export const UserFeedSettingsTabSection = ({ feedId }: Props) => {
  const { t } = useTranslation();
  const {
    status: feedStatus,
    feed,
    error: feedError,
  } = useUserFeed({
    feedId,
  });

  const {
    handleSubmit,
    control,
    reset,
    formState: { isDirty, isSubmitting, errors: formErrors },
    watch,
  } = useForm<FormValues>({
    resolver: yupResolver(FormSchema),
    defaultValues: {
      dateFormat: feed?.formatOptions?.dateFormat || "",
      dateTimezone: feed?.formatOptions?.dateTimezone || "",
    },
  });

  const [dateFormat, dateTimezone] = watch(["dateFormat", "dateTimezone"]);

  const { mutateAsync } = useUpdateUserFeed();

  const onUpdatedFeed = async (values: FormValues) => {
    try {
      const updatedFeed = await mutateAsync({
        feedId,
        data: {
          formatOptions: {
            dateFormat: values.dateFormat?.trim() || undefined,
            dateTimezone: values.dateTimezone?.trim() || undefined,
          },
        },
      });

      reset({
        dateFormat: updatedFeed.result.formatOptions?.dateFormat || "",
        dateTimezone: updatedFeed.result.formatOptions?.dateTimezone || "",
      });
      notifySuccess(t("common.success.savedChanges"));
    } catch (error) {
      notifyError(t("common.errors.somethingWentWrong"), error as Error);
    }
  };

  let datePreview: React.ReactNode;

  try {
    const previewDayjs = dayjs().tz(dateTimezone || "utc");

    datePreview = (
      <Text fontSize="xl" color="gray.400">
        {previewDayjs.format(dateFormat)}
      </Text>
    );
  } catch (err) {
    datePreview = (
      <Text fontSize="xl" color="red.400">
        {t("features.feedConnections.components.userFeedSettingsTabSection.invalidTimezone")}
      </Text>
    );
  }

  if (feedStatus === "loading") {
    return (
      <Center>
        <Loading size="xl" />
      </Center>
    );
  }

  if (feedError) {
    return (
      <InlineErrorAlert
        title={t("common.errors.somethingWentWrong")}
        description={feedError.message}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onUpdatedFeed)}>
      <Stack spacing={12} marginBottom={8}>
        <Stack spacing={4}>
          <Heading size="md" as="h3">
            {t("features.feedConnections.components.userFeedSettingsTabSection.title")}
          </Heading>
          <Text>
            {t("features.feedConnections.components.userFeedSettingsTabSection.description")}
          </Text>
        </Stack>
        <Stack spacing={4}>
          <Heading size="sm" as="h3">
            {t("features.feedConnections.components.userFeedSettingsTabSection.dateSettingsTitle")}
          </Heading>
          <Stack spacing={4}>
            <FormControl>
              <FormLabel>
                {t(
                  "features.feedConnections.components.userFeedSettingsTabSection.dateSettingsPreviewTitle"
                )}
              </FormLabel>
              {datePreview}
            </FormControl>
            <Controller
              name="dateFormat"
              control={control}
              render={({ field }) => (
                <FormControl isInvalid={!!formErrors.dateFormat}>
                  <FormLabel>
                    {t(
                      "features.feedConnections.components.userFeedSettingsTabSection.dateFormatInputLabel"
                    )}
                  </FormLabel>
                  <Input size="sm" spellCheck={false} autoComplete="" {...field} />
                  {!formErrors.dateFormat && (
                    <FormHelperText>
                      {t(
                        "features.feedConnections.components.userFeedSettingsTabSection.dateFormatInputDescription"
                      )}
                    </FormHelperText>
                  )}
                  {formErrors.dateFormat && (
                    <FormErrorMessage>{formErrors.dateFormat.message}</FormErrorMessage>
                  )}
                </FormControl>
              )}
            />
            <Controller
              name="dateTimezone"
              control={control}
              render={({ field }) => (
                <FormControl isInvalid={!!formErrors.dateTimezone}>
                  <FormLabel>
                    {t(
                      "features.feedConnections.components.userFeedSettingsTabSection.dateTimezoneInputLabel"
                    )}
                  </FormLabel>
                  <Input size="sm" spellCheck={false} {...field} />
                  {!formErrors.dateTimezone && (
                    <FormHelperText>
                      <Trans
                        i18nKey="features.feedConnections.components.userFeedSettingsTabSection.dateTimezoneInputDescription"
                        components={[
                          <Link
                            href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones"
                            target="_blank"
                            rel="noreferrer noopener"
                            color="blue.400"
                          />,
                        ]}
                      />
                    </FormHelperText>
                  )}
                  {formErrors.dateTimezone && (
                    <FormErrorMessage>
                      {formErrors.dateTimezone.message} (
                      <Trans
                        i18nKey="features.feedConnections.components.userFeedSettingsTabSection.dateTimezoneInputDescription"
                        components={[
                          <Link
                            href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones"
                            target="_blank"
                            rel="noreferrer noopener"
                            color="blue.400"
                          />,
                        ]}
                      />
                      )
                    </FormErrorMessage>
                  )}
                </FormControl>
              )}
            />
          </Stack>
        </Stack>
      </Stack>
      <HStack justifyContent="flex-end">
        <Button disabled={!isDirty || isSubmitting} onClick={() => reset()} variant="ghost">
          {t("common.buttons.reset")}
        </Button>
        <Button
          type="submit"
          colorScheme="blue"
          isLoading={isSubmitting}
          disabled={isSubmitting || !isDirty}
        >
          {t("common.buttons.save")}
        </Button>
      </HStack>
    </form>
  );
};
