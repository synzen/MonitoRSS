import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Stack,
  Textarea,
  useDisclosure,
} from "@chakra-ui/react";
import * as Sentry from "@sentry/react";
import { cloneElement, useEffect, useState } from "react";
import { useUserMe } from "../../features/discordUser";
import { notifySuccess } from "../../utils/notifySuccess";

interface Props {
  trigger: React.ReactElement;
}

export const ReportABugDialog = ({ trigger }: Props) => {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { data } = useUserMe({
    enabled: isOpen,
  });
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (isOpen && !email && !!data?.result.email) {
      setEmail(data.result.email);
    }
  }, [email, !!data?.result.email, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setEmail("");
      setDescription("");
    }
  }, [isOpen]);

  const onSubmit = () => {
    if (!description || !data || !email) {
      return;
    }

    const eventId = Sentry.captureMessage("User Feedback");

    Sentry.captureUserFeedback({
      event_id: eventId,
      name: email,
      email,
      comments: description,
    });

    onClose();
    notifySuccess("Your bug report has been submitted. Thank you!");
  };

  return (
    <>
      {cloneElement(trigger, { onClick: onOpen })}
      <Modal isOpen={isOpen} onClose={onClose} size="xl" closeOnOverlayClick={false}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Report a Bug</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {!data && <Spinner />}
            {data && (
              <Stack>
                {!data.result.email && (
                  <FormControl isRequired>
                    <FormLabel>Email</FormLabel>
                    <Input
                      bg="gray.800"
                      placeholder="your.email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                    />
                  </FormControl>
                )}
                <FormControl isRequired>
                  <FormLabel>Description</FormLabel>
                  <Textarea
                    value={description}
                    placeholder="What's the bug? What were you doing, and what did you expect?"
                    onChange={(e) => setDescription(e.target.value)}
                    bg="gray.800"
                    rows={10}
                  />
                  <FormHelperText>
                    Please be as descriptive as possible (including steps to reproduce if relevant).
                  </FormHelperText>
                </FormControl>
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="red" isDisabled={!description || !email} onClick={onSubmit}>
                Send Bug Report
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
