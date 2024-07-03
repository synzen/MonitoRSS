import {
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Heading,
  Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { useUpdateUserFeedManagementInvite, useUserFeed } from "../../../../feed/hooks";
import { ConnectionsCheckboxList } from "../../ConnectionsCheckboxList";
import { UserFeed } from "../../../../feed/types";
import { notifySuccess } from "../../../../../utils/notifySuccess";
import { InlineErrorAlert } from "../../../../../components";

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
        checkedConnections.includes(id)
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
      notifySuccess(t("common.success.savedChanges"));
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
    <Modal size="xl" isOpen={isOpen} onClose={onClose} finalFocusRef={onCloseRef}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Update feed management invite</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={6}>
            <Stack spacing={2}>
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
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button variant="ghost" onClick={onClose}>
              <span>Cancel</span>
            </Button>
            <Button colorScheme="blue" mr={3} onClick={onSubmit} isLoading={status === "loading"}>
              <span>Save</span>
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
