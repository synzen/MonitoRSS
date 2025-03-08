import {
  Alert,
  AlertIcon,
  AlertTitle,
  Button,
  Center,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
} from "@chakra-ui/react";
import { cloneElement, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon, CloseIcon } from "@chakra-ui/icons";
import { useUpdateUserFeedManagementInviteStatus, useUserFeedManagementInvites } from "../../hooks";
import { InlineErrorAlert } from "../../../../components/InlineErrorAlert";
import { DiscordUsername } from "../../../discordUser";
import { UserFeedManagementInvite } from "../../types";
import { UserFeedManagerInviteType, UserFeedManagerStatus } from "../../../../constants";
import {
  PageAlertContextOutlet,
  PageAlertProvider,
  usePageAlertContext,
} from "../../../../contexts/PageAlertContext";

interface Props {
  trigger: React.ReactElement;
}

const FeedManagementInviteRow = ({
  currentNumberOfInvites,
  onClose,
  invite: {
    id,
    feed: { ownerDiscordUserId, title, url },
    type,
  },
}: {
  currentNumberOfInvites: number;
  onClose: () => void;
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

      if (currentNumberOfInvites === 1) {
        // onClose();
      }
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

      if (currentNumberOfInvites === 1) {
        // onClose();
      }
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
    <Tr key={id}>
      <Td>
        {(!type || type === UserFeedManagerInviteType.CoManage) && <Text>Co-manage</Text>}
        {type === UserFeedManagerInviteType.Transfer && <Text>Ownership transfer</Text>}
      </Td>
      <Td>
        <DiscordUsername userId={ownerDiscordUserId} />
      </Td>
      <Td>{title}</Td>
      <Td overflow="hidden" textOverflow="ellipsis" maxWidth="300px" title={url}>
        {url}
      </Td>
      <Td>
        <HStack>
          <Button
            size="xs"
            colorScheme="green"
            leftIcon={<CheckIcon />}
            aria-disabled={isAccepting}
            onClick={onAccept}
          >
            <span>{isAccepting ? "Accepting..." : "Accept"}</span>
          </Button>
          <Button
            size="xs"
            colorScheme="red"
            leftIcon={<CloseIcon />}
            aria-disabled={isDeclining}
            onClick={onDecline}
          >
            <span>{isDeclining ? "Declining..." : "Decline"}</span>
          </Button>
        </HStack>
      </Td>
    </Tr>
  );
};

export const FeedManagementInvitesDialog = ({ trigger }: Props) => {
  const { data, error, status } = useUserFeedManagementInvites();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { t } = useTranslation();

  return (
    <>
      {cloneElement(trigger, { onClick: onOpen })}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Feed Management Invites</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <PageAlertProvider>
              <Stack spacing={4}>
                <Text>
                  You have been invited to either co-manage or own one or more feeds owned by
                  someone else. Once you accept the invite, you&apos;ll be able to see those feeds
                  in your feed list.
                </Text>
                {!error && data && (
                  <Alert status="warning" role="none">
                    <AlertIcon />
                    <AlertTitle>Accepting an invite will count towards your feed limit</AlertTitle>
                  </Alert>
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
                  <TableContainer bg="gray.800" borderRadius="md">
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Request Type</Th>
                          <Th>Owner</Th>
                          <Th>Feed Title</Th>
                          <Th>Feed URL</Th>
                          <Th>Action</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {data.results.map((invite) => (
                          <FeedManagementInviteRow
                            onClose={onClose}
                            currentNumberOfInvites={data.results.length}
                            invite={invite}
                            key={invite.id}
                          />
                        ))}
                      </Tbody>
                    </Table>
                  </TableContainer>
                )}
                <PageAlertContextOutlet />
              </Stack>
            </PageAlertProvider>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
