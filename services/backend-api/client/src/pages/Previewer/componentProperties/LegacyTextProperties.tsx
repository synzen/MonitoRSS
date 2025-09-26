import React from "react";
import {
  VStack,
  HStack,
  FormControl,
  FormHelperText,
  FormLabel,
  Switch,
  Box,
  chakra,
} from "@chakra-ui/react";
import { useFormContext } from "react-hook-form";
import { InputWithInsertPlaceholder } from "../../../components/InputWithInsertPlaceholder";
import { Component, LegacyTextComponent } from "../types";
import PreviewerFormState from "../types/PreviewerFormState";
import getPreviewerFieldErrors from "../utils/getPreviewerFieldErrors";

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
  const {
    formState: { errors },
  } = useFormContext<PreviewerFormState>();
  const [contentError] = getPreviewerFieldErrors(errors, root, component.id, ["content"]);

  return (
    <VStack align="stretch" spacing={4}>
      <InputWithInsertPlaceholder
        value={component.content}
        onChange={(value) => onChange({ ...component, content: value })}
        label="Text Content"
        error={contentError?.message}
        isInvalid={!!contentError}
      />
      <FormControl>
        <HStack justify="space-between" align="center" mb={2}>
          <FormLabel fontSize="sm" fontWeight="medium" color="gray.200" mb={0}>
            Disable Image Link Previews
          </FormLabel>
          <Switch
            isChecked={!!component.disableImageLinkPreviews}
            onChange={(e) => onChange({ ...component, disableImageLinkPreviews: e.target.checked })}
            colorScheme="blue"
          />
        </HStack>
        <FormHelperText fontSize="sm" color="gray.400">
          If enabled, image links will be wrapped with arrow brackets to prevent Discord from
          creating previews for them.
        </FormHelperText>
      </FormControl>
      <FormControl>
        <HStack justify="space-between" align="center" mb={2}>
          <FormLabel fontSize="sm" fontWeight="medium" color="gray.200" mb={0}>
            Split Content
          </FormLabel>
          <Switch
            isChecked={!!component.splitOptions?.isEnabled}
            onChange={(e) =>
              onChange({
                ...component,
                splitOptions: {
                  ...component.splitOptions,
                  isEnabled: e.target.checked,
                },
              })
            }
            colorScheme="blue"
            aria-expanded={component.splitOptions?.isEnabled ? "true" : "false"}
            aria-controls="split-content-options"
          />
        </HStack>
        <FormHelperText fontSize="sm" color="gray.400" mb={3}>
          If enabled, the message will be split into multiple messages if it is too long. Otherwise,
          it will attempt to be sent as one message with the maximum possible number of characters.
        </FormHelperText>
        <fieldset hidden={!component.splitOptions?.isEnabled} id="split-content-options">
          <chakra.legend srOnly>Split Content Options</chakra.legend>
          <Box borderLeft="2px solid" borderColor="gray.600" pl={4} ml={0}>
            <VStack spacing={4} align="stretch">
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
              />
            </VStack>
          </Box>
        </fieldset>
      </FormControl>
    </VStack>
  );
};
