import {
  Button,
  Heading,
  HStack,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
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
import { cloneElement } from "react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import dayjs from "dayjs";
import { UserFeedRequest } from "../../../types";

interface Props {
  request: UserFeedRequest;
  trigger: React.ReactElement;
}

export const RequestDetails = ({ request, trigger }: Props) => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const requestHeaders = request.headers
    ? (Object.entries(request.headers) as [string, string][])
    : null;

  const responseHeaders = request.response.headers
    ? (Object.entries(request.response.headers) as [string, string][])
    : null;

  const statusCode = request.response.statusCode || null;
  const durationMs = request.finishedAtIso
    ? `${new Date(request.finishedAtIso).getTime() - new Date(request.createdAtIso).getTime()}ms`
    : null;

  return (
    <>
      {cloneElement(trigger, { onClick: onOpen })}
      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Request Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={8}>
              <Stack spacing={4}>
                <Heading size="md" as="h2">
                  Request
                </Heading>
                <HStack flexWrap="wrap" gap={16}>
                  <Stack>
                    <Heading size="sm" as="h3">
                      URL
                    </Heading>
                    <Link
                      href={request.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      color="blue.300"
                    >
                      <HStack alignItems="center">
                        <Text wordBreak="break-all">{request.url}</Text>
                        <ExternalLinkIcon />
                      </HStack>
                    </Link>
                  </Stack>
                  <Stack>
                    <Heading size="sm" as="h3">
                      Initiated At
                    </Heading>
                    <Text>{dayjs(request.createdAtIso).format("DD MMM YYYY, HH:mm:ss.SSS")}</Text>
                  </Stack>
                </HStack>
                <Heading size="sm" as="h3">
                  Headers
                </Heading>
                {!requestHeaders && <Text color="gray.400">No request headers available.</Text>}
                {!!requestHeaders && (
                  <TableContainer bg="gray.800" p={4} borderRadius="md">
                    <Table size="sm" variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Name</Th>
                          <Th>Value</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {requestHeaders.map(([key, val]) => {
                          return (
                            <Tr key={key}>
                              <Td>{key}</Td>
                              <Td overflow="auto">{val}</Td>
                            </Tr>
                          );
                        })}
                      </Tbody>
                    </Table>
                  </TableContainer>
                )}
              </Stack>
              <Stack spacing={4}>
                <Heading size="md" as="h2">
                  Response
                </Heading>
                <HStack flexWrap="wrap" gap={16}>
                  <Stack>
                    <Heading size="sm" as="h3">
                      Status Code
                    </Heading>
                    <Text>{statusCode || "N/A"}</Text>
                  </Stack>
                  <Stack>
                    <Heading size="sm" as="h3">
                      Received At
                    </Heading>
                    <Text>
                      {request.finishedAtIso
                        ? dayjs(request.finishedAtIso).format("DD MMM YYYY, HH:mm:ss.SSS")
                        : "N/A"}
                    </Text>
                  </Stack>
                  <Stack>
                    <Heading size="sm" as="h3">
                      Duration
                    </Heading>
                    <Text>{durationMs || "N/A"}</Text>
                  </Stack>
                </HStack>
                <Heading size="sm" as="h3">
                  Headers
                </Heading>
                {!responseHeaders && <Text color="gray.400">No response headers available.</Text>}
                {!!responseHeaders && (
                  <TableContainer bg="gray.800" p={4} borderRadius="md">
                    <Table size="sm" variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Name</Th>
                          <Th>Value</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {responseHeaders.map(([key, val]) => {
                          return (
                            <Tr key={key}>
                              <Td>{key}</Td>
                              <Td>{val}</Td>
                            </Tr>
                          );
                        })}
                      </Tbody>
                    </Table>
                  </TableContainer>
                )}
              </Stack>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
