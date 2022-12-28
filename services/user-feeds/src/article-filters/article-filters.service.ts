import { Injectable } from "@nestjs/common";
import { getNestedPrimitiveValue } from "../articles/utils/get-nested-primitive-value";
import { Article } from "../shared";
import { InvalidExpressionException, RegexEvalException } from "./exceptions";
import {
  ExpressionType,
  LogicalExpression,
  LogicalExpressionOperator,
  RelationalExpression,
  RelationalExpressionLeft,
  RelationalExpressionOperator,
  RelationalExpressionRight,
} from "./types";
import vm from "node:vm";

const REGEX_TIMEOUT_MS = 5000;

@Injectable()
export class ArticleFiltersService {
  async getArticleFilterResults(
    expression: LogicalExpression,
    references: Record<string, unknown>
  ) {
    return this.evaluateExpression(expression, references);
  }

  async evaluateExpression(
    expression: LogicalExpression | RelationalExpression,
    references: Record<string, unknown>
  ): Promise<boolean> {
    if (!expression) {
      return true;
    }

    if (
      ![ExpressionType.Logical, ExpressionType.Relational].includes(
        expression.type
      )
    ) {
      throw new InvalidExpressionException(
        `Invalid expression type: ${expression.type}`
      );
    }

    switch (expression.type) {
      case ExpressionType.Logical:
        return this.evaluateLogicalExpression(expression, references);
      case ExpressionType.Relational:
        return this.evaluateRelationalExpression(expression, references);
    }
  }

  private async evaluateLogicalExpression(
    expression: LogicalExpression,
    references: Record<string, unknown>
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
    }

    throw new InvalidExpressionException(
      `Unknown operator ${expression.op} in logical expression ${JSON.stringify(
        expression
      )}`
    );
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
      }

      throw new InvalidExpressionException(
        `Unknown right operator "${
          expression.op
        }" of string-type right operand in relational expression ${JSON.stringify(
          expression
        )}. Only "${RelationalExpressionOperator.Eq}" and "${
          RelationalExpressionOperator.Contains
        }" are supported.`
      );
    } else if (right.type === RelationalExpressionRight.RegExp) {
      switch (expression.op) {
        case RelationalExpressionOperator.Matches:
          return this.testRegex(right.value, valueToCompareAgainst);
      }

      throw new InvalidExpressionException(
        `Unknown right operator "${
          expression.op
        }" of regex-type right operand in relational expression ${JSON.stringify(
          expression
        )}. Only "${RelationalExpressionOperator.Matches}" is supported.`
      );
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

  buildReferences(data: {
    article: Article;
  }): Record<RelationalExpressionLeft, unknown> {
    return {
      ARTICLE: data.article,
    };
  }
}
