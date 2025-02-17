import {
  BoxProps,
  Button,
  ButtonGroup,
  CloseButton,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Select,
  chakra,
} from "@chakra-ui/react";
import { Controller, FieldError, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  RelationalExpressionLeftOperandType,
  RelationalExpressionOperator,
  RelationalExpressionRightOperandType,
} from "../../types";
// import { ArticlePropertySelect } from "./ArticlePropertySelect";
import { ConditionInput } from "./ConditionInput";
import { ArticlePropertySelect } from "../ArticlePropertySelect";
import { getNestedField } from "../../../../utils/getNestedField";
import { useUserFeedConnectionContext } from "../../../../contexts/UserFeedConnectionContext";
import { useNavigableTreeItemContext } from "../../../../contexts/NavigableTreeItemContext";
import getChakraColor from "../../../../utils/getChakraColor";
import { getReadableLabelForRelationalOp } from "./utils/getReadableLabelForRelationalOp";

const { Equals, Contains, Matches } = RelationalExpressionOperator;

interface Props {
  onDelete: () => void;
  prefix?: string;
  deletable?: boolean;
  containerProps?: BoxProps;
}

export const Condition = ({ onDelete, prefix = "", deletable, containerProps }: Props) => {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext();
  const { articleFormatOptions } = useUserFeedConnectionContext();
  const { isFocused } = useNavigableTreeItemContext();

  const { t } = useTranslation();
  const leftOperandType = watch(`${prefix}left.type`) as
    | RelationalExpressionLeftOperandType
    | RelationalExpressionRightOperandType;

  let leftOperandElement: React.ReactElement = (
    <ConditionInput
      controllerName={`${prefix}left.value`}
      placeholder={t("features.feedConnections.components.filtersForm.placeholderArticleProperty")}
    />
  );

  if (leftOperandType === RelationalExpressionLeftOperandType.Article) {
    const controllerName = `${prefix}left.value`;
    const error = getNestedField<FieldError>(errors, controllerName);

    leftOperandElement = (
      <Controller
        name={controllerName}
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <>
            <chakra.label
              srOnly
              id={`${prefix}-property-label`}
              htmlFor={`${prefix}-property-select`}
            >
              Article Property to Filter On
            </chakra.label>
            <ArticlePropertySelect
              customPlaceholders={articleFormatOptions.customPlaceholders || []}
              value={field.value}
              onChange={field.onChange}
              isRequired
              placeholder={t(
                "features.feedConnections.components.filtersForm.placeholderSelectArticleProperty"
              )}
              isInvalid={!!error}
              ariaLabelledBy={`${prefix}-property-label`}
              inputId={`${prefix}-property-select`}
            />
            {error?.type === "required" && (
              <FormErrorMessage>
                {t("features.feedConnections.components.filtersForm.valueIsRequired")}
              </FormErrorMessage>
            )}
          </>
        )}
      />
    );
  }

  return (
    <HStack
      onKeyDown={(e) => e.stopPropagation()}
      width="100%"
      alignItems="flex-start"
      {...containerProps}
      borderRadius="md"
      outline={isFocused ? `2px solid ${getChakraColor("blue.300")}` : undefined}
      bg={isFocused ? "blackAlpha.500" : undefined}
      _hover={{
        outline: `2px solid ${getChakraColor("blue.100")} !important`,
        background: "blackAlpha.700",
      }}
      pt={2}
      px={2}
      pb={2}
    >
      <HStack width="100%" spacing={8} alignItems="flex-start" overflow="auto">
        {leftOperandElement}
        <FormControl width="min-content">
          <Controller
            name={`${prefix}not`}
            control={control}
            render={({ field }) => {
              return (
                <ButtonGroup isAttached variant="outline" aria-label="Relational Operator">
                  <Button
                    onClick={() => field.onChange(false)}
                    colorScheme={!field.value ? "blue" : undefined}
                    variant={!field.value ? "solid" : "outline"}
                  >
                    {t("features.feedConnections.components.filtersForm.relationalOpDoes")}
                  </Button>
                  <Button
                    onClick={() => field.onChange(true)}
                    colorScheme={field.value ? "blue" : undefined}
                    variant={field.value ? "solid" : "outline"}
                  >
                    {t("features.feedConnections.components.filtersForm.relationalOpDoesNot")}
                  </Button>
                </ButtonGroup>
              );
            }}
          />
        </FormControl>
        <FormControl isRequired>
          <FormLabel id={`${prefix}op-label`} srOnly>
            Relational Operator
          </FormLabel>
          <Controller
            name={`${prefix}op`}
            control={control}
            render={({ field }) => {
              return (
                <Select
                  flexShrink={1}
                  minWidth={150}
                  bg="gray.800"
                  {...field}
                  aria-labelledby={`${prefix}op-label`}
                  ref={null}
                >
                  <option value={Equals}>{getReadableLabelForRelationalOp(Equals)}</option>
                  <option value={Contains}>{getReadableLabelForRelationalOp(Contains)}</option>
                  <option value={Matches}>{getReadableLabelForRelationalOp(Matches)}</option>
                </Select>
              );
            }}
          />
        </FormControl>
        <ConditionInput
          controllerName={`${prefix}right.value`}
          placeholder={t("features.feedConnections.components.filtersForm.placeholderArticleValue")}
        />
      </HStack>
      {deletable && (
        <Flex>
          <CloseButton aria-label="Delete condition" size="sm" onClick={onDelete} />
        </Flex>
      )}
    </HStack>
  );
};
