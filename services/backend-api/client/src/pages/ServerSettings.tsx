import { useParams } from "react-router-dom";
import {
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { InferType, object, string } from "yup";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useEffect, useMemo, useState } from "react";
import {
  DiscordServerBackupButton,
  LiveClock,
  RequireServerBotAccess,
  useDiscordServerSettings,
  useUpdateDiscordServerSettings,
} from "@/features/discordServers";
import RouteParams from "@/types/RouteParams";
import { DashboardContent } from "@/components";
import getChakraColor from "@/utils/getChakraColor";
import { notifyError } from "@/utils/notifyError";
// Must use moment for backwards compatibility with server logic

interface Props {}

export const ServerSettings: React.FC<Props> = () => {
  const { serverId } = useParams<RouteParams>();
  const { data, error, status } = useDiscordServerSettings({ serverId });
  const { mutateAsync } = useUpdateDiscordServerSettings();
  const { t } = useTranslation();

  const formSchema = useMemo(
    () =>
      object({
        dateFormat: string().min(1, t("pages.serverSettings.dateFormatInputErrorEmpty")),
        timezone: string().test(
          "timezone",
          t("pages.serverSettings.timezoneInputErrorInvalid"),
          (value) => {
            if (!value) {
              return false;
            }

            return Intl.supportedValuesOf("timeZone").includes(value);
          }
        ),
      }).required(),
    []
  );

  type FormData = InferType<typeof formSchema>;

  const defaultFormValues = {
    dateFormat: data?.profile.dateFormat || "",
    timezone: data?.profile.timezone || "",
  };
  const [formValuesSoFar, setFormValuesSoFar] = useState<FormData>(defaultFormValues);
  const {
    handleSubmit,
    reset,
    watch,
    register,
    formState: { isDirty, isSubmitting, errors },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
  });

  const resetForm = () => {
    if (!data) {
      return;
    }

    reset(defaultFormValues);
  };

  const onSubmit = async (newData: FormData) => {
    if (!serverId) {
      return;
    }

    try {
      await mutateAsync({
        serverId,
        details: newData,
      });
      reset(newData);
    } catch (err) {
      notifyError(t("common.errors.failedToSave"), err as Error);
    }
  };

  useEffect(() => {
    resetForm();
  }, [data]);

  useEffect(() => {
    const subscription = watch((value) => {
      setFormValuesSoFar(value as FormData);
    });

    return () => subscription.unsubscribe();
  }, [watch]);

  return (
    <RequireServerBotAccess serverId={serverId}>
      <DashboardContent error={error} loading={status === "loading"}>
        <Stack spacing={6}>
          <Heading as="h1">{t("pages.serverSettings.title")}</Heading>
          <Stack spacing={8}>
            <Heading as="h2" size="lg">
              {t("pages.serverSettings.datesTitle")}
            </Heading>
            <Box>
              <FormLabel>{t("pages.serverSettings.previewLabel")}</FormLabel>
              <Text fontSize="2xl" fontWeight="light">
                <LiveClock
                  dateFormat={formValuesSoFar.dateFormat}
                  timezone={formValuesSoFar.timezone}
                />
              </Text>
            </Box>
            <form onSubmit={handleSubmit(onSubmit)}>
              <Stack spacing={4}>
                <FormControl isInvalid={!!errors?.dateFormat}>
                  <FormLabel>{t("pages.serverSettings.dateFormatInputLabel")}</FormLabel>
                  <Input {...register("dateFormat")} />
                  <FormHelperText>
                    {t("pages.serverSettings.dateFormatInputDescription")}{" "}
                    <a
                      style={{
                        color: getChakraColor("blue.500"),
                      }}
                      href="https://momentjs.com/docs/#/displaying/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("pages.serverSettings.dateFormatInputDescriptionPromot")}
                    </a>
                  </FormHelperText>
                  <FormErrorMessage>{errors.dateFormat?.message}</FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!!errors?.timezone}>
                  <FormLabel>{t("pages.serverSettings.timezoneInputLabel")}</FormLabel>
                  <Input {...register("timezone")} />
                  <FormHelperText>
                    {t("pages.serverSettings.timezoneInputDescription")}{" "}
                    <a
                      style={{
                        color: getChakraColor("blue.500"),
                      }}
                      href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("pages.serverSettings.timezoneInputDescriptionPrompt")}
                    </a>
                  </FormHelperText>
                  <FormErrorMessage>{errors.timezone?.message}</FormErrorMessage>
                </FormControl>
                <HStack justifyContent="flex-end">
                  <Button variant="ghost" isDisabled={!isDirty || isSubmitting} onClick={resetForm}>
                    {t("pages.serverSettings.resetButton")}
                  </Button>
                  <Button
                    colorScheme="blue"
                    isDisabled={!isDirty || isSubmitting}
                    isLoading={isSubmitting}
                    type="submit"
                  >
                    <span>{t("pages.serverSettings.saveButton")}</span>
                  </Button>
                </HStack>
              </Stack>
            </form>
          </Stack>
          <Stack spacing={8}>
            <Stack>
              <Heading as="h2" size="lg">
                {t("pages.serverSettings.backupTitle")}
              </Heading>
              <Text>{t("pages.serverSettings.backupDescription")}</Text>
            </Stack>
            <Box>
              <DiscordServerBackupButton serverId={serverId} />
            </Box>
          </Stack>
        </Stack>
      </DashboardContent>
    </RequireServerBotAccess>
  );
};
