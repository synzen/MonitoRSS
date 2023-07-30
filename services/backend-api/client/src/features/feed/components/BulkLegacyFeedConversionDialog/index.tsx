/* eslint-disable no-underscore-dangle */
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Center,
  Flex,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
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
import { motion } from "framer-motion";
import { WarningIcon } from "@chakra-ui/icons";
import { cloneElement } from "react";
import {
  useCreateServerLegacyFeedBulkConversion,
  useSeverLegacyFeedBulkConversion,
} from "../../hooks";
import { InlineErrorAlert } from "../../../../components";
import { notifyError } from "../../../../utils/notifyError";
import { useDiscordServer } from "../../../discordServers";

interface Props {
  serverId?: string;
  trigger: React.ReactElement;
}

export const BulkLegacyFeedConversionDialog = ({ serverId, trigger }: Props) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    data: conversionData,
    error: conversionError,
    status: conversionStatus,
  } = useSeverLegacyFeedBulkConversion(
    {
      serverId,
    },
    {
      disablePolling: !isOpen,
    }
  );
  const { mutateAsync: retryFailed, status: retryStatus } =
    useCreateServerLegacyFeedBulkConversion();
  const { data: serverData } = useDiscordServer({ serverId });

  const onClickRetryFailed = async () => {
    try {
      if (!serverId) {
        return;
      }

      await retryFailed({ serverId });
    } catch (err) {
      notifyError(`Failed to retry conversion`, (err as Error).message);
    }
  };

  const doneSoFarCount =
    (conversionData?.counts.completed || 0) + (conversionData?.counts.failed || 0);

  const total =
    doneSoFarCount +
    (conversionData?.counts.inProgress || 0) +
    (conversionData?.counts.notStarted || 0);

  const percent = Math.floor((doneSoFarCount / total) * 100);

  return (
    <>
      {cloneElement(trigger, { onClick: onOpen })}
      <Modal size="2xl" isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Bulk conversion status for {serverData?.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {conversionStatus === "loading" && (
              <Center>
                <Spinner size="xl" />
              </Center>
            )}
            {conversionStatus !== "loading" && conversionData && (
              <Stack spacing={8}>
                {conversionError && (
                  <InlineErrorAlert
                    title="Failed to get conversion status"
                    description={conversionError.message}
                  />
                )}
                <Stack>
                  <HStack alignItems="center">
                    {percent < 100 && <Spinner size="xs" />}
                    <Text fontWeight={600}>{percent}% processed</Text>
                  </HStack>
                  <Progress
                    sx={{
                      "& > div:first-child": {
                        transitionProperty: "width",
                      },
                    }}
                    as={motion.div}
                    value={percent}
                    hasStripe
                    colorScheme="blue"
                    transition="all 2s"
                  />
                  {percent < 100 && (
                    <Text fontSize="xs">You may close this dialog while it is processing.</Text>
                  )}
                </Stack>
                {conversionData.failedFeeds.length && (
                  <Stack>
                    <Alert status="error" size="sm">
                      <Flex
                        flexWrap="wrap"
                        justifyContent="space-between"
                        alignItems="center"
                        width="100%"
                      >
                        <AlertTitle>
                          {conversionData.failedFeeds.length} feed(s) failed to be converted
                        </AlertTitle>
                        <AlertDescription>
                          <Button
                            colorScheme="blue"
                            size="sm"
                            onClick={onClickRetryFailed}
                            isLoading={retryStatus === "loading"}
                          >
                            Retry all
                          </Button>
                        </AlertDescription>
                      </Flex>
                    </Alert>
                    <TableContainer>
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th>Status</Th>
                            <Th>Title</Th>
                            <Th>Url</Th>
                            <Th>Reason</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {conversionData.failedFeeds.map((feed) => (
                            <Tr key={feed._id}>
                              <Td>
                                <WarningIcon color="red.300" />
                              </Td>
                              <Td>{feed.title}</Td>
                              <Td>{feed.url}</Td>
                              <Td>{feed.failReasonPublic || ""}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </TableContainer>
                  </Stack>
                )}
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
