import { Injectable } from "@nestjs/common";
import { getNestedPrimitiveValue } from "../articles/utils/get-nested-primitive-value";
import { Article } from "../shared";
import {
  ExpressionType,
  FilterLogicalExpression,
  FilterRelationalExpression,
  LogicalExpressionOperator,
} from "./article-filterse.constants";
import { InvalidExpressionException } from "./exceptions";

@Injectable()
export class ArticleFiltersService {
  async getArticleFilterResults(
    expression: FilterLogicalExpression,
    references: Record<string, unknown>
  ) {
    return this.evaluateExpression(expression, references);
  }

  async evaluateExpression(
    expression: FilterLogicalExpression | FilterRelationalExpression,
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
    expression: FilterLogicalExpression,
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
    expression: FilterRelationalExpression,
    references: Record<string, unknown>
  ): Promise<boolean> {
    const { referenceKey, referencePath } = this.extractReferenceDetails(
      expression.left
    );

    const referenceObject = references[referenceKey];

    if (!referenceObject) {
      return false;
    }

    const value = getNestedPrimitiveValue(
      references[referenceKey] as Record<string, unknown>,
      referencePath
    );

    if (value === null) {
      return false;
    }

    const right = expression.right;

    switch (expression.op) {
      case "eq":
        return value === right;
      case "contains":
        return value.includes(right);
    }

    throw new InvalidExpressionException(
      `Unknown operator ${
        expression.op
      } in relational expression ${JSON.stringify(expression)}`
    );
  }

  private extractReferenceDetails(leftOperand: string) {
    const splitIndex = leftOperand.indexOf(":");

    const referenceKey = leftOperand.slice(0, splitIndex);
    const referencePath = leftOperand.slice(splitIndex + 1);

    if (!referenceKey || !referencePath) {
      throw new InvalidExpressionException(
        `Invalid left operand "${leftOperand}" in relational expression. ` +
          `Must be in the format <referenceKey>:<referencePath>. For example, "article:title".`
      );
    }

    return { referenceKey, referencePath };
  }

  buildReferences(data: { article: Article }) {
    return {
      article: data.article,
    };
  }
}
