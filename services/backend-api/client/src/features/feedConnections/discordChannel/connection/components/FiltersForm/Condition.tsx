import { Box, Button, ButtonGroup, HStack, StackProps, Text, chakra } from "@chakra-ui/react";
import { Controller, FieldError, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FaTrash } from "react-icons/fa6";
import {
  RelationalExpressionLeftOperandType,
  RelationalExpressionOperator,
  RelationalExpressionRightOperandType,
} from "../../types";
// import { ArticlePropertySelect } from "./ArticlePropertySelect";
import { ConditionInput } from "./ConditionInput";
import { ArticlePropertySelect } from "../ArticlePropertySelect";
import { getNestedField } from "@/utils/getNestedField";
import { useUserFeedConnectionContext } from "@/features/feed";
import { useNavigableTreeItemContext } from "../../../messageBuilder/contexts/NavigableTreeItemContext";
import { getReadableLabelForRelationalOp } from "./utils/getReadableLabelForRelationalOp";
import { Field } from "@/components/ui/field";
import { NativeSelectRoot, NativeSelectField } from "@/components/ui/native-select";

const { Equals, Contains, Matches } = RelationalExpressionOperator;

interface Props {
  onDelete: () => void;
  prefix?: string;
  deletable?: boolean;
  containerProps?: StackProps;
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
                "features.feedConnections.components.filtersForm.placeholderSelectArticleProperty",
              )}
              isInvalid={!!error}
              ariaLabelledBy={`${prefix}-property-label`}
              inputId={`${prefix}-property-select`}
              tabIndex={isFocused ? 0 : -1}
            />
            {error?.type === "required" && (
              <chakra.span color="fg.error" fontSize="sm">
                {t("features.feedConnections.components.filtersForm.valueIsRequired")}
              </chakra.span>
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
      alignItems="center"
      {...containerProps}
      borderRadius="l3"
      outline={isFocused ? "2px solid var(--app-accent-focus-ring)" : undefined}
      bg={isFocused ? "blackAlpha.500" : undefined}
      _hover={{
        outline: "2px solid var(--app-accent-focus-ring) !important",
        background: "blackAlpha.500",
      }}
      overflow="auto"
      pt={2}
      px={2}
      pb={2}
    >
      <HStack gap={4} alignItems="center" flex={1}>
        {leftOperandElement}
        <Box width="min-content">
          <Controller
            name={`${prefix}not`}
            control={control}
            render={({ field }) => {
              return (
                <ButtonGroup attached variant="outline" aria-label="Relational Operator">
                  <Button
                    onClick={() => field.onChange(false)}
                    colorPalette={!field.value ? "brand" : undefined}
                    variant={!field.value ? "solid" : "outline"}
                    tabIndex={isFocused ? 0 : -1}
                  >
                    {t("features.feedConnections.components.filtersForm.relationalOpDoes")}
                  </Button>
                  <Button
                    onClick={() => field.onChange(true)}
                    colorPalette={field.value ? "brand" : undefined}
                    variant={field.value ? "solid" : "outline"}
                    tabIndex={isFocused ? 0 : -1}
                  >
                    {t("features.feedConnections.components.filtersForm.relationalOpDoesNot")}
                  </Button>
                </ButtonGroup>
              );
            }}
          />
        </Box>
        <Field required>
          <chakra.label srOnly id={`${prefix}op-label`} htmlFor={`${prefix}op-select`}>
            Expression operator
          </chakra.label>
          <Controller
            name={`${prefix}op`}
            control={control}
            render={({ field }) => {
              return (
                <NativeSelectRoot flexShrink={1} minWidth={150}>
                  <NativeSelectField
                    id={`${prefix}op-select`}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    aria-labelledby={`${prefix}op-label`}
                    tabIndex={isFocused ? 0 : -1}
                  >
                    <option value={Equals}>{getReadableLabelForRelationalOp(Equals)}</option>
                    <option value={Contains}>{getReadableLabelForRelationalOp(Contains)}</option>
                    <option value={Matches}>{getReadableLabelForRelationalOp(Matches)}</option>
                  </NativeSelectField>
                </NativeSelectRoot>
              );
            }}
          />
        </Field>
        <ConditionInput
          controllerName={`${prefix}right.value`}
          placeholder={t("features.feedConnections.components.filtersForm.placeholderArticleValue")}
        />
      </HStack>
      {deletable && (
        <Box>
          <Button
            variant="ghost"
            size="sm"
            colorPalette="red"
            onClick={onDelete}
            tabIndex={isFocused ? 0 : -1}
          >
            <HStack alignItems="center">
              <FaTrash />
              <Text>Delete Condition</Text>
            </HStack>
          </Button>
        </Box>
      )}
    </HStack>
  );
};
