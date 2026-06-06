import { Heading, HStack, Icon, Link, Stack, Table, Text } from "@chakra-ui/react";
import { useState } from "react";
import { FaUpRightFromSquare } from "react-icons/fa6";
import dayjs from "dayjs";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { UserFeedRequest } from "../../../types";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  DialogCloseTrigger,
} from "@/components/ui/dialog";

interface Props {
  request: UserFeedRequest;
  trigger: React.ReactElement;
}

export const RequestDetails = ({ request, trigger }: Props) => {
  const [open, setOpen] = useState(false);

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
    <DialogRoot open={open} onOpenChange={(e) => setOpen(e.open)} size="xl">
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Details</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <Stack gap={8}>
            <Stack gap={4}>
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
                    color="text.link"
                  >
                    <HStack alignItems="center">
                      <Text wordBreak="break-all">{request.url}</Text>
                      <Icon as={FaUpRightFromSquare} />
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
              {!requestHeaders && <Text color="fg.muted">No request headers available.</Text>}
              {!!requestHeaders && (
                <Table.ScrollArea bg="bg.subtle" p={4} borderRadius="l3">
                  <Table.Root size="sm" variant="line">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Name</Table.ColumnHeader>
                        <Table.ColumnHeader>Value</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {requestHeaders.map(([key, val]) => {
                        return (
                          <Table.Row key={key}>
                            <Table.Cell>{key}</Table.Cell>
                            <Table.Cell overflow="auto">{val}</Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table.Root>
                </Table.ScrollArea>
              )}
            </Stack>
            <Stack gap={4}>
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
              {!responseHeaders && <Text color="fg.muted">No response headers available.</Text>}
              {!!responseHeaders && (
                <Table.ScrollArea bg="bg.subtle" p={4} borderRadius="l3">
                  <Table.Root size="sm" variant="line">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Name</Table.ColumnHeader>
                        <Table.ColumnHeader>Value</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {responseHeaders.map(([key, val]) => {
                        return (
                          <Table.Row key={key}>
                            <Table.Cell>{key}</Table.Cell>
                            <Table.Cell>{val}</Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table.Root>
                </Table.ScrollArea>
              )}
            </Stack>
          </Stack>
        </DialogBody>
        <DialogFooter>
          <PrimaryActionButton onClick={() => setOpen(false)}>Close</PrimaryActionButton>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
