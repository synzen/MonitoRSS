import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Controller, useFormContext } from "react-hook-form";
import { AddIcon } from "@chakra-ui/icons";
import { motion } from "framer-motion";
import { v4 } from "uuid";
import { useRef } from "react";
import { DiscordMessageFormData } from "@/types/discord";
import { DiscordComponentButtonStyle, DiscordComponentType } from "../../../../types";
import { AnimatedComponent } from "../../../../components";

const caclulateRowAfterDeleteRow = (
  rows: DiscordMessageFormData["componentRows"],
  index: number
) => {
  const newRows = [...(rows || [])];
  newRows.splice(index, 1);

  return newRows;
};

const calculateRowsAfterDeleteComponent = (
  rows: DiscordMessageFormData["componentRows"],
  rowIndex: number,
  componentIndex: number
) => {
  const newRows = [...(rows || [])];
  const newComponents = [...newRows[rowIndex].components];
  newComponents.splice(componentIndex, 1);
  const newRow = {
    ...newRows[rowIndex],
    components: newComponents,
  };
  newRows[rowIndex] = newRow;

  return newRows;
};

const calculateRowsAfterAddRow = (rows: DiscordMessageFormData["componentRows"]) => {
  const newRows = [...(rows || [])];
  newRows.push({
    id: v4(),
    components: [
      {
        id: v4(),
        type: DiscordComponentType.Button,
        style: DiscordComponentButtonStyle.Link,
        label: "",
        url: "",
      },
    ],
  });

  return newRows;
};

const calculateRowsAfterAddComponent = (
  rows: DiscordMessageFormData["componentRows"],
  rowIndex: number
) => {
  const newRows = [...(rows || [])];
  const newComponents = [...newRows[rowIndex].components];
  newComponents.push({
    id: v4(),
    type: DiscordComponentType.Button,
    style: DiscordComponentButtonStyle.Link,
    label: "",
    url: "",
  });
  newRows[rowIndex].components = newComponents;

  return newRows;
};

