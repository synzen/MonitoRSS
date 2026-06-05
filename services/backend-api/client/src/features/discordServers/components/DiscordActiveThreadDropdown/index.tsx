import { Alert as ChakraAlert, Box, Stack } from "@chakra-ui/react";
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
        isDisabled={isDisabled || !!error}
        options={options}
        onChange={(val, optionData) => {
          onChange(val, optionData?.name);
        }}
        onBlur={onBlur}
        value={value}
        isClearable={isClearable}
        selectProps={
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {
            inputId,
            "aria-labelledby": ariaLabelledBy,
            "aria-busy": isFetching,
            openMenuOnClick: !isFetching,
            openMenuOnFocus: !isFetching,
          } as any
        }
        isInvalid={isInvalid}
        placeholder={placeholder}
      />
      {serverId && error && (
        <ChakraAlert.Root status="error">
          <ChakraAlert.Indicator />
          <Box>
            <ChakraAlert.Title>
              {t(
                "features.feed.components.addDiscordChannelThreadConnectionDialog.failedToGetThreads",
              )}
            </ChakraAlert.Title>
            <ChakraAlert.Description>{error?.message}</ChakraAlert.Description>
          </Box>
        </ChakraAlert.Root>
      )}
    </Stack>
  );
};
