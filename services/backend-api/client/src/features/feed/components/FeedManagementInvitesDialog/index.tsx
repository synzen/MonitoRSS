import { Button, Center, HStack, Icon, Spinner, Stack, Table, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FaCheck, FaXmark } from "react-icons/fa6";
import { useUpdateUserFeedManagementInviteStatus, useUserFeedManagementInvites } from "../../hooks";
import { DestructiveActionButton } from "@/components/DestructiveActionButton";
import { InlineErrorAlert } from "../../../../components/InlineErrorAlert";
import { DiscordUsername } from "../../../discordUser";
import { UserFeedManagementInvite } from "../../types";
import { UserFeedManagerInviteType, UserFeedManagerStatus } from "../../../../constants";
import {
  PageAlertContextOutlet,
  PageAlertProvider,
  usePageAlertContext,
} from "../../../../contexts/PageAlertContext";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogCloseTrigger,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";

interface Props {
  trigger: React.ReactElement;
}

const FeedManagementInviteRow = ({
  invite: {
    id,
    feed: { ownerDiscordUserId, title, url },
    type,
  },
}: {
  invite: UserFeedManagementInvite;
}) => {
  const { mutateAsync, status, reset } = useUpdateUserFeedManagementInviteStatus();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const { createErrorAlert, createSuccessAlert } = usePageAlertContext();

  const onAccept = async () => {
    if (status === "loading") {
      return;
    }

    try {
      setIsAccepting(true);
      await mutateAsync({
        id,
        data: {
          status: UserFeedManagerStatus.Accepted,
        },
      });

      createSuccessAlert({
        title: `Successfully accepted feed management invite.`,
      });

      reset();
    } catch (err) {
      createErrorAlert({
        title: "Failed to accept feed management invite.",
        description: (err as Error).message,
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const onDecline = async () => {
    if (status === "loading") {
      return;
    }

    try {
      setIsDeclining(true);
      await mutateAsync({
        id,
        data: {
          status: UserFeedManagerStatus.Declined,
        },
      });

      createSuccessAlert({
        title: `Successfully declined feed management invite.`,
      });

      reset();
    } catch (err) {
      createErrorAlert({
        title: "Failed to decline feed management invite.",
        description: (err as Error).message,
      });
    } finally {
      setIsDeclining(false);
    }
  };

  return (
    <Table.Row key={id}>
      <Table.Cell>
        {(!type || type === UserFeedManagerInviteType.CoManage) && <Text>Co-manage</Text>}
        {type === UserFeedManagerInviteType.Transfer && <Text>Ownership transfer</Text>}
      </Table.Cell>
      <Table.Cell>
        <DiscordUsername userId={ownerDiscordUserId} />
      </Table.Cell>
      <Table.Cell>{title}</Table.Cell>
      <Table.Cell overflow="hidden" textOverflow="ellipsis" maxWidth="300px" title={url}>
        {url}
      </Table.Cell>
      <Table.Cell>
        <HStack>
          <Button
            size="xs"
            variant="solid"
            colorPalette="green"
            aria-disabled={isAccepting}
            onClick={onAccept}
          >
            <Icon as={FaCheck} />
            <span>{isAccepting ? "Accepting..." : "Accept"}</span>
          </Button>
          <DestructiveActionButton size="xs" aria-disabled={isDeclining} onClick={onDecline}>
            <Icon as={FaXmark} />
            <span>{isDeclining ? "Declining..." : "Decline"}</span>
          </DestructiveActionButton>
        </HStack>
      </Table.Cell>
    </Table.Row>
  );
};

export const FeedManagementInvitesDialog = ({ trigger }: Props) => {
  const { data, error, status } = useUserFeedManagementInvites();
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <DialogRoot open={open} onOpenChange={(e) => setOpen(e.open)} size="xl">
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader marginRight={4}>
          <DialogTitle>Feed Management Invites</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <PageAlertProvider>
            <Stack gap={4}>
              <Text>
                You have been invited to either co-manage or own one or more feeds owned by someone
                else. Once you accept the invite, you&apos;ll be able to see those feeds in your
                feed list.
              </Text>
              {!error && data && (
                <Alert
                  status="warning"
                  role="none"
                  title="Accepting an invite will count towards your feed limit"
                />
              )}
              {error && (
                <InlineErrorAlert
                  title={t("common.errors.somethingWentWrong")}
                  description={error.message}
                />
              )}
              {status === "loading" && (
                <Center>
                  <Spinner />
                </Center>
              )}
              {data && (
                <Table.ScrollArea
                  bg="bg.subtle"
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="l3"
                >
                  <Table.Root variant="line">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Request Type</Table.ColumnHeader>
                        <Table.ColumnHeader>Owner</Table.ColumnHeader>
                        <Table.ColumnHeader>Feed Title</Table.ColumnHeader>
                        <Table.ColumnHeader>Feed URL</Table.ColumnHeader>
                        <Table.ColumnHeader>Action</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {data.results.map((invite) => (
                        <FeedManagementInviteRow invite={invite} key={invite.id} />
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Table.ScrollArea>
              )}
              <PageAlertContextOutlet />
            </Stack>
          </PageAlertProvider>
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
