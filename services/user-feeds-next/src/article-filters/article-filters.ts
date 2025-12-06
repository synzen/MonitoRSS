import vm from "node:vm";
import type { Article } from "../article-parser";

// Expression Types
export enum ExpressionType {
  Relational = "RELATIONAL",
  Logical = "LOGICAL",
}

// Logical Operators (AND/OR)
export enum LogicalExpressionOperator {
  And = "AND",
  Or = "OR",
}

// Relational Operators (comparison operations)
export enum RelationalExpressionOperator {
  Eq = "EQ",
  Contains = "CONTAINS",
  Matches = "MATCHES",
}

// Left side of expression (what to compare)
export enum RelationalExpressionLeft {
  Article = "ARTICLE",
}

// Right side type
export enum RelationalExpressionRight {
  String = "STRING",
}

// Logical Expression (AND/OR with children)
export interface LogicalExpression {
  type: ExpressionType.Logical;
  op: LogicalExpressionOperator;
  children: (LogicalExpression | RelationalExpression)[];
}

// Relational Expression (actual comparison)
export interface RelationalExpression {
  type: ExpressionType.Relational;
  op: RelationalExpressionOperator;
  not?: boolean;
  left: {
    type: RelationalExpressionLeft;
    value: string;
  };
  right: {
    type: RelationalExpressionRight;
    value: string;
  };
}

export type FilterExpression = LogicalExpression | RelationalExpression;

export type FilterExpressionReference = {
  [RelationalExpressionLeft.Article]: Article;
};

export interface FilterExplainBlocked {
  message: string;
  referenceValue: string | null;
  filterInput: string;
}

export interface FilterResult {
  result: boolean;
  explainBlocked: FilterExplainBlocked[];
}

const REGEX_TIMEOUT_MS = 5000;

/**
 * Test a regex pattern against a reference string using a sandboxed VM context.
 */
function testRegex(inputRegex: string, reference: string): boolean {
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
    throw new Error(
      `Filter regex "${inputRegex}" evaluation on text "${reference}" errored: ${(err as Error).message}`
    );
  }
}

/**
 * Evaluate a relational expression (Eq, Contains, Matches).
 */
function evaluateRelationalExpression(
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

  const explainBlocked: FilterExplainBlocked[] = [];
  let valueToCompareAgainst = referenceObject.flattened[left.value];

  // If property doesn't exist, treat as empty string
  if (!Object.keys(referenceObject.flattened).includes(left.value)) {
    valueToCompareAgainst = "";
  }

  let val = false;

  switch (expression.op) {
    case RelationalExpressionOperator.Eq: {
      val = valueToCompareAgainst === right.value;
      if (!val) {
        explainBlocked.push({
          message: "Reference value does not match filter input",
          referenceValue: valueToCompareAgainst ?? null,
          filterInput: right.value,
        });
      }
      break;
    }

    case RelationalExpressionOperator.Contains: {
      val = (valueToCompareAgainst ?? "")
        .toLowerCase()
        .includes(right.value.toLowerCase());
      if (!val) {
        explainBlocked.push({
          message: "Reference value does not contain filter input",
          referenceValue: valueToCompareAgainst ?? null,
          filterInput: right.value,
        });
      }
      break;
    }

    case RelationalExpressionOperator.Matches: {
      val = testRegex(right.value, valueToCompareAgainst ?? "");
      if (!val) {
        explainBlocked.push({
          message: "Reference value does not match regex",
          referenceValue: valueToCompareAgainst ?? null,
          filterInput: right.value,
        });
      }
      break;
    }
  }

  // Negation: If `not` flag is set, invert the result
  if (expression.not) {
    return { result: !val, explainBlocked };
  }

  return { result: val, explainBlocked };
}

/**
 * Evaluate a logical expression (AND/OR).
 */
