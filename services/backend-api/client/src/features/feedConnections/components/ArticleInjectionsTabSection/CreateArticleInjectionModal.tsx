import {
  Button,
  Code,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  chakra,
  useDisclosure,
} from "@chakra-ui/react";
import { cloneElement, useState } from "react";

const articleUrlFields = [
  {
    field: "url",
    value: "https://example.com/article/1",
  },
  {
    field: "image",
    value: "https://example.com/article/1/image.jpg",
  },
];

interface Props {
  trigger: React.ReactElement;
  onSubmitted: (data: { sourceField: string }) => void;
}

const CreateArticleInjectionModal = ({ trigger, onSubmitted }: Props) => {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const [selected, setSelected] = useState("");

  return (
    <>
      {cloneElement(trigger, { onClick: onOpen })}
      <Modal isOpen={isOpen} onClose={onClose} size="3xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create a new placeholder</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Text>
                Select the field from the article that you want to create a placeholder for.
              </Text>
              <RadioGroup onChange={setSelected} value={selected}>
                <TableContainer overflow="auto">
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th />
                        <Th>Article Field</Th>
                        <Th>Value</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {articleUrlFields.map((f) => {
                        return (
                          <Tr>
                            <Td width="min-content">
                              <Radio value={f.field} id={`field-${f.field}`} name="field" />
                            </Td>
                            <Td>
                              <chakra.label htmlFor={`field-${f.field}`}>
                                <Code>{f.field}</Code>
                              </chakra.label>
                            </Td>
                            <Td>{f.value}</Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </TableContainer>
              </RadioGroup>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button
              colorScheme="blue"
              isDisabled={!selected}
              onClick={() => {
                onSubmitted({ sourceField: selected });
                onClose();
              }}
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default CreateArticleInjectionModal;
