import {
  ExpressionType,
  LogicalExpression,
  LogicalExpressionOperator,
  RelationalExpressionLeft,
  RelationalExpressionOperator,
  RelationalExpressionRight,
} from "../types";
import {
  validateLogicalExpression,
  validateRelationalExpression,
  validateRelationalLeft,
  validateRelationalRight,
} from "./validate-filter-expression";
import { describe, it } from "node:test";
import { deepStrictEqual } from "node:assert";

describe("validateRelationalLeft", () => {
  it("should return an error if left is not an object", () => {
    const left = 123;

    const errors = validateRelationalLeft(left as never);

    deepStrictEqual(errors, ["Expected root.left to be an object but got 123"]);
  });

  it("should return an error if type is not article", () => {
    const left = {
      type: "notArticle",
      value: "value",
    };

    const errors = validateRelationalLeft(left);

    deepStrictEqual(errors, [
      `Expected root.type to be one of ARTICLE but got notArticle`,
    ]);
  });

  describe("ARTICLE type", () => {
    it("should return an error if value is not a string", () => {
      const left = {
        type: RelationalExpressionLeft.Article,
        value: 123,
      };

      const errors = validateRelationalLeft(left);

      deepStrictEqual(errors, [
        "Expected root.value to be a string but got 123",
      ]);
    });

    it("should return an empty array if type is ARTICLE and value is a string", () => {
      const left = {
        type: RelationalExpressionLeft.Article,
        value: "value",
      };

      const errors = validateRelationalLeft(left);

      deepStrictEqual(errors, []);
    });
  });
});

describe("validateRelationalRight", () => {
  it("should return an error if right is not an object", () => {
    const right = 123;

    const errors = validateRelationalRight(right as never);

    deepStrictEqual(errors, [
      "Expected root.right to be an object but got 123",
    ]);
  });

  it("should return an error if type is not String", () => {
    const right = {
      type: "notStringOrRegExp",
      value: "value",
    };

    const errors = validateRelationalRight(right);

    deepStrictEqual(errors, [
      "Expected root.type to be one of STRING but got notStringOrRegExp",
    ]);
  });

  describe("STRING type", () => {
    it("should return an error if value is not a string", () => {
      const right = {
        type: RelationalExpressionRight.String,
        value: 123,
      };

      const errors = validateRelationalRight(right);

      deepStrictEqual(errors, [
        "Expected root.value to be a string but got 123",
      ]);
    });

    it("should return an empty array if type is String and value is a string", () => {
      const right = {
        type: RelationalExpressionRight.String,
        value: "value",
      };

      const errors = validateRelationalRight(right);

      deepStrictEqual(errors, []);
    });
  });
});

describe("validateRelationalExpression", () => {
  it("should return an error if input is not an object", () => {
    const expression = 123;

    const errors = validateRelationalExpression(expression as never);

    deepStrictEqual(errors, ["Expected root. to be an object but got 123"]);
  });

  it("should return an error if type is not Relational", () => {
    const expression = {
      type: "notRelational",
      left: {
        type: RelationalExpressionLeft.Article,
        value: "value",
      },
      op: "==",
      right: {
        type: RelationalExpressionRight.String,
        value: "value",
      },
    };

    const errors = validateRelationalExpression(expression);

    deepStrictEqual(errors, [
      "Expected root.type to be RELATIONAL but got notRelational",
    ]);
  });

  it("should return an error if left is not an object", () => {
    const expression = {
      type: ExpressionType.Relational,
      left: 123,
      op: RelationalExpressionOperator.Eq,
      right: {
        type: RelationalExpressionRight.String,
        value: "value",
      },
    };

    const errors = validateRelationalExpression(expression);

    deepStrictEqual(errors, ["Expected root.left to be an object but got 123"]);
  });

  it("should return an error if there is no left", () => {
    const expression = {
      type: ExpressionType.Relational,
      op: RelationalExpressionOperator.Eq,
      right: {
        type: RelationalExpressionRight.String,
        value: "value",
      },
    };

    const errors = validateRelationalExpression(expression);

    deepStrictEqual(errors, [
      "Expected root.left to be an object but got undefined",
    ]);
  });

  it("should return an error if op is not a valid operator", () => {
    const expression = {
      type: ExpressionType.Relational,
      left: {
        type: RelationalExpressionLeft.Article,
        value: "value",
      },
      op: "notAnOperator",
      right: {
        type: RelationalExpressionRight.String,
        value: "value",
      },
    };

    const errors = validateRelationalExpression(expression);

    deepStrictEqual(errors, [
      `Expected root.op to be one of ${Object.values(
        RelationalExpressionOperator
      )} but got notAnOperator`,
    ]);
  });

  it("should return an error if right is invalid", () => {
    const expression = {
      type: ExpressionType.Relational,
      left: {
        type: RelationalExpressionLeft.Article,
        value: "value",
      },
      op: RelationalExpressionOperator.Eq,
      right: 123,
    };

    const errors = validateRelationalExpression(expression);

    deepStrictEqual(errors, [
      "Expected root.right to be an object but got 123",
    ]);
  });

  it("should return an error if there is no right", () => {
    const expression = {
      type: ExpressionType.Relational,
      left: {
        type: RelationalExpressionLeft.Article,
        value: "value",
      },
      op: RelationalExpressionOperator.Eq,
    };

    const errors = validateRelationalExpression(expression);

    deepStrictEqual(errors, [
      "Expected root.right to be an object but got undefined",
    ]);
  });

  it("should return an empty array if expression is valid", () => {
    const expression = {
      type: ExpressionType.Relational,
      left: {
        type: RelationalExpressionLeft.Article,
        value: "value",
      },
      op: RelationalExpressionOperator.Eq,
      right: {
        type: RelationalExpressionRight.String,
        value: "value",
      },
    };

    const errors = validateRelationalExpression(expression);

    deepStrictEqual(errors, []);
  });
});