const DiscordMessageComponentRow = ({
  rows,
  rowIndex,
}: {
  rows: DiscordMessageFormData["componentRows"];
  rowIndex: number;
}) => {
  const {
    control,
    setValue,
    formState: { errors },
    clearErrors,
  } = useFormContext<DiscordMessageFormData>();
  const row = rows?.[rowIndex];
  const components = row?.components;
  const scrollContainer = useRef<HTMLDivElement>(null);

  return (
    <Stack border="solid 1px" borderColor="gray.700" p={4} rounded="md" bg="gray.900">
      <HStack justifyContent="space-between" flexWrap="wrap">
        <Badge bg="none" p={0}>
          Row {rowIndex + 1}
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          colorScheme="red"
          onClick={() => {
            const newRows = caclulateRowAfterDeleteRow(rows, rowIndex);

            clearErrors(`componentRows.${rowIndex}`);

            setValue("componentRows", newRows, {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            });
          }}
        >
          Delete
        </Button>
      </HStack>
      <Divider />
      <Flex overflow="auto" ref={scrollContainer}>
        <AnimatedComponent>
          {components
            ?.filter(
              (c) =>
                c.type === DiscordComponentType.Button &&
                c.style === DiscordComponentButtonStyle.Link
            )
            ?.map((c, componentIndex) => {
              return (
                <HStack
                  as={motion.div}
                  key={c.id}
                  alignItems="center"
                  overflow="hidden"
                  minW={400}
                  maxW={400}
                  width="100%"
                  mb={2}
                  rounded="md"
                  mr={2}
                  exit={{
                    opacity: 0,
                    minWidth: 0,
                    width: 0,
                    marginRight: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  transition={{
                    type: "linear",
                  }}
                >
                  <Stack
                    flex={1}
                    px={6}
                    py={4}
                    border="solid 1px"
                    borderColor="gray.800"
                    bg="gray.700"
                    rounded="md"
                  >
                    <HStack justifyContent="space-between">
                      <Badge fontSize={11} bg="none" color="whiteAlpha.700" p={0}>
                        Button {componentIndex + 1}
                      </Badge>
                      <Button
                        variant="ghost"
                        colorScheme="red"
                        size="xs"
                        onClick={() => {
                          const newRows = calculateRowsAfterDeleteComponent(
                            rows,
                            rowIndex,
                            componentIndex
                          );

                          clearErrors(`componentRows.${rowIndex}.components.${componentIndex}`);

                          if (newRows[rowIndex].components.length === 0) {
                            newRows.splice(rowIndex, 1);

                            clearErrors(`componentRows.${rowIndex}`);
                          }

                          setValue(`componentRows`, newRows, {
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true,
                          });
                        }}
                      >
                        Delete
                      </Button>
                    </HStack>
                    <Divider />
                    <Controller
                      control={control}
                      name={`componentRows.${rowIndex}.components.${componentIndex}.label`}
                      render={({ field }) => {
                        const error =
                          errors.componentRows?.[rowIndex]?.components?.[componentIndex]?.label
                            ?.message;

                        return (
                          <FormControl isInvalid={!!error}>
                            <FormLabel fontSize={12}>Label</FormLabel>
                            <Input
                              autoCapitalize="false"
                              autoComplete="false"
                              autoCorrect="false"
                              bg="blackAlpha.300"
                              size="sm"
                              {...field}
                              value={field.value || ""}
                            />
                            {!error && (
                              <FormHelperText
                                fontSize={11}
                                as={motion.div}
                                exit={{ whiteSpace: "nowrap" }}
                              >
                                The text that will be displayed on the button.
                              </FormHelperText>
                            )}
                            {error && (
                              <FormErrorMessage
                                as={motion.div}
                                exit={{ whiteSpace: "nowrap" }}
                                fontSize={11}
                              >
                                {error}
                              </FormErrorMessage>
                            )}
                          </FormControl>
                        );
                      }}
                    />
                    <Controller
                      control={control}
                      name={`componentRows.${rowIndex}.components.${componentIndex}.url`}
                      render={({ field }) => {
                        const error =
                          errors.componentRows?.[rowIndex]?.components?.[componentIndex]?.url
                            ?.message;

                        return (
                          <FormControl isInvalid={!!error}>
                            <FormLabel fontSize={12}>URL</FormLabel>
                            <Input
                              autoCapitalize="false"
                              autoComplete="false"
                              autoCorrect="false"
                              bg="blackAlpha.300"
                              size="sm"
                              {...field}
                              value={field.value || ""}
                            />
                            {!error && (
                              <FormHelperText
                                as={motion.div}
                                exit={{ whiteSpace: "nowrap" }}
                                fontSize={11}
                              >
                                The external URL that the button will link to.
                              </FormHelperText>
                            )}
                            {error && (
                              <FormErrorMessage
                                as={motion.div}
                                exit={{ whiteSpace: "nowrap" }}
                                fontSize={11}
                              >
                                {error}
                              </FormErrorMessage>
                            )}
                          </FormControl>
                        );
                      }}
                    />
                  </Stack>
                </HStack>
              );
            })}
          <Flex alignItems="center">
            <Button
              leftIcon={<AddIcon fontSize={12} />}
              aria-label="Add button"
              size="sm"
              onClick={() => {
                const newRows = calculateRowsAfterAddComponent(rows, rowIndex);

                setValue(`componentRows.${rowIndex}.components`, newRows[rowIndex].components, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                });

                setTimeout(() => {
                  scrollContainer.current?.scrollTo({
                    left: scrollContainer.current?.scrollWidth,
                    behavior: "smooth",
                  });
                }, 100);
              }}
            >
              Add button
            </Button>
          </Flex>
        </AnimatedComponent>
      </Flex>
    </Stack>
  );
};

export const DiscordMessageComponentsForm = () => {
  const { watch, setValue } = useFormContext<DiscordMessageFormData>();
  const [rows] = watch(["componentRows"]);

  return (
    <Stack spacing={4}>
      <Text>
        Add buttons that contain links. You may add up to 5 rows, with up to 5 buttons in each row.
        Placeholders may be used.
      </Text>
      <Stack spacing={4}>
        {rows?.map((row, rowIndex) => {
          return <DiscordMessageComponentRow key={row.id} rows={rows} rowIndex={rowIndex} />;
        })}
        <Box>
          <Button
            leftIcon={<AddIcon fontSize={12} />}
            variant="ghost"
            isDisabled={rows ? rows.length >= 5 : false}
            onClick={() => {
              const newRows = calculateRowsAfterAddRow(rows);

              setValue("componentRows", newRows, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              });
            }}
          >
            Add row
          </Button>
        </Box>
      </Stack>
    </Stack>
  );
};
