import { Injectable } from "@nestjs/common";
import { getNestedPrimitiveValue } from "../articles/utils/get-nested-primitive-value";
import { Article } from "../shared";
import { InvalidExpressionException, RegexEvalException } from "./exceptions";
import {
  ArticleExpressionReference,
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

const REGEX_TIMEOUT_MS = 5000;

@Injectable()
export class ArticleFiltersService {
  async getArticleFilterResults(
    expression: LogicalExpression,
    references: ArticleExpressionReference
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

  async evaluateExpression(
    expression: LogicalExpression | RelationalExpression,
    references: ArticleExpressionReference
  ): Promise<boolean> {
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

  private async evaluateLogicalExpression(
    expression: LogicalExpression,
    references: ArticleExpressionReference
  ): Promise<boolean> {
    const children = expression.children;

    switch (expression.op) {
      case LogicalExpressionOperator.And: {
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          const result = await this.evaluateExpression(child, references);

          if (!result) {
            return false;
          }
        }

        return true;
      }

      case LogicalExpressionOperator.Or: {
        for (let i = 0; i < children.length; ++i) {
          const child = children[i];
          const result = await this.evaluateExpression(child, references);

          if (result) {
            return true;
          }
        }

        return false;
      }

      case LogicalExpressionOperator.Not: {
        const result = await this.evaluateExpression(children[0], references);

        return !result;
      }

      default:
        throw new InvalidExpressionException(
          `Unknown operator ${
            expression.op
          } in logical expression ${JSON.stringify(expression)}`
        );
    }
  }

  private async evaluateRelationalExpression(
    expression: RelationalExpression,
    references: Record<string, unknown>
  ): Promise<boolean> {
    const { left, right } = expression;
    const referenceObject = references[left.type];

    if (!referenceObject) {
      return false;
    }

    const valueToCompareAgainst = getNestedPrimitiveValue(
      referenceObject as Record<string, unknown>,
      left.value
    );

    if (valueToCompareAgainst === null) {
      return false;
    }

    if (right.type === RelationalExpressionRight.String) {
      switch (expression.op) {
        case RelationalExpressionOperator.Eq:
          return valueToCompareAgainst === right.value;
        case RelationalExpressionOperator.Contains:
          return valueToCompareAgainst.includes(right.value);
        default:
          throw new InvalidExpressionException(
            `Unknown right operator "${
              expression.op
            }" of string-type right operand in relational expression ${JSON.stringify(
              expression
            )}. Only "${RelationalExpressionOperator.Eq}" and "${
              RelationalExpressionOperator.Contains
            }" are supported.`
          );
      }
    } else if (right.type === RelationalExpressionRight.RegExp) {
      switch (expression.op) {
        case RelationalExpressionOperator.Matches:
          return this.testRegex(right.value, valueToCompareAgainst);
        default:
          throw new InvalidExpressionException(
            `Unknown right operator "${
              expression.op
            }" of regex-type right operand in relational expression ${JSON.stringify(
              expression
            )}. Only "${RelationalExpressionOperator.Matches}" is supported.`
          );
      }
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
      throw new RegexEvalException(
        `Regex "${inputRegex}" evaluation of string "${reference}" errored: ` +
          `${(err as Error).message}`
      );
    }
  }

  buildReferences(data: { article: Article }): ArticleExpressionReference {
    return {
      [RelationalExpressionLeft.Article]: data.article,
    };
  }
}
