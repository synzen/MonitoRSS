/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ExpressionType,
  LogicalExpressionOperator,
  RelationalExpressionLeft,
  RelationalExpressionOperator,
  RelationalExpressionRight,
} from "../types";

export function validateRelationalLeft(
  left: Record<string, any>,
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

export function validateRelationalRight(
  right: Record<string, any>,
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

export function validateRelationalExpression(
  data: Record<string, any>,
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

  if (!left || left.constructor !== {}.constructor) {
    return [`Expected ${currentPath}left to be an object but got ${left}`];
  }

  if (!right || right.constructor !== {}.constructor) {
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

export function validateLogicalExpression(
  input: Record<string, any>,
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

  const errors = children.flatMap((child, index) => {
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
  });

  return errors;
}
