import { Alert, AlertDescription, AlertTitle, Box, Stack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { ThemedSelect } from "@/components";
import { useDiscordServerActiveThreads } from "../../hooks";

interface Props {
  serverId?: string;
  parentChannelId?: string;
  onChange: (threadId: string, threadName?: string) => void;
  onBlur: () => void;
  value?: string;
  isDisabled?: boolean;
  isClearable?: boolean;
  inputId?: string;
  ariaLabelledBy: string;
  isInvalid: boolean;
  placeholder?: string;
}

export const DiscordActiveThreadDropdown: React.FC<Props> = ({
  placeholder,
  serverId,
  parentChannelId,
  onChange,
  onBlur,
  value,
  isDisabled,
  isClearable,
  inputId,
  ariaLabelledBy,
  isInvalid,
}) => {
  const { data, error, isFetching } = useDiscordServerActiveThreads({
    serverId,
    options: { parentChannelId },
  });
  const { t } = useTranslation();

  const options =
    data?.results.map((channel) => ({
      label: channel.name,
      value: channel.id,
      data: channel,
    })) || [];

  return (
    <Stack>
      <ThemedSelect
        loading={isFetching}
        isDisabled={isDisabled || isFetching || !!error}
        options={options}
        onChange={(val, optionData) => {
          onChange(val, optionData?.name);
        }}
        onBlur={onBlur}
        value={value}
        isClearable={isClearable}
        selectProps={{
          inputId,
          "aria-labelledby": ariaLabelledBy,
        }}
        isInvalid={isInvalid}
        placeholder={placeholder}
      />
      {serverId && error && (
        <Alert status="error">
          <Box>
            <AlertTitle>
              {t(
                "features.feed.components.addDiscordChannelThreadConnectionDialog.failedToGetThreads"
              )}
            </AlertTitle>
            <AlertDescription>{error?.message}</AlertDescription>
          </Box>
        </Alert>
      )}
    </Stack>
  );
};