describe("validateLogicalExpression", () => {
  it("should return an error if type is not Logical", () => {
    const expression = {
      type: "notLogical",
      op: LogicalExpressionOperator.And,
      children: [
        {
          type: ExpressionType.Relational,
          left: {
            type: RelationalExpressionLeft.Article,
            value: "value",
          },
          op: RelationalExpressionOperator.Eq,
          right: {
            type: RelationalExpressionRight.String,
            value: "value",
          },
        },
      ],
    };

    const errors = validateLogicalExpression(expression);

    deepStrictEqual(errors, [
      "Expected root.type to be LOGICAL but got notLogical",
    ]);
  });

  it("should return an error if op is not a valid operator", () => {
    const expression = {
      type: ExpressionType.Logical,
      op: "notAnOperator",
      children: [
        {
          type: ExpressionType.Relational,
          left: {
            type: RelationalExpressionLeft.Article,
            value: "value",
          },
          op: RelationalExpressionOperator.Eq,
          right: {
            type: RelationalExpressionRight.String,
            value: "value",
          },
        },
      ],
    };

    const errors = validateLogicalExpression(expression);

    deepStrictEqual(errors, [
      `Expected root.op to be one of ${Object.values(
        LogicalExpressionOperator
      )} but got notAnOperator`,
    ]);
  });

  it("should return an error if children is not an array", () => {
    const expression = {
      type: ExpressionType.Logical,
      op: LogicalExpressionOperator.And,
      children: 123,
    };

    const errors = validateLogicalExpression(expression);

    deepStrictEqual(errors, [
      "Expected root.children to be an array but got 123",
    ]);
  });

  it("should return an error if there is no children", () => {
    const expression = {
      type: ExpressionType.Logical,
      op: LogicalExpressionOperator.And,
    };

    const errors = validateLogicalExpression(expression);

    deepStrictEqual(errors, [
      "Expected root.children to be an array but got undefined",
    ]);
  });

  it("should return an error if children is not an array of valid expressions", () => {
    const expression = {
      type: ExpressionType.Logical,
      op: LogicalExpressionOperator.And,
      children: [
        {
          type: "notLogical",
          op: LogicalExpressionOperator.And,
          children: [
            {
              type: ExpressionType.Relational,
              left: {
                type: RelationalExpressionLeft.Article,
                value: "value",
              },
              op: RelationalExpressionOperator.Eq,
              right: {
                type: RelationalExpressionRight.String,
                value: "value",
              },
            },
          ],
        },
      ],
    };

    const errors = validateLogicalExpression(expression);

    deepStrictEqual(errors, [
      "Expected root.children[0].type to be one of RELATIONAL,LOGICAL but got notLogical",
    ]);
  });

  it("should return an error if input record is not a object", () => {
    const errors = validateLogicalExpression(null as never);

    deepStrictEqual(errors, ["Expected root. to be an object but got null"]);
  });

  it("should return an empty array if expression is valid", () => {
    const expression = {
      type: ExpressionType.Logical,
      op: LogicalExpressionOperator.And,
      children: [
        {
          type: ExpressionType.Relational,
          left: {
            type: RelationalExpressionLeft.Article,
            value: "value",
          },
          op: RelationalExpressionOperator.Eq,
          right: {
            type: RelationalExpressionRight.String,
            value: "value",
          },
        },
      ],
    };

    const errors = validateLogicalExpression(expression);

    deepStrictEqual(errors, []);
  });

  it("should return a flat array of errors if there are nested errors", () => {
    const expression = {
      type: ExpressionType.Logical,
      op: LogicalExpressionOperator.And,
      children: [
        {
          type: "TEST",
          op: LogicalExpressionOperator.And,
          children: [
            {
              type: ExpressionType.Relational,
              left: {
                type: RelationalExpressionLeft.Article,
                value: "value",
              },
              op: RelationalExpressionOperator.Eq,
              right: {
                type: RelationalExpressionRight.String,
                value: "value",
              },
            },
          ],
        },
        {
          type: "TEST",
          op: LogicalExpressionOperator.And,
          children: [
            {
              type: ExpressionType.Relational,
              left: {
                type: RelationalExpressionLeft.Article,
                value: "value",
              },
              op: RelationalExpressionOperator.Eq,
              right: {
                type: RelationalExpressionRight.String,
                value: "value",
              },
            },
          ],
        },
      ],
    };

    const errors = validateLogicalExpression(expression);

    deepStrictEqual(errors, [
      "Expected root.children[0].type to be one of RELATIONAL,LOGICAL but got TEST",
      "Expected root.children[1].type to be one of RELATIONAL,LOGICAL but got TEST",
    ]);
  });

  it("returns an error if the depth is greater than 10", () => {
    const baseExpression: LogicalExpression = {
      type: ExpressionType.Logical,
      op: LogicalExpressionOperator.And,
      children: [],
    };

    let latestExpression = baseExpression;
    let currentDepth = 0;

    while (currentDepth < 10) {
      latestExpression.children.push({
        type: ExpressionType.Logical,
        op: LogicalExpressionOperator.And,
        children: [],
      });

      latestExpression = latestExpression.children[0] as LogicalExpression;
      currentDepth++;
    }

    latestExpression.children.push({
      type: ExpressionType.Relational,
      left: {
        type: RelationalExpressionLeft.Article,
        value: "value",
      },
      op: RelationalExpressionOperator.Eq,
      right: {
        type: RelationalExpressionRight.String,
        value: "value",
      },
    });

    const errors = validateLogicalExpression(baseExpression);

    deepStrictEqual(errors, [`Depth of logical expression is too deep.`]);
  });
});