function evaluateLogicalExpression(
  expression: LogicalExpression,
  references: FilterExpressionReference
): FilterResult {
  const { children } = expression;

  switch (expression.op) {
    case LogicalExpressionOperator.And: {
      // AND: ALL children must pass, short-circuit on first failure
      if (!children.length) {
        return { result: true, explainBlocked: [] };
      }

      for (const child of children) {
        const { result, explainBlocked } = evaluateExpression(
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
      // OR: ANY child can pass, short-circuit on first success
      if (!children.length) {
        return { result: true, explainBlocked: [] };
      }

      const allExplainBlocked: FilterExplainBlocked[] = [];

      for (const child of children) {
        const { result, explainBlocked } = evaluateExpression(
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
  }
}

/**
 * Evaluate a filter expression (dispatches to logical or relational).
 */
export function evaluateExpression(
  expression: FilterExpression | null | undefined,
  references: FilterExpressionReference
): FilterResult {
  if (!expression) {
    return { result: true, explainBlocked: [] };
  }

  switch (expression.type) {
    case ExpressionType.Logical:
      return evaluateLogicalExpression(expression, references);
    case ExpressionType.Relational:
      return evaluateRelationalExpression(expression, references);
    default:
      throw new Error(`Invalid expression type`);
  }
}

/**
 * Build references object for filter evaluation.
 */
export function buildFilterReferences(
  article: Article
): FilterExpressionReference {
  return {
    [RelationalExpressionLeft.Article]: article,
  };
}

/**
 * Evaluate an article against a filter expression.
 */
export function getArticleFilterResults(
  expression: LogicalExpression | null | undefined,
  article: Article
): FilterResult {
  const references = buildFilterReferences(article);
  return evaluateExpression(expression, references);
}

// ============================================================================
// Filter Expression Validation
// ============================================================================

/**
 * Validate the left side of a relational expression.
 */
export function validateRelationalLeft(
  left: Record<string, unknown>,
  currentPath = "root."
): string[] {
  if (!left || left.constructor !== {}.constructor) {
    return [`Expected ${currentPath}left to be an object but got ${left}`];
  }

  if (left.type === RelationalExpressionLeft.Article) {
    if (typeof left.value !== "string") {
      return [
        `Expected ${currentPath}value to be a string but got ${left.value}`,
      ];
    }
  } else {
    return [
      `Expected ${currentPath}type to be one of ${Object.values(
        RelationalExpressionLeft
      ).join(",")} but got ${left.type}`,
    ];
  }

  return [];
}

/**
 * Validate the right side of a relational expression.
 */
export function validateRelationalRight(
  right: Record<string, unknown>,
  currentPath = "root."
): string[] {
  if (!right || right.constructor !== {}.constructor) {
    return [`Expected ${currentPath}right to be an object but got ${right}`];
  }

  if (right.type === RelationalExpressionRight.String) {
    if (typeof right.value !== "string") {
      return [
        `Expected ${currentPath}value to be a string but got ${right.value}`,
      ];
    }
  } else {
    return [
      `Expected ${currentPath}type to be one of ${Object.values(
        RelationalExpressionRight
      )} but got ${right.type}`,
    ];
  }

  return [];
}

/**
 * Validate a relational expression.
 */
export function validateRelationalExpression(
  data: Record<string, unknown>,
  currentPath = "root."
): string[] {
  if (!data || data.constructor !== {}.constructor) {
    return [`Expected ${currentPath} to be an object but got ${data}`];
  }

  const { type, op, left, right } = data;

  if (type !== ExpressionType.Relational) {
    return [
      `Expected ${currentPath}type to be ${ExpressionType.Relational} but got ${type}`,
    ];
  }

  if (
    !Object.values(RelationalExpressionOperator).includes(
      op as RelationalExpressionOperator
    )
  ) {
    return [
      `Expected ${currentPath}op to be one of ${Object.values(
        RelationalExpressionOperator
      )} but got ${op}`,
    ];
  }

  if (!left || (left as object).constructor !== {}.constructor) {
    return [`Expected ${currentPath}left to be an object but got ${left}`];
  }

  if (!right || (right as object).constructor !== {}.constructor) {
    return [`Expected ${currentPath}right to be an object but got ${right}`];
  }

  const leftErrors = validateRelationalLeft(
    left as Record<string, unknown>,
    `${currentPath}left.`
  );
  const rightErrors = validateRelationalRight(
    right as Record<string, unknown>,
    `${currentPath}right.`
  );

  return [...leftErrors, ...rightErrors];
}

/**
 * Validate a logical expression (recursively validates children).
 */
export function validateLogicalExpression(
  input: Record<string, unknown>,
  currentPath = "root.",
  depth = 0
): string[] {
  if (!input || input.constructor !== {}.constructor) {
    return [`Expected ${currentPath} to be an object but got ${input}`];
  }

  const { type, children, op } = input;

  if (depth > 9) {
    return [`Depth of logical expression is too deep.`];
  }

  if (type !== ExpressionType.Logical) {
    return [
      `Expected ${currentPath}type to be ${ExpressionType.Logical} but got ${type}`,
    ];
  }

  if (
    !Object.values(LogicalExpressionOperator).includes(
      op as LogicalExpressionOperator
    )
  ) {
    return [
      `Expected ${currentPath}op to be one of ${Object.values(
        LogicalExpressionOperator
      )} but got ${op}`,
    ];
  }

  if (!Array.isArray(children)) {
    return [
      `Expected ${currentPath}children to be an array but got ${children}`,
    ];
  }

  const errors = children.flatMap(
    (child: Record<string, unknown>, index: number) => {
      const childPath = `${currentPath}children[${index}].`;

      if (child.type === ExpressionType.Logical) {
        return validateLogicalExpression(child, childPath, depth + 1);
      } else if (child.type === ExpressionType.Relational) {
        return validateRelationalExpression(child, childPath);
      } else {
        return [
          `Expected ${childPath}type to be one of ${Object.values(
            ExpressionType
          )} but got ${child.type}`,
        ];
      }
    }
  );

  return errors;
}
