import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  Box,
  BoxProps,
  Button,
  CloseButton,
  Flex,
  FormControl,
  FormErrorMessage,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Stack,
  Text,
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
  // console.log("🚀 ~ LogicalExpressionForm ~ errors:", errors);
  // console.log("🚀 ~ useEffect ~ childrenName:", childrenName);
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
        padding="4"
        borderRadius="md"
        width="100%"
        overflow="auto"
      >
        <Flex justifyContent="space-between">
          <Box width="100%">
            <Text display="inline" paddingRight={2}>
              When
            </Text>
            <AnyAllSelector value={operator} onChange={onAnyAllChange} />
            <Text display="inline" paddingLeft={2} paddingBottom={4}>
              of the conditions match:
            </Text>
          </Box>
          <CloseButton aria-label="Delete condition group" onClick={onDeleted} />
        </Flex>
        <Stack>
          {!!fields.length && (
            <Stack spacing={2} marginTop={4} width="100%">
              {(fields as Array<FilterExpression & { id: string }>)?.map((child, childIndex) => {
                if (child?.type === FilterExpressionType.Logical) {
                  return (
                    <LogicalExpressionForm
                      key={child.id}
                      onDeleted={() => onChildDeleted(childIndex)}
                      prefix={`${prefix}children.${childIndex}.`}
                    />
                  );
                }

                if (child?.type === FilterExpressionType.Relational) {
                  return (
                    <Condition
                      key={child.id}
                      onDelete={() => onChildDeleted(childIndex)}
                      prefix={`${prefix}children.${childIndex}.`}
                      deletable
                    />
                  );
                }

                return null;
              })}
            </Stack>
          )}
          <FormControl isInvalid={childrenError?.type === "required"}>
            <FormErrorMessage my={4}>At least one condition is required.</FormErrorMessage>
          </FormControl>
          <Box>
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
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
};
