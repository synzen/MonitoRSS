import {
  Box,
  Button,
  Code,
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
  Radio,
  RadioGroup,
  Skeleton,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  chakra,
  useDisclosure,
} from "@chakra-ui/react";
import { cloneElement, useEffect, useState } from "react";
import { ExternalLinkIcon, RepeatIcon } from "@chakra-ui/icons";
import { SelectArticlePropertyType, useUserFeedArticles } from "../../../feed";
import { useUserFeedContext } from "../../../../contexts/UserFeedContext";
import { InlineErrorAlert } from "../../../../components";

interface Props {
  defaultValue: string;
  trigger: React.ReactElement;
  onSubmitted: (data: { sourceField: string }) => void;
}

const UpdateExternalPropertyModal = ({ trigger, onSubmitted, defaultValue }: Props) => {
  const { userFeed, articleFormatOptions } = useUserFeedContext();
  const { isOpen, onClose, onOpen } = useDisclosure();
  const [selected, setSelected] = useState("");
  const {
    data: articlesData,
    error,
    refetch,
    fetchStatus,
  } = useUserFeedArticles({
    feedId: userFeed.id,
    data: {
      selectPropertyTypes: [SelectArticlePropertyType.Url],
      selectProperties: ["*"],
      limit: 1,
      skip: 0,
      random: true,
      formatOptions: articleFormatOptions,
    },
  });

  const article = articlesData?.result.articles[0];
  const articleObjectEntries = Object.entries(article ?? {});

  const onClickRandomize = async () => {
    await refetch();
  };

  useEffect(() => {
    if (!isOpen) {
      setSelected("");
    }
  }, [isOpen]);

  return (
    <>
      {cloneElement(trigger, { onClick: onOpen })}
      <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Update source property</ModalHeader>
          <ModalCloseButton />
          <ModalBody tabIndex={-1}>
            <Stack spacing={4} paddingBottom={4}>
              <Text>
                Select the source property that contains the URL that references the page with the
                desired content.
              </Text>
              {error && (
                <InlineErrorAlert
                  title="Failed to get article properties"
                  description={error.message}
                />
              )}
              {!error && (
                <Box bg="gray.800" p={2} rounded="lg">
                  <RadioGroup onChange={setSelected} value={selected || defaultValue}>
                    <TableContainer overflow="auto">
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th />
                            <Th>Article Property</Th>
                            <Th>
                              <span>Sample Article Value</span>
                              <Tooltip label="See another random article's values">
                                <Button
                                  size="xs"
                                  ml={2}
                                  isLoading={fetchStatus === "fetching"}
                                  onClick={onClickRandomize}
                                  variant="outline"
                                  leftIcon={<RepeatIcon />}
                                  aria-label="See another random article's values"
                                >
                                  <span>Randomize sample article</span>
                                </Button>
                              </Tooltip>
                            </Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {articleObjectEntries.map(([field, value]) => {
                            if (field === "id" || field === "idHash" || !value) {
                              return null;
                            }

                            return (
                              <Tr key={field}>
                                <Td width="min-content">
                                  <Radio
                                    value={field}
                                    id={`field-${field}`}
                                    name="field"
                                    isDisabled={fetchStatus !== "idle"}
                                  />
                                </Td>
                                <Td>
                                  <Skeleton isLoaded={fetchStatus === "idle"}>
                                    <chakra.label htmlFor={`field-${field}`}>
                                      <Code>{field}</Code>
                                    </chakra.label>
                                  </Skeleton>
                                </Td>
                                <Td whiteSpace="nowrap">
                                  <Skeleton isLoaded={fetchStatus === "idle"}>
                                    <Flex
                                      as={chakra.label}
                                      alignItems="center"
                                      htmlFor={`field-${field}`}
                                      gap={2}
                                    >
                                      {value}
                                      <Link
                                        color="blue.300"
                                        href={value}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <ExternalLinkIcon />
                                      </Link>
                                    </Flex>
                                  </Skeleton>
                                </Td>
                              </Tr>
                            );
                          })}
                        </Tbody>
                      </Table>
                    </TableContainer>
                  </RadioGroup>
                </Box>
              )}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button onClick={onClose} variant="ghost">
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                isDisabled={!selected}
                onClick={() => {
                  onSubmitted({ sourceField: selected });
                  onClose();
                }}
              >
                Update
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default UpdateExternalPropertyModal;
