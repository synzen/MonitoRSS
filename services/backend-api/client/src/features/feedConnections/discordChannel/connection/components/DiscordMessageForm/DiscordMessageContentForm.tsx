import {
  Accordion,
  Box,
  Button,
  Code,
  Field,
  HStack,
  Icon,
  Separator,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { FaGear } from "react-icons/fa6";
import { useEffect, useState } from "react";
import { DiscordMessageFormData } from "@/types/discord";
import { HelpDialog } from "@/components";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";
import { Switch } from "@/components/ui/switch";
import MessagePlaceholderText from "../../../messageBuilder/components/MessagePlaceholderText";

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
  const [accordionValue, setAccordionValue] = useState<string[]>([]);
  const isSplitOptionsEnabled = !!splitOptions?.isEnabled;

  useEffect(() => {
    if (!isSplitOptionsEnabled) {
      setAccordionValue([]);
    }
  }, [isSplitOptionsEnabled]);

  return (
    <Stack gap={6} separator={<Separator />}>
      <Field.Root invalid={!!errors.content}>
        <Stack
          direction={{ base: "column", md: "row" }}
          gap={{ base: "1.5", md: "8" }}
          justify="space-between"
          minW={{ md: "md", lg: "lg", xl: "3xl" }}
        >
          <Box>
            <Field.Label>{t("components.discordMessageForm.contentSectionTitle")}</Field.Label>
            <Field.HelperText>
              You can use the placeholders listed above. A special placeholder,{" "}
              <MessagePlaceholderText withBrackets>empty</MessagePlaceholderText>, can be used to
              create an empty message, but only if an embed is used. Regular formatting such as bold
              and etc. is also available.
            </Field.HelperText>
          </Box>
          <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "md", lg: "lg", xl: "3xl" }}>
            <Controller
              name="content"
              control={control}
              render={({ field }) => (
                <Textarea
                  placeholder=":newspaper: | {{title}}&#10;&#10;{{link}}"
                  size="sm"
                  aria-label="Text content"
                  spellCheck={false}
                  {...field}
                />
              )}
            />
            {errors.content && <Field.ErrorText>{errors.content.message}</Field.ErrorText>}
          </Stack>
        </Stack>
      </Field.Root>
      <Stack
        direction={{ base: "column", md: "row" }}
        gap={{ base: "1.5", md: "8" }}
        justify="space-between"
        alignSelf="stretch"
      >
        <Field.Root>
          <Field.Label htmlFor="splitCheckbox">
            {t("components.discordMessageForm.splitContentSectionTitle")}
          </Field.Label>
          <Field.HelperText>
            {t("components.discordMessageForm.splitContentCheckboxDescription")}
          </Field.HelperText>
        </Field.Root>
        <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "md", lg: "lg", xl: "3xl" }}>
          <Field.Root id="splitCheckbox">
            <Controller
              name="splitOptions.isEnabled"
              control={control}
              render={({ field }) => {
                return (
                  <Switch
                    name={field.name}
                    checked={!!field.value}
                    onCheckedChange={(details) => field.onChange(details.checked)}
                    inputProps={{
                      "aria-label": t("components.discordMessageForm.splitContentSectionTitle"),
                    }}
                  />
                );
              }}
            />
          </Field.Root>
          <Accordion.Root
            collapsible
            value={accordionValue}
            onValueChange={(details) => setAccordionValue(details.value)}
          >
            <Accordion.Item value="0" disabled={!isSplitOptionsEnabled}>
              <Accordion.ItemTrigger>
                <HStack textAlign="left" gap={4} flex="1">
                  <Icon as={FaGear} boxSize={4} />
                  <Text fontSize="sm" fontWeight="medium">
                    {t("components.discordMessageForm.splitContentSettingsLabel")}
                  </Text>
                </HStack>
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                <Accordion.ItemBody>
                  <Stack
                    gap={8}
                    width="100%"
                    maxW={{ md: "3xl" }}
                    minW={{ md: "md", lg: "lg", xl: "3xl" }}
                  >
                    <Field.Root>
                      <Field.Label>
                        {t("components.discordMessageForm.splitContentSplitCharLabel")}
                      </Field.Label>
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
                            disabled={!splitOptions}
                            value={field.value || ""}
                            onChange={(e) => {
                              field.onChange(e.target.value || null);
                            }}
                          />
                        )}
                      />
                      <Field.HelperText>
                        {t("components.discordMessageForm.splitContentSplitCharDescription")}
                      </Field.HelperText>
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>
                        {t("components.discordMessageForm.splitContentAppendCharLabel")}
                      </Field.Label>
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
                            disabled={!splitOptions}
                            onChange={(e) => {
                              field.onChange(e.target.value || null);
                            }}
                          />
                        )}
                      />
                      <Field.HelperText>
                        {t("components.discordMessageForm.splitContentAppendCharDescription")}
                      </Field.HelperText>
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>
                        {t("components.discordMessageForm.splitContentPrependCharLabel")}
                      </Field.Label>
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
                            disabled={!splitOptions}
                            onChange={(e) => {
                              field.onChange(e.target.value || null);
                            }}
                          />
                        )}
                      />
                      <Field.HelperText>
                        {t("components.discordMessageForm.splitContentPrependCharDescription")}
                      </Field.HelperText>
                    </Field.Root>
                  </Stack>
                </Accordion.ItemBody>
              </Accordion.ItemContent>
            </Accordion.Item>
          </Accordion.Root>
        </Stack>
      </Stack>
      <Field.Root>
        <Stack
          direction={{ base: "column", md: "row" }}
          gap={{ base: "1.5", md: "8" }}
          justify="space-between"
          alignSelf="stretch"
        >
          <Box>
            <Field.Label>{t("components.discordMessageForm.formatTablesSectionTitle")}</Field.Label>
            <Field.HelperText>
              <Trans
                t={t}
                i18nKey="components.discordMessageForm.formatTablesCheckboxDescription"
                components={[<Code />]}
              />
            </Field.HelperText>
          </Box>
          <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "md", lg: "lg", xl: "3xl" }}>
            <Controller
              name="formatter.formatTables"
              control={control}
              render={({ field }) => {
                return (
                  <Switch
                    name={field.name}
                    checked={!!field.value}
                    onCheckedChange={(details) => field.onChange(details.checked)}
                    onBlur={field.onBlur}
                  />
                );
              }}
            />
          </Stack>
        </Stack>
      </Field.Root>
      <Field.Root>
        <Stack
          direction={{ base: "column", md: "row" }}
          gap={{ base: "1.5", md: "8" }}
          justify="space-between"
          alignSelf="stretch"
        >
          <Box>
            <Field.Label>{t("components.discordMessageForm.stripImagesSectionTitle")}</Field.Label>
            <Field.HelperText>
              {t("components.discordMessageForm.stripImagesCheckboxDescription")}
            </Field.HelperText>
          </Box>
          <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "md", lg: "lg", xl: "3xl" }}>
            <Controller
              name="formatter.stripImages"
              control={control}
              render={({ field }) => {
                return (
                  <Switch
                    name={field.name}
                    checked={!!field.value}
                    onCheckedChange={(details) => field.onChange(details.checked)}
                    onBlur={field.onBlur}
                  />
                );
              }}
            />
          </Stack>
        </Stack>
      </Field.Root>
      <Field.Root>
        <Stack
          direction={{ base: "column", md: "row" }}
          gap={{ base: "1.5", md: "8" }}
          justify="space-between"
          alignSelf="stretch"
        >
          <Box>
            <Field.Label>
              {t("components.discordMessageForm.disableImageLinkPreviewsTitle")}
            </Field.Label>
            <Field.HelperText>
              <Trans
                t={t}
                i18nKey="components.discordMessageForm.disableImageLinkPreviewsCheckboxDescription"
                components={[<Code />]}
              />
            </Field.HelperText>
          </Box>
          <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "md", lg: "lg", xl: "3xl" }}>
            <Controller
              name="formatter.disableImageLinkPreviews"
              control={control}
              render={({ field }) => {
                return (
                  <Switch
                    name={field.name}
                    checked={!!field.value}
                    onCheckedChange={(details) => field.onChange(details.checked)}
                    onBlur={field.onBlur}
                  />
                );
              }}
            />
          </Stack>
        </Stack>
      </Field.Root>
      <Field.Root>
        <Stack
          direction={{ base: "column", md: "row" }}
          gap={{ base: "1.5", md: "8" }}
          justify="space-between"
          alignSelf="stretch"
        >
          <Box>
            <Field.Label>Ignore new lines</Field.Label>
            <Field.HelperText>
              Prevents excessive new lines from being added to the message if the text content
              within placeholder content have new lines.
            </Field.HelperText>
          </Box>
          <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "md", lg: "lg", xl: "3xl" }}>
            <Controller
              name="formatter.ignoreNewLines"
              control={control}
              render={({ field }) => {
                return (
                  <Switch
                    name={field.name}
                    checked={!!field.value}
                    onCheckedChange={(details) => field.onChange(details.checked)}
                    onBlur={field.onBlur}
                  />
                );
              }}
            />
          </Stack>
        </Stack>
      </Field.Root>
      <Field.Root>
        <Stack
          direction={{ base: "column", md: "row" }}
          gap={{ base: "1.5", md: "8" }}
          justify="space-between"
          alignSelf="stretch"
        >
          <Box>
            <Field.Label>{t("components.discordMessageForm.placeholderFallbackTitle")}</Field.Label>
            <Field.HelperText>
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
                      color="text.link"
                      variant="plain"
                      textDecoration="underline"
                      height="auto"
                      padding={0}
                      whiteSpace="initial"
                      textAlign="left"
                      mb={2}
                    >
                      Click here to see how to use placeholder fallbacks.
                    </Button>
                  }
                  title="Using Placeholder Fallbacks"
                  body={
                    <Stack gap={6}>
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
            </Field.HelperText>
          </Box>
          <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "md", lg: "lg", xl: "3xl" }}>
            <Controller
              name="enablePlaceholderFallback"
              control={control}
              render={({ field }) => {
                return (
                  <Switch
                    name={field.name}
                    checked={!!field.value}
                    onCheckedChange={(details) => field.onChange(details.checked)}
                    onBlur={field.onBlur}
                  />
                );
              }}
            />
          </Stack>
        </Stack>
      </Field.Root>
    </Stack>
  );
};
