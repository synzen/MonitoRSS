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
import { AutoResizeTextarea } from "../../../components/AutoResizeTextarea";
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
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                  Split text
                </FormLabel>
                <AutoResizeTextarea
                  size="sm"
                  value={component.splitOptions?.splitChar || ""}
                  onChange={(e) =>
                    onChange({
                      ...component,
                      splitOptions: {
                        ...component.splitOptions,
                        splitChar: e.target.value || undefined,
                      },
                    })
                  }
                  placeholder="."
                  rows={1}
                  bg="gray.700"
                  color="white"
                  isDisabled={!component.splitOptions?.isEnabled}
                  aria-describedby="split-text-help"
                />
                <FormHelperText fontSize="sm" color="gray.400" id="split-text-help">
                  The text to split the text content with. Defaults to &quot;.&quot; (a period).
                </FormHelperText>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                  Append text
                </FormLabel>
                <AutoResizeTextarea
                  size="sm"
                  value={component.splitOptions?.appendChar || ""}
                  onChange={(e) =>
                    onChange({
                      ...component,
                      splitOptions: {
                        ...component.splitOptions,
                        appendChar: e.target.value || undefined,
                      },
                    })
                  }
                  placeholder=""
                  rows={1}
                  bg="gray.700"
                  color="white"
                  isDisabled={!component.splitOptions?.isEnabled}
                  aria-describedby="append-text-help"
                />
                <FormHelperText fontSize="sm" color="gray.400" id="append-text-help">
                  The text to append to the end of the last message after the initial message has
                  been split. Default is nothing.
                </FormHelperText>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                  Prepend text
                </FormLabel>
                <AutoResizeTextarea
                  size="sm"
                  value={component.splitOptions?.prependChar || ""}
                  onChange={(e) =>
                    onChange({
                      ...component,
                      splitOptions: {
                        ...component.splitOptions,
                        prependChar: e.target.value || undefined,
                      },
                    })
                  }
                  placeholder=""
                  rows={1}
                  bg="gray.700"
                  color="white"
                  isDisabled={!component.splitOptions?.isEnabled}
                  aria-describedby="prepend-text-help"
                />
                <FormHelperText fontSize="sm" color="gray.400" id="prepend-text-help">
                  The text to prepend to the beginning of the first message after the initial
                  message has been split. Default is nothing.
                </FormHelperText>
              </FormControl>
            </VStack>
          </Box>
        </fieldset>
      </FormControl>
    </VStack>
  );
};
