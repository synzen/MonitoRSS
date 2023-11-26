import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  Box,
  BoxProps,
  Button,
  CloseButton,
  Flex,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
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
import { GetUserFeedArticlesInput } from "../../../feed/api";

interface Props {
  onDeleted: () => void;
  prefix?: string;
  data: {
    feedId?: string;
  };
  containerProps?: BoxProps;
  articleFormatter: GetUserFeedArticlesInput["data"]["formatter"];
}

export const LogicalExpressionForm = ({
  onDeleted,
  prefix = "",
  data,
  containerProps,
  articleFormatter,
}: Props) => {
  const { control, setValue } = useFormContext();
  const { fields, append, remove, insert } = useFieldArray({
    control,
    name: `${prefix}children`,
  });
  const operator: LogicalExpressionOperator = useWatch({
    control,
    name: `${prefix}op`,
  });

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

  const numberOfRelational =
    (
      fields as Array<
        FilterExpression & {
          id: string;
        }
      >
    )?.filter((child) => child?.type === FilterExpressionType.Relational).length || 0;

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
          <Stack spacing={2} marginTop={4} width="100%">
            {(fields as Array<FilterExpression & { id: string }>)?.map((child, childIndex) => {
              if (child?.type === FilterExpressionType.Logical) {
                return (
                  <LogicalExpressionForm
                    key={child.id}
                    onDeleted={() => onChildDeleted(childIndex)}
                    prefix={`${prefix}children.${childIndex}.`}
                    data={data}
                    articleFormatter={articleFormatter}
                  />
                );
              }

              if (child?.type === FilterExpressionType.Relational) {
                return (
                  <Condition
                    key={child.id}
                    data={data}
                    onDelete={() => onChildDeleted(childIndex)}
                    prefix={`${prefix}children.${childIndex}.`}
                    deletable={numberOfRelational > 1}
                    articleFormatter={articleFormatter}
                  />
                );
              }

              return null;
            })}
          </Stack>
          <Box>
            <Menu>
              <MenuButton as={Button} rightIcon={<ChevronDownIcon />} variant="ghost">
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
