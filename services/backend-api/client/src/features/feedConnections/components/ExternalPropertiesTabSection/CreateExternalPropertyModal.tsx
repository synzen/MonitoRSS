import {
  Box,
  Button,
  Code,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Spinner,
  Stack,
  Table,
  TableContainer,
  Tag,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  chakra,
  useDisclosure,
} from "@chakra-ui/react";
import { cloneElement, useEffect, useState } from "react";
import { RepeatIcon, StarIcon } from "@chakra-ui/icons";
import { SelectArticlePropertyType, useUserFeedArticles } from "../../../feed";
import { useUserFeedContext } from "../../../../contexts/UserFeedContext";
import { InlineErrorAlert } from "../../../../components";

interface Props {
  trigger: React.ReactElement;
  onSubmitted: (data: { sourceField: string }) => void;
}

const CreateExternalPropertyModal = ({ trigger, onSubmitted }: Props) => {
  const { userFeed, articleFormatOptions } = useUserFeedContext();
  const { isOpen, onClose, onOpen } = useDisclosure();
  const [selected, setSelected] = useState("");
  const {
    data: articlesData,
    error,
    refetch,
    fetchStatus,
    status,
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
    disabled: !isOpen,
  });

  // @ts-ignore
  const linkExists = !!articlesData?.result.articles[0]?.link;

  const article = articlesData?.result.articles[0];
  const articleObjectEntries = Object.entries(article ?? {});

  const onClickRandomize = async () => {
    if (fetchStatus === "fetching") {
      return;
    }

    await refetch();
  };

  useEffect(() => {
    if (!isOpen) {
      setSelected("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && linkExists && !selected) {
      // setSelected("link");
    }
  }, [linkExists, selected, isOpen]);

  return (
    <>
      {cloneElement(trigger, { onClick: onOpen })}
      <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create a new external property</ModalHeader>
          <ModalCloseButton />
          <ModalBody tabIndex={-1}>
            <Box srOnly aria-live="polite" aria-busy={status === "loading"}>
              {status === "success" && (
                <span>Finished loading ${articleObjectEntries.length} article properties</span>
              )}
            </Box>
            <Stack spacing={4} paddingBottom={4}>
              {error && (
                <InlineErrorAlert
                  title="Failed to get article properties"
                  description={error.message}
                />
              )}
              {status === "loading" && (
                <Stack alignItems="center" width="100%" aria-busy>
                  <Spinner />
                  <Text>Loading article properties...</Text>
                </Stack>
              )}
              {status === "success" && !error && (
                <Stack spacing={4}>
                  <Text>
                    Select the source property containing the URL that references the page with the
                    desired content. If you don&apos;t see a property that fits, you can randomize
                    the article to get a new sample by clicking the randomize button. The
                    recommended source property is the link property.
                  </Text>
                  <Box>
                    <Button
                      isLoading={fetchStatus === "fetching"}
                      aria-disabled={fetchStatus === "fetching"}
                      onClick={onClickRandomize}
                      leftIcon={<RepeatIcon />}
                    >
                      <span>Randomize sample article</span>
                    </Button>
                  </Box>
                  <Box bg="gray.800" p={2} rounded="lg" overflow="auto">
                    <chakra.fieldset>
                      <chakra.legend srOnly>Source Property</chakra.legend>
                      <RadioGroup onChange={setSelected} value={selected}>
                        <TableContainer role="presentation">
                          <Table size="sm">
                            <Thead>
                              <Tr>
                                <Th>Article Property</Th>
                                <Th>Sample Article Value</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {articleObjectEntries.map(([field, value]) => {
                                if (field === "id" || field === "idHash" || !value) {
                                  return null;
                                }

                                return (
                                  <Tr key={field}>
                                    <Td>
                                      <Radio
                                        value={field}
                                        id={`field-${field}`}
                                        aria-labelledby={`field-${field}-label`}
                                        mr={2}
                                      />
                                      <chakra.label
                                        htmlFor={`field-${field}`}
                                        id={`field-${field}-label`}
                                      >
                                        <Code>{field}</Code>
                                        {field === "link" && (
                                          <Tag ml={3} colorScheme="green" size="sm">
                                            <StarIcon mr={1} aria-hidden />
                                            Recommended source property
                                          </Tag>
                                        )}
                                      </chakra.label>
                                    </Td>
                                    <Td whiteSpace="normal" wordBreak="break-all">
                                      {value}
                                    </Td>
                                  </Tr>
                                );
                              })}
                            </Tbody>
                          </Table>
                        </TableContainer>
                      </RadioGroup>
                    </chakra.fieldset>
                  </Box>
                </Stack>
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
                aria-disabled={!selected}
                onClick={() => {
                  if (!selected) {
                    return;
                  }

                  onSubmitted({ sourceField: selected });
                  onClose();
                }}
              >
                Create
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default CreateExternalPropertyModal;
