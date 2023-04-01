import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Stack,
  StackDivider,
  Switch,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { SettingsIcon } from "@chakra-ui/icons";
import { useCallback, useEffect, useState } from "react";
import { DiscordMessageFormData } from "@/types/discord";

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
  const isSplitOptionsEnabled = !!splitOptions;

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
    <Stack spacing={8} divider={<StackDivider />}>
      <FormControl isInvalid={!!errors.content}>
        <Stack
          direction={{ base: "column", md: "row" }}
          spacing={{ base: "1.5", md: "8" }}
          justify="space-between"
        >
          <Box>
            <FormLabel>{t("components.discordMessageForm.contentSectionTitle")}</FormLabel>
            <FormHelperText>
              {t("components.discordMessageForm.contentSectionDescription")}
            </FormHelperText>
          </Box>
          <Stack spacing={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
            <Controller
              name="content"
              control={control}
              render={({ field }) => (
                <Textarea size="sm" aria-label="Text content" spellCheck={false} {...field} />
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
        <Stack spacing={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
          <FormControl id="splitCheckbox">
            <Controller
              name="splitOptions"
              control={control}
              render={({ field }) => {
                return (
                  <Switch
                    name={field.name}
                    isChecked={!!field.value}
                    onChange={(e) => {
                      if (e.currentTarget.checked) {
                        field.onChange({});
                      } else {
                        field.onChange(null);
                      }
                    }}
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
                <Stack spacing={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
                  <FormControl>
                    <FormLabel>
                      {t("components.discordMessageForm.splitContentSplitCharLabel")}
                    </FormLabel>
                    <Controller
                      name="splitOptions.splitChar"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          size="sm"
                          aria-label="Split character"
                          spellCheck={false}
                          disabled={!splitOptions}
                          value={field.value || ""}
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
                        <Input
                          {...field}
                          size="sm"
                          aria-label="Append character"
                          spellCheck={false}
                          value={field.value || ""}
                          disabled={!splitOptions}
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
                        <Input
                          {...field}
                          size="sm"
                          aria-label="Prepend character"
                          spellCheck={false}
                          value={field.value || ""}
                          disabled={!splitOptions}
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
              {t("components.discordMessageForm.formatTablesCheckboxDescription")}
            </FormHelperText>
          </Box>
          <Stack spacing={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
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
          <Stack spacing={8} flexGrow="1" width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
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
    </Stack>
  );
};
