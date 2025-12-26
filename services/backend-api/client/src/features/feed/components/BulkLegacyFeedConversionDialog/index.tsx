/* eslint-disable no-underscore-dangle */
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Center,
  Flex,
  HStack,
  Link,
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
import { motion } from "motion/react";
import { WarningIcon } from "@chakra-ui/icons";
import { cloneElement } from "react";
import { useNavigate } from "react-router-dom";
import {
  useCreateServerLegacyFeedBulkConversion,
  useSeverLegacyFeedBulkConversion,
} from "../../hooks";
import { InlineErrorAlert } from "../../../../components";
import { notifyError } from "../../../../utils/notifyError";
import { useDiscordServer } from "../../../discordServers";
import { pages } from "../../../../constants";

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
  const navigate = useNavigate();

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
                            <span>Retry all</span>
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
                            <Th maxWidth="300px">Reason</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {conversionData.failedFeeds.map((feed) => (
                            <Tr key={feed._id}>
                              <Td>
                                <WarningIcon color="red.300" />
                              </Td>
                              <Td>{feed.title}</Td>
                              <Td overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                                <Link
                                  color="blue.300"
                                  href={feed.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {feed.url}
                                </Link>
                              </Td>
                              <Td whiteSpace="normal">{feed.failReasonPublic || ""}</Td>
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
            <HStack>
              <Button onClick={onClose}>Close</Button>
              <Button
                colorScheme="blue"
                onClick={() => {
                  navigate(pages.userFeeds());
                }}
              >
                View Personal Feeds
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
