import { Code, Input, Link, Skeleton, Stack, Text } from "@chakra-ui/react";
import { Trans, useTranslation } from "react-i18next";
import { useDebounce } from "@/hooks";
import { useUserFeedDatePreview } from "../../hooks/useUserFeedDatePreview";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import DATE_LOCALES from "@/constants/dateLocales";
import { Field } from "@/components/ui/field";
import { NativeSelectRoot, NativeSelectField } from "@/components/ui/native-select";

interface Props {
  values: {
    format?: string;
    timezone?: string;
    locale?: string;
  };
  errors: {
    timezone?: string;
    format?: string;
  };
  onChange: (values: { format?: string; timezone?: string; locale?: string }) => void;
  disablePreview?: boolean;
  size?: "sm" | "md" | "lg";
  requiredFields?: Array<keyof Props["values"]>;
}

export const DatePreferencesForm = ({
  values: { format, locale, timezone },
  onChange,
  errors,
  disablePreview,
  size,
  requiredFields,
}: Props) => {
  const { t } = useTranslation();

  const debouncedPreviewInput = useDebounce(
    {
      dateFormat: format,
      dateTimezone: timezone,
      dateLocale: locale,
    },
    400,
  );

  const { data: datePreviewData, error: datePreviewError } = useUserFeedDatePreview({
    feedId: "feedId", // value doesn't matter here
    data: debouncedPreviewInput,
    disabled: disablePreview,
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
    <Stack gap={4}>
      {!disablePreview && (
        <Field
          label={t(
            "features.feedConnections.components.userFeedSettingsTabSection.dateSettingsPreviewTitle",
          )}
        >
          {!datePreviewError && (
            <Skeleton loading={!datePreviewData}>
              <Text fontSize="xl" color={datePreviewData?.result.valid ? "fg.muted" : "text.error"}>
                {datePreviewData?.result.valid && datePreviewData?.result.output}
                {!datePreviewData?.result.valid &&
                  t(
                    "features.feedConnections.components.userFeedSettingsTabSection.invalidTimezone",
                  )}
              </Text>
            </Skeleton>
          )}
          {datePreviewError && (
            <InlineErrorAlert
              title="Failed to load date preview"
              description={datePreviewError.message}
            />
          )}
        </Field>
      )}
      <Field
        required={requiredFields?.includes("format")}
        label={t(
          "features.feedConnections.components.userFeedSettingsTabSection.dateFormatInputLabel",
        )}
        helperText={
          !errors.format ? (
            <>
              This will dictate how the placeholders with dates will be formatted. For more
              information on formatting, see{" "}
              <Link
                color="text.link"
                target="_blank"
                rel="noopener noreferrer"
                href="https://day.js.org/docs/en/display/format"
              >
                https://day.js.org/docs/en/display/format
              </Link>
            </>
          ) : undefined
        }
        errorText={errors.format}
      >
        <Input
          size={size}
          spellCheck={false}
          autoComplete=""
          value={format || ""}
          onChange={onChangeFormat}
        />
      </Field>
      <Field
        invalid={!!errors.timezone}
        label={t(
          "features.feedConnections.components.userFeedSettingsTabSection.dateTimezoneInputLabel",
        )}
        helperText={
          !errors.timezone ? (
            <Trans
              i18nKey="features.feedConnections.components.userFeedSettingsTabSection.dateTimezoneInputDescription"
              components={[
                <Link
                  href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones"
                  target="_blank"
                  rel="noreferrer noopener"
                  color="text.link"
                />,
              ]}
            />
          ) : undefined
        }
        errorText={
          errors.timezone ? (
            <>
              {errors.timezone} (
              <Trans
                i18nKey="features.feedConnections.components.userFeedSettingsTabSection.dateTimezoneInputDescription"
                components={[
                  <Link
                    href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones"
                    target="_blank"
                    rel="noreferrer noopener"
                    color="text.link"
                  />,
                ]}
              />
              )
            </>
          ) : undefined
        }
      >
        <Input size={size} spellCheck={false} value={timezone || ""} onChange={onChangeTimezone} />
      </Field>
      <Field
        label="Date Format Locale"
        helperText={
          <>
            The locale to use for formatting dates. Leave blank to use the default (
            <Code>English</Code>).
          </>
        }
      >
        <NativeSelectRoot size={size}>
          <NativeSelectField
            placeholder="Select option"
            value={locale || ""}
            onChange={onChangeLocale}
          >
            {DATE_LOCALES.map(({ key, name }) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </NativeSelectField>
        </NativeSelectRoot>
      </Field>
    </Stack>
  );
};
