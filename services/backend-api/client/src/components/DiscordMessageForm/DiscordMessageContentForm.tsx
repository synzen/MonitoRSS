import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Checkbox,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Stack,
  StackDivider,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { Control, Controller, FieldErrorsImpl, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { SettingsIcon } from "@chakra-ui/icons";
import { useCallback, useEffect, useState } from "react";
import { DiscordMessageFormData } from "@/types/discord";

interface Props {
  control: Control<DiscordMessageFormData>;
  errors: FieldErrorsImpl<DiscordMessageFormData>;
}

export const DiscordMessageContentForm = ({ control, errors }: Props) => {
  const splitOptions = useWatch({
    control,
    name: `splitOptions`,
  });
  const { t } = useTranslation();
  const [accordionIndexes, setAccordionIndexes] = useState<number[]>([]);
  const isSplitOptionsEnabled = !!splitOptions;

  useEffect(() => {
    if (!isSplitOptionsEnabled) {
      setAccordionIndexes([]);
    }
  }, [isSplitOptionsEnabled]);

  const onClickSplitSettingsAccordion = useCallback(() => {
    if (!isSplitOptionsEnabled) {
      return;
    }

    if (accordionIndexes.includes(0)) {
      setAccordionIndexes([]);
    } else {
      setAccordionIndexes([0]);
    }
  }, [isSplitOptionsEnabled]);

  return (
    <Stack spacing={8} divider={<StackDivider />}>
      <Box>
        <Stack
          direction={{ base: "column", md: "row" }}
          spacing={{ base: "1.5", md: "8" }}
          justify="space-between"
        >
          <Heading size="sm" fontWeight={600}>
            {t("components.discordMessageForm.contentSectionTitle")}
          </Heading>
          <Stack spacing={8} width="100%" maxW={{ md: "3xl" }}>
            <FormControl isInvalid={!!errors.content}>
              <Controller
                name="content"
                control={control}
                render={({ field }) => (
                  <Textarea aria-label="Text content" spellCheck={false} {...field} />
                )}
              />
              {errors.content && <FormErrorMessage>{errors.content.message}</FormErrorMessage>}
            </FormControl>
          </Stack>
        </Stack>
      </Box>
      <Box>
        <Stack
          direction={{ base: "column", md: "row" }}
          spacing={{ base: "1.5", md: "8" }}
          justify="space-between"
        >
          <Heading size="sm" fontWeight={600}>
            {t("components.discordMessageForm.splitContentSectionTitle")}
          </Heading>
          <Stack spacing={8} width="100%" maxW={{ md: "3xl" }}>
            <FormControl>
              <Controller
                name="splitOptions"
                control={control}
                render={({ field }) => {
                  return (
                    <Checkbox
                      name={field.name}
                      isChecked={!!field.value}
                      onChange={(e) => {
                        if (e.currentTarget.checked) {
                          field.onChange({});
                        } else {
                          field.onChange(null);
                        }
                      }}
                    >
                      {t("components.discordMessageForm.splitContentCheckboxLabel")}
                    </Checkbox>
                  );
                }}
              />
              <FormHelperText>
                {t("components.discordMessageForm.splitContentCheckboxDescription")}
              </FormHelperText>
            </FormControl>
            <Accordion allowToggle index={accordionIndexes}>
              <AccordionItem isDisabled={!isSplitOptionsEnabled}>
                <AccordionButton onClick={onClickSplitSettingsAccordion}>
                  <HStack textAlign="left" spacing={4} flex="1">
                    <SettingsIcon />
                    <Text>{t("components.discordMessageForm.splitContentSettingsLabel")}</Text>
                  </HStack>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel>
                  <Stack spacing={8} width="100%" maxW={{ md: "3xl" }}>
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
      </Box>
    </Stack>
  );
};
