import { Button, HStack, Stack, Heading, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { useUpdateUserFeedManagementInvite, useUserFeed, UserFeed } from "@/features/feed";
import { ConnectionsCheckboxList } from "../../ConnectionsCheckboxList";
import { InlineErrorAlert } from "@/components";
import { usePageAlertContext } from "@/contexts/PageAlertContext";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogCloseTrigger,
} from "@/components/ui/dialog";

interface Props {
  feedId?: string;
  inviteId?: string;
  isOpen: boolean;
  onClose: () => void;
  onCloseRef?: React.MutableRefObject<HTMLButtonElement | null>;
}

export const ManageUserFeedManagementInviteSettingsDialog = ({
  feedId,
  inviteId,
  isOpen,
  onClose,
  onCloseRef,
}: Props) => {
  const { mutateAsync, status, error } = useUpdateUserFeedManagementInvite({ feedId });
  const { t } = useTranslation();
  const { feed, status: feedStatus } = useUserFeed({ feedId });
  const currentConnectionIds = feed?.shareManageOptions?.invites
    ?.find((i) => i.id === inviteId)
    ?.connections?.map((c) => c.connectionId);
  const allConnectionIds = feed?.connections.map((c) => c.id) || [];
  const [checkedConnections, setCheckedConnections] = useState<string[]>([]);
  const { createSuccessAlert } = usePageAlertContext();

  const resetState = () => {
    if (currentConnectionIds?.length) {
      setCheckedConnections(currentConnectionIds);
    } else {
      setCheckedConnections(allConnectionIds);
    }
  };

  const onClickSelectAllConnections = () => {
    setCheckedConnections(feed?.connections.map((c) => c.id) || []);
  };

  const onClickSelectNoneConnections = () => {
    setCheckedConnections([]);
  };

  const onSubmit = async () => {
    if (!feedId || !inviteId) {
      return;
    }

    try {
      const everyConnectionIsChecked = allConnectionIds.every((id) =>
        checkedConnections.includes(id),
      );

      await mutateAsync({
        id: inviteId,
        data: {
          connections: everyConnectionIsChecked
            ? null
            : checkedConnections.map((id) => ({
                connectionId: id,
              })),
        },
      });
      onClose();
      createSuccessAlert({
        title: "Successfully updated feed management invite.",
      });
      setCheckedConnections([]);
    } catch (err) {}
  };

  useEffect(() => {
    if (feedStatus !== "success") {
      return;
    }

    resetState();
  }, [feedStatus]);

  useEffect(() => {
    resetState();
  }, [isOpen]);

  return (
    <DialogRoot
      size="xl"
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) {
          onClose();
        }
      }}
      finalFocusEl={onCloseRef ? () => onCloseRef.current : undefined}
    >
      <DialogContent>
        <DialogHeader marginRight={4}>
          <DialogTitle>Update feed management invite</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <Stack gap={6}>
            <Stack gap={2}>
              <Heading size="sm" as="h2">
                Shared Connections
              </Heading>
              <Text>
                The connections the invitee will be able to view and have access to for management.
              </Text>
              <HStack>
                <Button size="sm" onClick={onClickSelectAllConnections}>
                  Select All
                </Button>
                <Button size="sm" onClick={onClickSelectNoneConnections}>
                  Select None
                </Button>
              </HStack>
              <ConnectionsCheckboxList
                checkedConnectionIds={checkedConnections}
                onCheckConnectionChange={setCheckedConnections}
                feed={feed as UserFeed}
              />
            </Stack>
            {error && (
              <InlineErrorAlert
                title={t("common.errors.failedToSave")}
                description={error.message}
              />
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <HStack>
            <Button variant="ghost" onClick={onClose}>
              <span>Cancel</span>
            </Button>
            <PrimaryActionButton mr={3} onClick={onSubmit} loading={status === "loading"}>
              <span>Save</span>
            </PrimaryActionButton>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
