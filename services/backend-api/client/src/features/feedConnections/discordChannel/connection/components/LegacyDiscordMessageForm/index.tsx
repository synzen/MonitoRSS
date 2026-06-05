import { FaPlus } from "react-icons/fa6";
import {
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useState } from "react";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { DestructiveActionButton } from "@/components/DestructiveActionButton";
import { DiscordMessageFormData, discordMessageFormSchema } from "@/types/discord";
import { DiscordMessageContentFormLegacy } from "./DiscordMessageContentFormLegacy";
import { DiscordMessageEmbedFormLegacy } from "./DiscordMessageEmbedFormLegacy";
import { notifyError } from "@/utils/notifyError";
import {
  DiscordMessageEmbedFormDataLegacy,
  DiscordMessageFormDataLegacy,
} from "@/types/discord/DiscordMessageFormDataLegacy";

interface Props {
  defaultValues?: DiscordMessageFormData;
  onClickSave: (data: DiscordMessageFormDataLegacy) => Promise<void>;
}

const templateEmbed: DiscordMessageEmbedFormDataLegacy = Object.freeze({});

export const DiscordMessageFormLegacy = ({ defaultValues, onClickSave }: Props) => {
  const defaultIndex = defaultValues?.embeds?.length ? defaultValues.embeds.length - 1 : 0;

  const { t } = useTranslation();
  const [activeEmbedIndex, setActiveEmbedIndex] = useState(defaultIndex);

  const formMethods = useForm<DiscordMessageFormDataLegacy>({
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

  const onSubmit = async (formData: DiscordMessageFormDataLegacy) => {
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

      const toSubmit: DiscordMessageFormDataLegacy = {
        content: formData.content?.trim(),
        embeds: embedsWithoutEmptyObjects,
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
        <Stack gap={24}>
          <Stack gap={4}>
            <Heading size="md">{t("components.discordMessageForm.textSectionTitle")}</Heading>
            <DiscordMessageContentFormLegacy />
          </Stack>
          <Stack gap={4}>
            <Heading size="md">{t("components.discordMessageForm.embedSectionTitle")}</Heading>
            <Text>{t("components.discordMessageForm.embedSectionDescription")}</Text>
            <Tabs.Root
              variant="line"
              value={String(activeEmbedIndex)}
              onValueChange={(e) => onEmbedTabChanged(Number(e.value))}
            >
              <HStack overflow="auto">
                <Tabs.List>
                  {embeds?.map((embed, index) => (
                    <Tabs.Trigger key={embed.id} value={String(index)}>
                      Embed {index + 1}
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>
                {(embeds?.length ?? 0) < 10 && (
                  <IconButton onClick={onAddEmbed} variant="ghost" aria-label="Add new embed">
                    <Icon as={FaPlus} />
                  </IconButton>
                )}
              </HStack>
              <Tabs.ContentGroup>
                {embeds?.map((embed, index) => (
                  <Tabs.Content key={embed.id} value={String(index)}>
                    <Stack gap={8}>
                      <Flex justifyContent="flex-end">
                        <DestructiveActionButton size="sm" onClick={() => onRemoveEmbed(index)}>
                          {t("features.feedConnections.components.embedForm.deleteButtonText")}
                        </DestructiveActionButton>
                      </Flex>
                      <DiscordMessageEmbedFormLegacy index={index} />
                    </Stack>
                  </Tabs.Content>
                ))}
              </Tabs.ContentGroup>
            </Tabs.Root>
          </Stack>
          <Flex direction="row-reverse">
            <HStack>
              {isDirty && (
                <Button onClick={() => reset()} variant="ghost" disabled={!isDirty || isSubmitting}>
                  {t("features.feed.components.sidebar.resetButton")}
                </Button>
              )}
              <PrimaryActionButton
                type="submit"
                disabled={!isDirty || errorsExist}
                loading={isSubmitting}
              >
                <span>{t("features.feed.components.sidebar.saveButton")}</span>
              </PrimaryActionButton>
            </HStack>
          </Flex>
        </Stack>
      </form>
    </FormProvider>
  );
};
