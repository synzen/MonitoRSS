import {
  Code,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  Link,
  Select,
  Skeleton,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Trans, useTranslation } from "react-i18next";
import { useDebounce } from "../../hooks";
import { useUserFeedDatePreview } from "../../features/feed/hooks/useUserFeedDatePreview";
import { InlineErrorAlert } from "../InlineErrorAlert";
import DATE_LOCALES from "../../constants/dateLocales";

interface Props {
  values: {
    format?: string;
    timezone?: string;
    locale?: string;
  };
  errors: {
    timezone?: string;
  };
  onChange: (values: { format?: string; timezone?: string; locale?: string }) => void;
}

export const DatePreferencesForm = ({
  values: { format, locale, timezone },
  onChange,
  errors,
}: Props) => {
  const { t } = useTranslation();

  const debouncedPreviewInput = useDebounce(
    {
      dateFormat: format,
      dateTimezone: timezone,
      dateLocale: locale,
    },
    400
  );

  const { data: datePreviewData, error: datePreviewError } = useUserFeedDatePreview({
    feedId: "feedId", // value doesn't matter here
    data: debouncedPreviewInput,
  });

  const onChangeFormat = ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      format: value,
      timezone,
      locale,
    });
  };

  const onChangeTimezone = ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      format,
      timezone: value,
      locale,
    });
  };

  const onChangeLocale = ({ target: { value } }: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      format,
      timezone,
      locale: value,
    });
  };

  return (
    <Stack spacing={4}>
      <FormControl>
        <FormLabel marginBottom={0}>
          {t(
            "features.feedConnections.components.userFeedSettingsTabSection.dateSettingsPreviewTitle"
          )}
        </FormLabel>
        {!datePreviewError && (
          <Skeleton isLoaded={!!datePreviewData}>
            <Text fontSize="xl" color={datePreviewData?.result.valid ? "gray.400" : "red.400"}>
              {datePreviewData?.result.valid && datePreviewData?.result.output}
              {!datePreviewData?.result.valid &&
                t("features.feedConnections.components.userFeedSettingsTabSection.invalidTimezone")}
            </Text>
          </Skeleton>
        )}
        {datePreviewError && (
          <InlineErrorAlert
            title="Failed to load date preview"
            description={datePreviewError.message}
          />
        )}
      </FormControl>
      <FormControl isInvalid={!!errors.timezone}>
        <FormLabel>
          {t(
            "features.feedConnections.components.userFeedSettingsTabSection.dateTimezoneInputLabel"
          )}
        </FormLabel>
        <Input spellCheck={false} value={timezone || ""} onChange={onChangeTimezone} />
        {!errors.timezone && (
          <FormHelperText>
            <Trans
              i18nKey="features.feedConnections.components.userFeedSettingsTabSection.dateTimezoneInputDescription"
              components={[
                <Link
                  href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones"
                  target="_blank"
                  rel="noreferrer noopener"
                  color="blue.300"
                />,
              ]}
            />
          </FormHelperText>
        )}
        {errors.timezone && (
          <FormErrorMessage>
            {errors.timezone} (
            <Trans
              i18nKey="features.feedConnections.components.userFeedSettingsTabSection.dateTimezoneInputDescription"
              components={[
                <Link
                  href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones"
                  target="_blank"
                  rel="noreferrer noopener"
                  color="blue.300"
                />,
              ]}
            />
            )
          </FormErrorMessage>
        )}
      </FormControl>
      <FormControl>
        <FormLabel>
          {t("features.feedConnections.components.userFeedSettingsTabSection.dateFormatInputLabel")}
        </FormLabel>
        <Input spellCheck={false} autoComplete="" value={format || ""} onChange={onChangeFormat} />
        <FormHelperText>
          This will dictate how the placeholders with dates will be formatted. For more information
          on formatting, see{" "}
          <Link
            color="blue.300"
            target="_blank"
            rel="noopener noreferrer"
            href="https://day.js.org/docs/en/display/format"
          >
            https://day.js.org/docs/en/display/format
          </Link>
        </FormHelperText>
      </FormControl>
      <FormControl>
        <FormLabel>Date Format Locale</FormLabel>
        <Select placeholder="Select option" value={locale || ""} onChange={onChangeLocale}>
          {DATE_LOCALES.map(({ key, name }) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </Select>
        <FormHelperText>
          The locale to use for formatting dates. Leave blank to use the default (
          <Code>English</Code>).
        </FormHelperText>
      </FormControl>
    </Stack>
  );
};
