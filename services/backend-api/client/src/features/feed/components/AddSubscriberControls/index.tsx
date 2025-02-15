import { Box, Button, FormControl, FormLabel, Flex, VisuallyHidden } from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ThemedSelect } from "@/components";
import { DiscordRole } from "@/features/discordServers";
import { useCreateFeedSubscriber } from "../../hooks";
import { notifyError } from "@/utils/notifyError";

interface Props {
  feedId: string;
  roles: DiscordRole[];
  loading?: boolean;
}

export const AddSubscriberControls: React.FC<Props> = ({ feedId, roles, loading }) => {
  const [currentRoleId, setCurrentRoleId] = useState<string | undefined>();
  const { mutateAsync, status } = useCreateFeedSubscriber({
    feedId,
  });
  const { t } = useTranslation();

  const onClickAdd = async () => {
    if (!currentRoleId) {
      return;
    }

    try {
      await mutateAsync({
        feedId,
        details: {
          discordId: currentRoleId,
          type: "role",
        },
      });
      setCurrentRoleId(undefined);
    } catch (err) {
      notifyError("Failed to add subscriber", err as Error);
    }
  };

  return (
    <Flex flexWrap="wrap">
      <FormControl width={250}>
        <VisuallyHidden>
          <FormLabel htmlFor="subscriber-name">
            {t("pages.filters.formAddFilterInputLabel")}
          </FormLabel>
        </VisuallyHidden>
        <Box marginRight="4" marginTop="2">
          <ThemedSelect
            isInvalid={false}
            id="subscriber-name"
            onChange={(value) => setCurrentRoleId(value)}
            loading={loading}
            value={currentRoleId}
            options={roles.map((role) => ({
              label: role.name,
              value: role.id,
              icon: <Box width={6} borderRadius="50%" height={6} bg={role.color} />,
              data: role,
            }))}
          />
        </Box>
      </FormControl>
      <Button
        marginTop="2"
        alignSelf="flex-end"
        minWidth="100"
        colorScheme="blue"
        isDisabled={!currentRoleId || status === "loading" || roles.length === 0}
        onClick={onClickAdd}
        isLoading={status === "loading"}
      >
        <span>{t("pages.subscribers.addSubscriberButton")}</span>
      </Button>
    </Flex>
  );
};
