import React from "react";
import { VStack, HStack, Box, chakra, Text } from "@chakra-ui/react";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { InputWithInsertPlaceholder } from "../components/InputWithInsertPlaceholder";
import { Component, LegacyTextComponent } from "../types";
import getMessageBuilderFieldErrors from "../utils/getMessageBuilderFieldErrors";
import MessagePlaceholderText from "../components/MessagePlaceholderText";
import { useUserFeedConnectionContext } from "@/features/feed";
import { FeedDiscordChannelConnection } from "@/types";
import { useMessageBuilderStateContext } from "../state";

interface LegacyTextPropertiesProps {
  root?: Component;
  component: LegacyTextComponent;
  onChange: (value: any) => void;
}

export const LegacyTextProperties: React.FC<LegacyTextPropertiesProps> = ({
  root,
  component,
  onChange,
}) => {
  const { connection } = useUserFeedConnectionContext<FeedDiscordChannelConnection>();
  const guildId = connection?.details.channel?.guildId || connection?.details.webhook?.guildId;
  const { errors } = useMessageBuilderStateContext();
  const [contentError] = getMessageBuilderFieldErrors(errors, root, component.id, ["content"]);

  return (
    <VStack align="stretch" gap={4}>
      <InputWithInsertPlaceholder
        value={component.content}
        onChange={(value) => onChange({ ...component, content: value })}
        label="Text Content"
        error={contentError?.message}
        invalid={!!contentError}
        helperText={
          <Text>
            A special placeholder,{" "}
            <MessagePlaceholderText withBrackets>empty</MessagePlaceholderText>, can be used to
            create an empty message, but only if at least one embed is used. Regular formatting such
            as bold and etc. is available.
          </Text>
        }
        guildId={guildId}
      />
      <Field
        helperText={
          <Text fontSize="sm" color="fg.muted">
            If enabled, image links will be wrapped with arrow brackets to prevent Discord from
            creating previews for them.
          </Text>
        }
      >
        <HStack justify="space-between" align="center" mb={2}>
          <Text fontSize="sm" fontWeight="medium" color="fg">
            Disable Image Link Previews
          </Text>
          <Switch
            checked={!!component.disableImageLinkPreviews}
            onCheckedChange={(e) => onChange({ ...component, disableImageLinkPreviews: e.checked })}
            colorPalette="brand"
          />
        </HStack>
      </Field>
      <Field
        helperText={
          <Text fontSize="sm" color="fg.muted" mb={3}>
            If enabled, the message will be split into multiple messages if it is too long.
            Otherwise, it will attempt to be sent as one message with the maximum possible number of
            characters.
          </Text>
        }
      >
        <HStack justify="space-between" align="center" mb={2}>
          <Text fontSize="sm" fontWeight="medium" color="fg">
            Split Content
          </Text>
          <Switch
            checked={!!component.splitOptions?.isEnabled}
            onCheckedChange={(e) =>
              onChange({
                ...component,
                splitOptions: {
                  ...component.splitOptions,
                  isEnabled: e.checked,
                },
              })
            }
            colorPalette="brand"
            aria-expanded={component.splitOptions?.isEnabled ? "true" : "false"}
            aria-controls="split-content-options"
          />
        </HStack>
        <fieldset hidden={!component.splitOptions?.isEnabled} id="split-content-options">
          <chakra.legend srOnly>Split Content Options</chakra.legend>
          <Box borderLeft="2px solid" borderColor="border" pl={4} ml={0}>
            <VStack gap={4} align="stretch">
              <InputWithInsertPlaceholder
                value={component.splitOptions?.splitChar || ""}
                onChange={(value) =>
                  onChange({
                    ...component,
                    splitOptions: {
                      ...component.splitOptions,
                      splitChar: value || undefined,
                    },
                  })
                }
                label="Split text"
                placeholder="."
                helperText='The text to split the text content with. Defaults to "." (a period).'
                as="input"
                guildId={guildId}
              />
              <InputWithInsertPlaceholder
                value={component.splitOptions?.appendChar || ""}
                onChange={(value) =>
                  onChange({
                    ...component,
                    splitOptions: {
                      ...component.splitOptions,
                      appendChar: value || undefined,
                    },
                  })
                }
                label="Append text"
                placeholder=""
                helperText="The text to append to the end of the last message after the initial message has been split. Default is nothing."
                as="input"
                guildId={guildId}
              />
              <InputWithInsertPlaceholder
                value={component.splitOptions?.prependChar || ""}
                onChange={(value) =>
                  onChange({
                    ...component,
                    splitOptions: {
                      ...component.splitOptions,
                      prependChar: value || undefined,
                    },
                  })
                }
                label="Prepend text"
                placeholder=""
                helperText="The text to prepend to the beginning of the first message after the initial message has been split. Default is nothing."
                as="input"
                guildId={guildId}
              />
            </VStack>
          </Box>
        </fieldset>
      </Field>
    </VStack>
  );
};
