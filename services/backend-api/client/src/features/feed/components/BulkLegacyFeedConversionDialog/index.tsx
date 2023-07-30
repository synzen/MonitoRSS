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
import { useSeverLegacyFeedBulkConversion } from "../../hooks";
import { InlineErrorAlert } from "../../../../components";

export const BulkLegacyFeedConversionDialog = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    data: conversionData,
    error: conversionError,
    status: conversionStatus,
  } = useSeverLegacyFeedBulkConversion({
    serverId: "1",
  });

  const doneSoFarCount =
    (conversionData?.counts.completed || 0) + (conversionData?.counts.failed || 0);

  const total =
    doneSoFarCount +
    (conversionData?.counts.inProgress || 0) +
    (conversionData?.counts.notStarted || 0);

  const percent = Math.floor((doneSoFarCount / total) * 100);

  return (
    <>
      <Button onClick={onOpen}>Open Modal</Button>
      <Modal size="2xl" isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Bulk conversion for private serverse</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {conversionError && (
              <InlineErrorAlert
                title="Failed to get conversion status"
                description={conversionError.message}
              />
            )}
            {conversionStatus === "loading" && (
              <Center>
                <Spinner size="xl" />
              </Center>
            )}
            {conversionStatus !== "loading" && conversionData && (
              <Stack spacing={8}>
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
                        <AlertTitle>5 feeds had internal errors while converting</AlertTitle>
                        <AlertDescription>
                          <Button colorScheme="blue" size="sm">
                            Retry all
                          </Button>
                        </AlertDescription>
                      </Flex>
                    </Alert>
                    <TableContainer>
                      <Table variant="striped" size="sm">
                        <Thead>
                          <Tr>
                            <Th>Status</Th>
                            <Th>Title</Th>
                            <Th>Url</Th>
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
