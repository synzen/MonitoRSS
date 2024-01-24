import { Injectable } from "@nestjs/common";
import { Article } from "../shared";
import { InvalidExpressionException } from "./exceptions";
import {
  FilterExpressionReference,
  ExpressionType,
  LogicalExpression,
  LogicalExpressionOperator,
  RelationalExpression,
  RelationalExpressionLeft,
  RelationalExpressionOperator,
  RelationalExpressionRight,
} from "./types";
import vm from "node:vm";
import { validateLogicalExpression } from "./utils";
import { FiltersRegexEvalException } from "../shared/exceptions";

const REGEX_TIMEOUT_MS = 5000;

interface FilterResult {
  result: boolean;
  explainBlocked: Array<{
    message: string;
    referenceValue: string | null;
    filterInput: string;
  }>;
}

@Injectable()
export class ArticleFiltersService {
  getArticleFilterResults(
    expression: LogicalExpression,
    references: FilterExpressionReference
  ): { result: boolean } {
    const errors = this.getFilterExpressionErrors(expression as never);

    if (errors.length > 0) {
      throw new InvalidExpressionException(
        `Invalid filter expression: ${errors.join(",")}`
      );
    }

    return this.evaluateExpression(expression, references);
  }

  getFilterExpressionErrors(expression: Record<string, unknown>): string[] {
    return validateLogicalExpression(expression);
  }

  evaluateExpression(
    expression: LogicalExpression | RelationalExpression,
    references: FilterExpressionReference
  ): FilterResult {
    if (!expression) {
      return { result: true, explainBlocked: [] };
    }

    switch (expression.type) {
      case ExpressionType.Logical:
        return this.evaluateLogicalExpression(expression, references);
      case ExpressionType.Relational:
        return this.evaluateRelationalExpression(expression, references);
      default:
        throw new InvalidExpressionException(
          // @ts-ignore
          `Invalid expression type: ${expression.type}`
        );
    }
  }

  private evaluateLogicalExpression(
    expression: LogicalExpression,
    references: FilterExpressionReference
  ): FilterResult {
    const children = expression.children;

    switch (expression.op) {
      case LogicalExpressionOperator.And: {
        if (!children.length) {
          return { result: true, explainBlocked: [] };
        }

        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          const { result, explainBlocked } = this.evaluateExpression(
            child,
            references
          );

          if (!result) {
            return { result: false, explainBlocked };
          }
        }

        return { result: true, explainBlocked: [] };
      }

      case LogicalExpressionOperator.Or: {
        if (!children.length) {
          return { result: true, explainBlocked: [] };
        }

        const allExplainBlocked: FilterResult["explainBlocked"] = [];

        for (let i = 0; i < children.length; ++i) {
          const child = children[i];
          const { result, explainBlocked } = this.evaluateExpression(
            child,
            references
          );

          if (!result) {
            allExplainBlocked.push(...explainBlocked);
          }

          if (result) {
            return { result: true, explainBlocked: [] };
          }
        }

        return { result: false, explainBlocked: allExplainBlocked };
      }

      default:
        throw new InvalidExpressionException(
          `Unknown operator ${
            expression.op
          } in logical expression ${JSON.stringify(expression)}`
        );
    }
  }

  private evaluateRelationalExpression(
    expression: RelationalExpression,
    references: FilterExpressionReference
  ): FilterResult {
    const { left, right } = expression;
    const referenceObject = references[left.type];

    if (!referenceObject) {
      return {
        result: false,
        explainBlocked: [
          {
            message: "Reference value does not exist",
            referenceValue: null,
            filterInput: right.value,
          },
        ],
      };
    }

    const explainBlocked: FilterResult["explainBlocked"] = [];
    let valueToCompareAgainst = referenceObject.flattened[left.value];

    if (!Object.keys(referenceObject.flattened).includes(left.value)) {
      valueToCompareAgainst = "";
    }

    if (right.type === RelationalExpressionRight.String) {
      let val = false;

      switch (expression.op) {
        case RelationalExpressionOperator.Eq: {
          val = valueToCompareAgainst === right.value;

          if (!val) {
            explainBlocked.push({
              message: "Reference value does not match filter input",
              referenceValue: valueToCompareAgainst,
              filterInput: right.value,
            });
          }

          break;
        }

        case RelationalExpressionOperator.Contains: {
          val = valueToCompareAgainst
            .toLowerCase()
            .includes(right.value.toLowerCase());

          if (!val) {
            explainBlocked.push({
              message: "Reference value does not contain filter input",
              referenceValue: valueToCompareAgainst,
              filterInput: right.value,
            });
          }

          break;
        }

        case RelationalExpressionOperator.Matches: {
          val = this.testRegex(right.value, valueToCompareAgainst);

          if (!val) {
            explainBlocked.push({
              message: "Reference value does not match regex",
              referenceValue: valueToCompareAgainst,
              filterInput: right.value,
            });
          }

          break;
        }

        default: {
          throw new InvalidExpressionException(
            `Unknown right operator "${
              expression.op
            }" of string-type right operand in relational expression ${JSON.stringify(
              expression
            )}.`
          );
        }
      }

      if (expression.not) {
        return {
          result: !val,
          explainBlocked,
        };
      }

      return { result: val, explainBlocked };
    } else {
      throw new InvalidExpressionException(
        `Unknown right type ${
          right["type"]
        } in relational expression ${JSON.stringify(expression)}`
      );
    }
  }

  private testRegex(inputRegex: string, reference: string) {
    const context = {
      reference,
      inputRegex,
      matches: false,
    };

    const script = new vm.Script(`
      const regex = new RegExp(inputRegex, 'i');
      matches = regex.test(reference);
    `);

    try {
      script.runInNewContext(context, {
        timeout: REGEX_TIMEOUT_MS,
      });

      return context.matches;
    } catch (err) {
      throw new FiltersRegexEvalException(
        `Filter regex "${inputRegex}" evaluation on text "${reference}" errored: ` +
          `${(err as Error).message}`
      );
    }
  }

  buildReferences(data: { article: Article }): FilterExpressionReference {
    return {
      [RelationalExpressionLeft.Article]: data.article,
    } as const;
  }
}
