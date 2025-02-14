import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  Code,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Stack,
  StackDivider,
  Switch,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { SettingsIcon } from "@chakra-ui/icons";
import { useCallback, useEffect, useState } from "react";
import { DiscordMessageFormData } from "@/types/discord";
import { HelpDialog } from "../../../../components";
import { AutoResizeTextarea } from "../../../../components/AutoResizeTextarea";
import MessagePlaceholderText from "../../../../components/MessagePlaceholderText";

export const DiscordMessageContentForm = () => {
  const {
    control,
    formState: { errors },
  } = useFormContext<DiscordMessageFormData>();
  const splitOptions = useWatch({
    control,
    name: `splitOptions`,
  });
  const { t } = useTranslation();
  const [accordionIndex, setAccordionIndex] = useState<number>(-1);
  const isSplitOptionsEnabled = !!splitOptions?.isEnabled;

  useEffect(() => {
    if (!isSplitOptionsEnabled) {
      setAccordionIndex(-1);
    }
  }, [isSplitOptionsEnabled]);

  const onClickSplitSettingsAccordion = useCallback(() => {
    if (!isSplitOptionsEnabled) {
      return;
    }

    if (accordionIndex === 0) {
      setAccordionIndex(-1);
    } else {
      setAccordionIndex(0);
    }
  }, [isSplitOptionsEnabled, accordionIndex]);

  return (
    <Stack spacing={6} divider={<StackDivider />}>
      <FormControl isInvalid={!!errors.content}>
        <Stack
          direction={{ base: "column", md: "row" }}
          spacing={{ base: "1.5", md: "8" }}
          justify="space-between"
          minW={{ md: "md", lg: "lg", xl: "3xl" }}
        >
          <Box>
            <FormLabel>{t("components.discordMessageForm.contentSectionTitle")}</FormLabel>
            <FormHelperText>
              <Trans
                t={t}
                i18nKey="components.discordMessageForm.contentSectionDescription"
                components={[<MessagePlaceholderText />]}
              />
            </FormHelperText>
          </Box>
          <Stack
            spacing={8}
            width="100%"
            maxW={{ md: "3xl" }}
            minW={{ md: "md", lg: "lg", xl: "3xl" }}
          >
            <Controller
              name="content"
              control={control}
              render={({ field }) => (
                <Textarea
                  placeholder=":newspaper: | {{title}}&#10;&#10;{{link}}"
                  size="sm"
                  aria-label="Text content"
                  spellCheck={false}
                  bg="gray.900"
                  {...field}
                />
              )}
            />
            {errors.content && <FormErrorMessage>{errors.content.message}</FormErrorMessage>}
          </Stack>
        </Stack>
      </FormControl>
      <Stack
        direction={{ base: "column", md: "row" }}
        spacing={{ base: "1.5", md: "8" }}
        justify="space-between"
      >
        <FormControl>
          <FormLabel htmlFor="splitCheckbox">
            {t("components.discordMessageForm.splitContentSectionTitle")}
          </FormLabel>
          <FormHelperText>
            {t("components.discordMessageForm.splitContentCheckboxDescription")}
          </FormHelperText>
        </FormControl>
        <Stack
          spacing={8}
          width="100%"
          maxW={{ md: "3xl" }}
          minW={{ md: "md", lg: "lg", xl: "3xl" }}
        >
          <FormControl id="splitCheckbox">
            <Controller
              name="splitOptions.isEnabled"
              control={control}
              render={({ field }) => {
                return (
                  <Switch
                    name={field.name}
                    isChecked={!!field.value}
                    onChange={(e) => field.onChange(e.currentTarget.checked)}
                  />
                );
              }}
            />
          </FormControl>
          <Accordion allowToggle index={accordionIndex}>
            <AccordionItem isDisabled={!isSplitOptionsEnabled}>
              <AccordionButton onClick={onClickSplitSettingsAccordion}>
                <HStack textAlign="left" spacing={4} flex="1">
                  <SettingsIcon />
                  <Text>{t("components.discordMessageForm.splitContentSettingsLabel")}</Text>
                </HStack>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel>
                <Stack
                  spacing={8}
                  width="100%"
                  maxW={{ md: "3xl" }}
                  minW={{ md: "md", lg: "lg", xl: "3xl" }}
                >
                  <FormControl>
                    <FormLabel>
                      {t("components.discordMessageForm.splitContentSplitCharLabel")}
                    </FormLabel>
                    <Controller
                      name="splitOptions.splitChar"
                      control={control}
                      render={({ field }) => (
                        <AutoResizeTextarea
                          {...field}
                          size="sm"
                          rows={1}
                          aria-label="Split text"
                          spellCheck={false}
                          isDisabled={!splitOptions}
                          value={field.value || ""}
                          bg="gray.900"
                          onChange={(e) => {
                            field.onChange(e.target.value || null);
                          }}
                        />
                      )}
                    />
                    <FormHelperText>
                      {t("components.discordMessageForm.splitContentSplitCharDescription")}
                    </FormHelperText>
                  </FormControl>
                  <FormControl>
                    <FormLabel>
                      {t("components.discordMessageForm.splitContentAppendCharLabel")}
                    </FormLabel>
                    <Controller
                      name="splitOptions.appendChar"
                      control={control}
                      render={({ field }) => (
                        <AutoResizeTextarea
                          {...field}
                          size="sm"
                          rows={1}
                          aria-label="Append text"
                          spellCheck={false}
                          value={field.value || ""}
                          isDisabled={!splitOptions}
                          bg="gray.900"
                          onChange={(e) => {
                            field.onChange(e.target.value || null);
                          }}
                        />
                      )}
                    />
                    <FormHelperText>
                      {t("components.discordMessageForm.splitContentAppendCharDescription")}
                    </FormHelperText>
                  </FormControl>
                  <FormControl>
                    <FormLabel>
                      {t("components.discordMessageForm.splitContentPrependCharLabel")}
                    </FormLabel>
                    <Controller
                      name="splitOptions.prependChar"
                      control={control}
                      render={({ field }) => (
                        <AutoResizeTextarea
                          {...field}
                          size="sm"
                          rows={1}
                          aria-label="Prepend text"
                          spellCheck={false}
                          value={field.value || ""}
                          isDisabled={!splitOptions}
                          bg="gray.900"
                          onChange={(e) => {
                            field.onChange(e.target.value || null);
                          }}
                        />
                      )}
                    />
                    <FormHelperText>
                      {t("components.discordMessageForm.splitContentPrependCharDescription")}
                    </FormHelperText>
                  </FormControl>
                </Stack>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </Stack>
      </Stack>
      <FormControl>
        <Stack
          direction={{ base: "column", md: "row" }}
          spacing={{ base: "1.5", md: "8" }}
          justify="space-between"
        >
          <Box>
            <FormLabel>{t("components.discordMessageForm.formatTablesSectionTitle")}</FormLabel>
            <FormHelperText>
              <Trans
                t={t}
                i18nKey="components.discordMessageForm.formatTablesCheckboxDescription"
                components={[<Code />]}
              />
            </FormHelperText>
          </Box>
          <Stack
            spacing={8}
            width="100%"
            maxW={{ md: "3xl" }}
            minW={{ md: "md", lg: "lg", xl: "3xl" }}
          >
            <Controller
              name="formatter.formatTables"
              control={control}
              render={({ field }) => {
                return (
                  <Switch
                    {...field}
                    isChecked={!!field.value}
                    value=""
                    onChange={(e) => field.onChange(e.currentTarget.checked)}
                  />
                );
              }}
            />
          </Stack>
        </Stack>
      </FormControl>
      <FormControl>
        <Stack
          direction={{ base: "column", md: "row" }}
          spacing={{ base: "1.5", md: "8" }}
          justify="space-between"
        >
          <Box>
            <FormLabel>{t("components.discordMessageForm.stripImagesSectionTitle")}</FormLabel>
            <FormHelperText>
              {t("components.discordMessageForm.stripImagesCheckboxDescription")}
            </FormHelperText>
          </Box>
          <Stack
            spacing={8}
            flexGrow="1"
            width="100%"
            maxW={{ md: "3xl" }}
            minW={{ md: "md", lg: "lg", xl: "3xl" }}
          >
            <Controller
              name="formatter.stripImages"
              control={control}
              render={({ field }) => {
                return (
                  <Switch
                    {...field}
                    isChecked={!!field.value}
                    value=""
                    onChange={(e) => field.onChange(e.currentTarget.checked)}
                  />
                );
              }}
            />
          </Stack>
        </Stack>
      </FormControl>
      <FormControl>
        <Stack
          direction={{ base: "column", md: "row" }}
          spacing={{ base: "1.5", md: "8" }}
          justify="space-between"
        >
          <Box>
            <FormLabel>
              {t("components.discordMessageForm.disableImageLinkPreviewsTitle")}
            </FormLabel>
            <FormHelperText>
              <Trans
                t={t}
                i18nKey="components.discordMessageForm.disableImageLinkPreviewsCheckboxDescription"
                components={[<Code />]}
              />
            </FormHelperText>
          </Box>
          <Stack
            spacing={8}
            width="100%"
            maxW={{ md: "3xl" }}
            minW={{ md: "md", lg: "lg", xl: "3xl" }}
          >
            <Controller
              name="formatter.disableImageLinkPreviews"
              control={control}
              render={({ field }) => {
                return (
                  <Switch
                    {...field}
                    isChecked={!!field.value}
                    value=""
                    onChange={(e) => field.onChange(e.currentTarget.checked)}
                  />
                );
              }}
            />
          </Stack>
        </Stack>
      </FormControl>
      <FormControl>
        <Stack
          direction={{ base: "column", md: "row" }}
          spacing={{ base: "1.5", md: "8" }}
          justify="space-between"
        >
          <Box>
            <FormLabel>Ignore new lines</FormLabel>
            <FormHelperText>
              Prevents excessive new lines from being added to the message if the text content
              within placeholder content have new lines.
            </FormHelperText>
          </Box>
          <Stack
            spacing={8}
            flexGrow="1"
            width="100%"
            maxW={{ md: "3xl" }}
            minW={{ md: "md", lg: "lg", xl: "3xl" }}
          >
            <Controller
              name="formatter.ignoreNewLines"
              control={control}
              render={({ field }) => {
                return (
                  <Switch
                    {...field}
                    isChecked={!!field.value}
                    value=""
                    onChange={(e) => field.onChange(e.currentTarget.checked)}
                  />
                );
              }}
            />
          </Stack>
        </Stack>
      </FormControl>
      <FormControl>
        <Stack
          direction={{ base: "column", md: "row" }}
          spacing={{ base: "1.5", md: "8" }}
          justify="space-between"
        >
          <Box>
            <FormLabel>{t("components.discordMessageForm.placeholderFallbackTitle")}</FormLabel>
            <FormHelperText>
              <Stack>
                <Text>
                  {t("components.discordMessageForm.placeholderFallbackCheckboxDescription")}
                </Text>
                <HelpDialog
                  trigger={
                    <Button
                      display="inline"
                      fontSize="sm"
                      mt={4}
                      colorScheme="blue"
                      variant="link"
                      whiteSpace="initial"
                      textAlign="left"
                      mb={2}
                    >
                      Click here to see how to use placeholder fallbacks.
                    </Button>
                  }
                  title="Using Placeholder Fallbacks"
                  body={
                    <Stack spacing={6}>
                      <Text>
                        To use placeholder fallbacks, separate each placeholder with <Code>||</Code>{" "}
                        within the curly braces. For example, if you use{" "}
                        <Code>{"{{title||description}}"}</Code>, then the description will be used
                        if the title is not available.{" "}
                      </Text>
                      <Text>
                        If all placeholders have no content, then you may add text as the final
                        fallback like so:{" "}
                        <Code>{"{{title||description||text::my final text}}"}</Code>. In this case,{" "}
                        <Code>my final text</Code> will appear in the final output if both title and
                        description do not exist.
                      </Text>
                    </Stack>
                  }
                />
              </Stack>
            </FormHelperText>
          </Box>
          <Stack
            spacing={8}
            flexGrow="1"
            width="100%"
            maxW={{ md: "3xl" }}
            minW={{ md: "md", lg: "lg", xl: "3xl" }}
          >
            <Controller
              name="enablePlaceholderFallback"
              control={control}
              render={({ field }) => {
                return (
                  <Switch
                    {...field}
                    isChecked={!!field.value}
                    value=""
                    onChange={(e) => field.onChange(e.currentTarget.checked)}
                  />
                );
              }}
            />
          </Stack>
        </Stack>
      </FormControl>
    </Stack>
  );
};
