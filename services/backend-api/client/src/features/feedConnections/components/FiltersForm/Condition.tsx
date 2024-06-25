import {
  Button,
  ButtonGroup,
  CloseButton,
  Flex,
  FormControl,
  FormErrorMessage,
  HStack,
  Select,
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

const { Equals, Contains, Matches } = RelationalExpressionOperator;

interface Props {
  onDelete: () => void;
  prefix?: string;
  deletable?: boolean;
}

export const Condition = ({ onDelete, prefix = "", deletable }: Props) => {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext();
  const { articleFormatOptions } = useUserFeedConnectionContext();

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
            <ArticlePropertySelect
              customPlaceholders={articleFormatOptions.customPlaceholders || []}
              value={field.value}
              onChange={field.onChange}
              placeholder={t(
                "features.feedConnections.components.filtersForm.placeholderSelectArticleProperty"
              )}
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
    <HStack width="100%" alignItems="flex-start">
      <HStack width="100%" spacing={8} alignItems="flex-start" overflow="auto" pb={2}>
        {leftOperandElement}
        <FormControl width="min-content">
          <Controller
            name={`${prefix}not`}
            control={control}
            render={({ field }) => {
              return (
                <ButtonGroup isAttached variant="outline">
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
        <FormControl>
          <Controller
            name={`${prefix}op`}
            control={control}
            render={({ field }) => {
              return (
                <Select flexShrink={1} minWidth={150} {...field}>
                  <option value={Equals}>
                    {t("features.feedConnections.components.filtersForm.relationalOpEquals")}
                  </option>
                  <option value={Contains}>
                    {t("features.feedConnections.components.filtersForm.relationalOpContains")}
                  </option>
                  <option value={Matches}>
                    {t("features.feedConnections.components.filtersForm.relationalOpMatches")}
                  </option>
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
