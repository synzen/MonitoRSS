import { ChevronDownIcon, ChevronUpIcon, DeleteIcon } from "@chakra-ui/icons";
import {
  Box,
  BoxProps,
  Button,
  CloseButton,
  Divider,
  Flex,
  FormControl,
  FormErrorMessage,
  HStack,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { FieldError, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import {
  FilterExpression,
  FilterExpressionType,
  LogicalExpressionOperator,
  LogicalFilterExpression,
  RelationalExpressionLeftOperandType,
  RelationalExpressionOperator,
  RelationalExpressionRightOperandType,
  RelationalFilterExpression,
} from "../../types";
import { AnyAllSelector } from "./AnyAllSelector";
import { Condition } from "./Condition";
import { getNestedField } from "../../../../utils/getNestedField";
import {
  NavigableTreeItem,
  NavigableTreeItemExpandButton,
  NavigableTreeItemGroup,
} from "../../../../components/NavigableTree";
import { useNavigableTreeItemContext } from "../../../../contexts/NavigableTreeItemContext";
import getChakraColor from "../../../../utils/getChakraColor";
import { getAriaLabelForExpressionGroup } from "./utils/getAriaLabelForExpressionGroup";
import { getAriaLabelForExpression } from "./utils/getAriaLableForExpression";

interface Props {
  onDeleted: () => void;
  prefix?: string;
  containerProps?: BoxProps;
}

export const LogicalExpressionForm = ({ onDeleted, prefix = "", containerProps }: Props) => {
  const {
    control,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useFormContext();
  const childrenName = `${prefix}children`;
  const childrenError = getNestedField<FieldError>(errors, childrenName);
  const { fields, append, remove, insert } = useFieldArray({
    control,
    name: childrenName,
  });
  const operator: LogicalExpressionOperator = useWatch({
    control,
    name: `${prefix}op`,
  });
  const { isExpanded, isFocused } = useNavigableTreeItemContext();

  useEffect(() => {
    if (fields.length === 0) {
      setError(childrenName, {
        type: "required",
      });
    } else if (childrenError?.type === "required") {
      clearErrors(childrenName);
    }
  }, [fields.length, childrenError?.type]);

  const { t } = useTranslation();

  const onAnyAllChange = (value: LogicalFilterExpression["op"]) => {
    setValue(`${prefix}op`, value, {
      shouldDirty: true,
    });
  };

  const onChildDeleted = (index: number) => {
    remove(index);
  };

  const onAddRelational = () => {
    let indexOfLastRelational = 0;

    const typedFields = fields as Array<
      FilterExpression & {
        id: string;
      }
    >;

    for (let i = typedFields.length - 1; i >= 0; i -= 1) {
      if (typedFields[i]?.type === FilterExpressionType.Relational) {
        indexOfLastRelational = i;
        break;
      }
    }

    const toInsert: RelationalFilterExpression = {
      type: FilterExpressionType.Relational,
      op: RelationalExpressionOperator.Equals,
      left: {
        type: RelationalExpressionLeftOperandType.Article,
        value: "",
      },
      right: {
        type: RelationalExpressionRightOperandType.String,
        value: "",
      },
    };

    insert(indexOfLastRelational + 1, toInsert);
  };

  const onAddLogical = () => {
    const toInsert: LogicalFilterExpression = {
      type: FilterExpressionType.Logical,
      op: LogicalExpressionOperator.And,
      children: [
        {
          type: FilterExpressionType.Relational,
          op: RelationalExpressionOperator.Equals,
          left: {
            type: RelationalExpressionLeftOperandType.Article,
            value: "",
          },
          right: {
            type: RelationalExpressionRightOperandType.String,
            value: "",
          },
        },
      ],
    };

    append(toInsert);
  };

  return (
    <Stack {...containerProps}>
      <Box
        border="solid"
        borderWidth="1px"
        borderColor="gray.600"
        // padding="4"
        borderRadius="md"
        width="100%"
        // overflow="auto"
        bg={isFocused ? "blackAlpha.500" : undefined}
        outlineOffset={4}
        outline={isFocused ? `2px solid ${getChakraColor("whiteAlpha.600")}` : undefined}
        _hover={{
          outline: `2px solid ${getChakraColor("whiteAlpha.800")} !important`,
          background: "blackAlpha.700",
        }}
      >
        <NavigableTreeItemExpandButton>
          {({ onClick, isFocused, isExpanded }) => {
            return (
              <chakra.button
                tabIndex={-1}
                type="button"
                p={4}
                textAlign={"left"}
                onClick={onClick}
                width="100%"
                borderRadius={"md"}
              >
                <HStack>
                  {isExpanded ? (
                    <ChevronUpIcon fontSize="lg" />
                  ) : (
                    <ChevronDownIcon fontSize={"lg"} />
                  )}
                  <Text>Condition Group</Text>
                </HStack>
              </chakra.button>
            );
          }}
        </NavigableTreeItemExpandButton>
        <Divider />
        {isExpanded && (
          <Flex justifyContent="space-between" px={4} pt={4}>
            <Box width="100%" flex={1}>
              <Text display="inline" paddingRight={2}>
                When
              </Text>
              <AnyAllSelector value={operator} onChange={onAnyAllChange} />
              <Text display="inline" paddingLeft={2} paddingBottom={4}>
                of the conditions match:
              </Text>
            </Box>
          </Flex>
        )}
        {isExpanded && (
          <Stack px={2} pt={4}>
            {!!fields.length && (
              <NavigableTreeItemGroup display="flex" gap={2} flexDirection={"column"} width="100%">
                {(fields as Array<FilterExpression & { id: string }>)?.map((child, childIndex) => {
                  const childPrefix = `${prefix}children.${childIndex}.`;

                  if (child?.type === FilterExpressionType.Logical) {
                    return (
                      <NavigableTreeItem
                        key={child.id}
                        id={childPrefix}
                        ariaLabel={getAriaLabelForExpressionGroup(child.op)}
                      >
                        <LogicalExpressionForm
                          key={child.id}
                          onDeleted={() => onChildDeleted(childIndex)}
                          prefix={childPrefix}
                          containerProps={{
                            px: 2,
                          }}
                        />
                      </NavigableTreeItem>
                    );
                  }

                  if (child?.type === FilterExpressionType.Relational) {
                    return (
                      <NavigableTreeItem
                        key={childPrefix}
                        id={childPrefix}
                        ariaLabel={getAriaLabelForExpression(child)}
                      >
                        <Condition
                          key={child.id}
                          onDelete={() => onChildDeleted(childIndex)}
                          prefix={childPrefix}
                          deletable
                        />
                      </NavigableTreeItem>
                    );
                  }

                  return null;
                })}
              </NavigableTreeItemGroup>
            )}
            <FormControl isInvalid={childrenError?.type === "required"}>
              <FormErrorMessage my={4}>At least one condition is required.</FormErrorMessage>
            </FormControl>
            <HStack justifyContent="space-between" pb={2}>
              <Menu>
                <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
                  {t("features.feedConnections.components.filtersForm.addButtonText")}
                </MenuButton>
                <MenuList>
                  <MenuItem onClick={onAddRelational}>
                    {t("features.feedConnections.components.filtersForm.addRelationalButtonText")}
                  </MenuItem>
                  <MenuItem onClick={onAddLogical}>
                    {t("features.feedConnections.components.filtersForm.addLogicalButtonText")}
                  </MenuItem>
                </MenuList>
              </Menu>

              <Button
                onClick={onDeleted}
                leftIcon={<DeleteIcon />}
                size="sm"
                variant="ghost"
                colorScheme="red"
                // w="100%"
              >
                Delete condition group
              </Button>
            </HStack>
          </Stack>
        )}
      </Box>
    </Stack>
  );
};
