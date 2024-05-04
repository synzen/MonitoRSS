import {
  Button,
  Divider,
  Flex,
  FormControl,
  Heading,
  HStack,
  Stack,
  Switch,
  Text,
  Box,
} from "@chakra-ui/react";
import { useParams } from "react-router-dom";
import { boolean, InferType, object } from "yup";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { DashboardContent } from "@/components";
import RouteParams from "../types/RouteParams";
import { useFeed } from "@/features/feed";
import { ErrorAlert } from "@/components/ErrorAlert";
import { useUpdateFeed } from "@/features/feed/hooks/useUpdateFeed";
import { notifyError } from "@/utils/notifyError";

const formSchema = object({
  checkTitles: boolean().optional(),
  checkDates: boolean().optional(),
  imgPreviews: boolean().optional(),
  imgLinksExistence: boolean().optional(),
  formatTables: boolean().optional(),
  directSubscribers: boolean().optional(),
  splitMessage: boolean().optional(),
});

type FormData = InferType<typeof formSchema>;

const FeedMiscOptions: React.FC = () => {
  const { feedId } = useParams<RouteParams>();
  const {
    handleSubmit,
    control,
    reset,
    formState: { isDirty, isSubmitting },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
  });
  const { t } = useTranslation();
  const { status, feed, error } = useFeed({
    feedId,
  });
  const { mutateAsync } = useUpdateFeed();

  const resetForm = () => {
    if (!feed) {
      return;
    }

    reset({
      checkTitles: feed.checkTitles,
      checkDates: feed.checkDates,
      imgPreviews: feed.imgPreviews,
      imgLinksExistence: feed.imgLinksExistence,
      formatTables: feed.formatTables,
      directSubscribers: feed.directSubscribers,
      splitMessage: feed.splitMessage,
    });
  };

  useEffect(() => {
    resetForm();
  }, [feed]);

  if (error) {
    return <ErrorAlert description={error.message} />;
  }

  const onSubmit = async (data: FormData) => {
    if (!feedId) {
      return;
    }

    try {
      await mutateAsync({
        feedId,
        details: {
          checkDates: data.checkDates,
          checkTitles: data.checkTitles,
          imgPreviews: data.imgPreviews,
          imgLinksExistence: data.imgLinksExistence,
          formatTables: data.formatTables,
          directSubscribers: data.directSubscribers,
          splitMessage: data.splitMessage,
        },
      });
    } catch (err) {
      notifyError(t("common.errors.failedToSave"), err as Error);
    }
  };

  const options: Array<{ formKey: keyof FormData; label: string; description: string }> = [
    {
      label: t("pages.miscOptions.titleChecks"),
      description: t("pages.miscOptions.titleChecksDescription"),
      formKey: "checkTitles",
    },
    {
      label: t("pages.miscOptions.dateChecks"),
      description: t("pages.miscOptions.dateChecksDescription"),
      formKey: "checkDates",
    },
    {
      label: t("pages.miscOptions.imageLinksPreviews"),
      description: t("pages.miscOptions.imageLinksPreviewsDescription"),
      formKey: "imgPreviews",
    },
    {
      label: t("pages.miscOptions.imageLinksExistence"),
      description: t("pages.miscOptions.imageLinksExistenceDescription"),
      formKey: "imgLinksExistence",
    },
    {
      label: t("pages.miscOptions.formatTables"),
      description: t("pages.miscOptions.formatTablesDescription"),
      formKey: "formatTables",
    },
    {
      label: t("pages.miscOptions.splitMessage"),
      description: t("pages.miscOptions.splitMessageDescription"),
      formKey: "splitMessage",
    },
  ];

  return (
    <DashboardContent loading={status === "loading"}>
      <Stack spacing={6}>
        <Heading>{t("pages.miscOptions.title")}</Heading>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack>
            <Stack spacing="8">
              {options.map((option) => (
                <Box key={option.formKey}>
                  <Controller
                    key={option.formKey}
                    name={option.formKey}
                    control={control}
                    render={({ field }) => (
                      <FormControl>
                        <Flex justifyContent="space-between">
                          <Heading as="label" htmlFor="checkTitles" size="md">
                            {option.label}
                          </Heading>
                          <Switch
                            size="lg"
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            isChecked={field.value}
                          />
                        </Flex>
                        <Text paddingBottom="8">{option.description}</Text>
                      </FormControl>
                    )}
                  />
                  <Divider />
                </Box>
              ))}
            </Stack>
            <HStack justifyContent="flex-end">
              <Button variant="ghost" onClick={resetForm} isDisabled={!isDirty || isSubmitting}>
                {t("pages.miscOptions.resetButton")}
              </Button>
              <Button
                colorScheme="blue"
                type="submit"
                isLoading={isSubmitting}
                isDisabled={!isDirty || isSubmitting}
              >
                <span>{t("pages.miscOptions.saveButton")}</span>
              </Button>
            </HStack>
          </Stack>
        </form>
      </Stack>
    </DashboardContent>
  );
};

export default FeedMiscOptions;
