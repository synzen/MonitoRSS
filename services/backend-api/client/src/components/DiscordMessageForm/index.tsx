import { AddIcon } from "@chakra-ui/icons";
import {
  Button,
  Flex,
  Heading,
  HStack,
  IconButton,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useState } from "react";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  DiscordMessageEmbedFormData,
  DiscordMessageFormData,
  discordMessageFormSchema,
} from "@/types/discord";
import { notifyError } from "../../utils/notifyError";
import { DiscordMessageContentForm } from "./DiscordMessageContentForm";
import { DiscordMessageEmbedForm } from "./DiscordMessageEmbedForm";

interface Props {
  defaultValues?: DiscordMessageFormData;
  onClickSave: (data: DiscordMessageFormData) => Promise<void>;
}

const templateEmbed: DiscordMessageEmbedFormData = Object.freeze({});

export const DiscordMessageForm = ({ defaultValues, onClickSave }: Props) => {
  const defaultIndex = defaultValues?.embeds?.length ? defaultValues.embeds.length - 1 : 0;

  const { t } = useTranslation();
  const [activeEmbedIndex, setActiveEmbedIndex] = useState(defaultIndex);

  const formMethods = useForm<DiscordMessageFormData>({
    resolver: yupResolver(discordMessageFormSchema),
    defaultValues,
    mode: "all",
  });
  const {
    handleSubmit,
    control,
    reset,
    formState: { isDirty, isSubmitting, errors },
  } = formMethods;
  const {
    fields: embeds,
    append,
    remove,
  } = useFieldArray({
    control,
    name: "embeds",
  });

  const onSubmit = async (formData: DiscordMessageFormData) => {
    try {
      const embedsWithoutEmptyObjects = formData.embeds?.map((embed) => {
        const newEmbed = { ...embed };

        if (!newEmbed.author?.name) {
          newEmbed.author = null;
        }

        if (!newEmbed.footer?.text) {
          newEmbed.footer = null;
        }

        if (!newEmbed.thumbnail?.url) {
          newEmbed.thumbnail = null;
        }

        if (!newEmbed.image?.url) {
          newEmbed.image = null;
        }

        return newEmbed;
      });

      const toSubmit: DiscordMessageFormData = {
        content: formData.content?.trim(),
        embeds: embedsWithoutEmptyObjects,
        splitOptions: formData.splitOptions || null,
        formatter: formData.formatter,
      };

      await onClickSave(toSubmit);
      reset(toSubmit);
    } catch (err) {
      notifyError(t("common.errors.failedToSave"), err as Error);
    }
  };

  const onAddEmbed = () => {
    append(templateEmbed as never);
    setActiveEmbedIndex(embeds.length);
  };

  const onRemoveEmbed = (index: number) => {
    remove(index);
    const newIndex = Math.max(index - 1, 0);
    setActiveEmbedIndex(newIndex);
  };

  const onEmbedTabChanged = (index: number) => {
    setActiveEmbedIndex(index);
  };

  const errorsExist = Object.keys(errors).length > 0;

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={24}>
          <Stack spacing={4}>
            <Heading size="md">{t("components.discordMessageForm.textSectionTitle")}</Heading>
            <DiscordMessageContentForm control={control} errors={errors} />
          </Stack>
          <Stack spacing={4}>
            <Heading size="md">{t("components.discordMessageForm.embedSectionTitle")}</Heading>
            <Text>{t("components.discordMessageForm.embedSectionDescription")}</Text>
            <Tabs variant="solid-rounded" index={activeEmbedIndex} onChange={onEmbedTabChanged}>
              <HStack overflow="auto">
                <TabList>
                  {embeds?.map((embed, index) => (
                    <Tab key={embed.id}>Embed {index + 1}</Tab>
                  ))}
                </TabList>
                {(embeds?.length ?? 0) < 10 && (
                  <IconButton
                    onClick={onAddEmbed}
                    variant="ghost"
                    aria-label="Add new embed"
                    icon={<AddIcon />}
                  />
                )}
              </HStack>
              <TabPanels>
                {embeds?.map((embed, index) => (
                  <TabPanel key={embed.id}>
                    <Stack spacing={8}>
                      <Flex justifyContent="flex-end">
                        <Button
                          colorScheme="red"
                          size="sm"
                          variant="outline"
                          onClick={() => onRemoveEmbed(index)}
                        >
                          {t("features.feedConnections.components.embedForm.deleteButtonText")}
                        </Button>
                      </Flex>
                      <DiscordMessageEmbedForm index={index} />
                    </Stack>
                  </TabPanel>
                ))}
              </TabPanels>
            </Tabs>
          </Stack>
          <Flex direction="row-reverse">
            <HStack>
              {isDirty && (
                <Button onClick={() => reset()} variant="ghost" disabled={!isDirty || isSubmitting}>
                  {t("features.feed.components.sidebar.resetButton")}
                </Button>
              )}
              <Button
                type="submit"
                colorScheme="blue"
                disabled={isSubmitting || !isDirty || errorsExist}
                isLoading={isSubmitting}
              >
                {t("features.feed.components.sidebar.saveButton")}
              </Button>
            </HStack>
          </Flex>
        </Stack>
      </form>
    </FormProvider>
  );
};
