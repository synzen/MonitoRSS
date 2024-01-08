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

@Injectable()
export class ArticleFiltersService {
  getArticleFilterResults(
    expression: LogicalExpression,
    references: FilterExpressionReference
  ) {
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
  ): boolean {
    if (!expression) {
      return true;
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
  ): boolean {
    const children = expression.children;

    switch (expression.op) {
      case LogicalExpressionOperator.And: {
        if (!children.length) {
          return true;
        }

        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          const result = this.evaluateExpression(child, references);

          if (!result) {
            return false;
          }
        }

        return true;
      }

      case LogicalExpressionOperator.Or: {
        if (!children.length) {
          return true;
        }

        for (let i = 0; i < children.length; ++i) {
          const child = children[i];
          const result = this.evaluateExpression(child, references);

          if (result) {
            return true;
          }
        }

        return false;
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
  ): boolean {
    const { left, right } = expression;
    const referenceObject = references[left.type];

    if (!referenceObject) {
      return false;
    }

    let valueToCompareAgainst = references.ARTICLE.flattened[left.value];

    if (!Object.keys(references.ARTICLE.flattened).includes(left.value)) {
      valueToCompareAgainst = "";
    }

    if (right.type === RelationalExpressionRight.String) {
      let val = false;

      switch (expression.op) {
        case RelationalExpressionOperator.Eq: {
          val = valueToCompareAgainst === right.value;

          break;
        }

        case RelationalExpressionOperator.Contains: {
          val = valueToCompareAgainst
            .toLowerCase()
            .includes(right.value.toLowerCase());

          break;
        }

        case RelationalExpressionOperator.Matches: {
          val = this.testRegex(right.value, valueToCompareAgainst);

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
        return !val;
      }

      return val;
    } else {
      throw new InvalidExpressionException(
        `Unknown right type ${
          right["type"]
        } in relational expression ${JSON.stringify(expression)}`
      );
    }
  }

  private testRegex(inputRegex: string, reference: string) {
    const contex = {
      reference,
      inputRegex,
      matches: false,
    };

    const script = new vm.Script(`
      const regex = new RegExp(inputRegex, 'i');
      matches = regex.test(reference);
    `);

    try {
      script.runInNewContext(contex, {
        timeout: REGEX_TIMEOUT_MS,
      });

      return contex.matches;
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
