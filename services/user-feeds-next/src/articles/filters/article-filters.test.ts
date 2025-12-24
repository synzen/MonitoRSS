import { describe, it } from "node:test";
import assert from "node:assert";
import {
  evaluateExpression,
  getArticleFilterResults,
  validateRelationalLeft,
  validateRelationalRight,
  validateRelationalExpression,
  validateLogicalExpression,
  ExpressionType,
  LogicalExpressionOperator,
  RelationalExpressionOperator,
  RelationalExpressionLeft,
  RelationalExpressionRight,
  type LogicalExpression,
  type RelationalExpression,
  type FilterExpressionReference,
} from ".";
import type { Article } from "../parser";

function createArticle(flattened: Record<string, string>): Article {
  return {
    flattened: {
      id: "1",
      idHash: "1",
      ...flattened,
    },
    raw: {} as never,
  };
}

describe("article-filters", { concurrency: true }, () => {
  describe("getArticleFilterResults", () => {
    it("returns true for null expression", () => {
      const article = createArticle({ title: "Hello" });
      const result = getArticleFilterResults(null, article);
      assert.strictEqual(result.result, true);
    });

    it("throws if expression type is invalid", () => {
      const expression = {
        type: "invalid",
      } as never;

      assert.throws(() => evaluateExpression(expression, {} as never));
    });
  });

  describe("evaluateExpression", () => {
    describe("relational", () => {
      it("returns the inverse of the expected value when NOT is true", () => {
        const expression: RelationalExpression = {
          left: {
            type: RelationalExpressionLeft.Article,
            value: "title",
          },
          op: RelationalExpressionOperator.Eq,
          right: {
            type: RelationalExpressionRight.String,
            value: "s",
          },
          type: ExpressionType.Relational,
          not: true,
        };

        const reference: FilterExpressionReference = {
          [RelationalExpressionLeft.Article]: createArticle({ title: "s" }),
        };

        assert.strictEqual(evaluateExpression(expression, reference).result, false);
      });

      const eqTestCases = [
        {
          value: "s",
          articleProperty: "title",
          articleValue: "s",
          expected: true,
        },
        {
          value: "s",
          articleProperty: "title",
          articleValue: "sticks",
          expected: false,
        },
        {
          value: "r/FORTnITE",
          articleProperty: "atom:category__@__label",
          articleValue: "r/FORTnITE",
          expected: true,
        },
      ];

      eqTestCases.forEach(
        ({ value, articleProperty, articleValue, expected }) => {
          it(`supports Eq when expected is ${expected} (value: "${value}", articleValue: "${articleValue}")`, () => {
            const expression: RelationalExpression = {
              left: {
                type: RelationalExpressionLeft.Article,
                value: articleProperty,
              },
              op: RelationalExpressionOperator.Eq,
              right: {
                type: RelationalExpressionRight.String,
                value: value,
              },
              type: ExpressionType.Relational,
            };

            const reference: FilterExpressionReference = {
              [RelationalExpressionLeft.Article]: createArticle({
                [articleProperty]: articleValue,
              }),
            };

            assert.strictEqual(
              evaluateExpression(expression, reference).result,
              expected
            );
          });
        }
      );

      const containsTestCases = [
        {
          value: "s",
          articleValue: "sticks",
          expected: true,
        },
        {
          value: "s",
          articleValue: "top gun",
          expected: false,
        },
      ];

      containsTestCases.forEach(({ value, articleValue, expected }) => {
        it(`supports Contains when expected is ${expected}`, () => {
          const expression: RelationalExpression = {
            left: {
              type: RelationalExpressionLeft.Article,
              value: "title",
            },
            op: RelationalExpressionOperator.Contains,
            right: {
              type: RelationalExpressionRight.String,
              value: value,
            },
            type: ExpressionType.Relational,
          };

          const reference: FilterExpressionReference = {
            [RelationalExpressionLeft.Article]: createArticle({
              title: articleValue,
            }),
          };

          assert.strictEqual(
            evaluateExpression(expression, reference).result,
            expected
          );
        });
      });

      const matchesTestCases = [
        {
          value: "a{3}",
          articleValue: "sticks",
          expected: false,
        },
        {
          value: "a{3}",
          articleValue: "hello-aaa-there",
          expected: true,
        },
      ];

      matchesTestCases.forEach(({ articleValue, expected, value }) => {
        it(`supports Matches when expected is ${expected}`, () => {
          const expression: RelationalExpression = {
            left: {
              type: RelationalExpressionLeft.Article,
              value: "title",
            },
            op: RelationalExpressionOperator.Matches,
            right: {
              type: RelationalExpressionRight.String,
              value,
            },
            type: ExpressionType.Relational,
          };

          const reference: FilterExpressionReference = {
            [RelationalExpressionLeft.Article]: createArticle({
              title: articleValue,
            }),
          };

          assert.strictEqual(
            evaluateExpression(expression, reference).result,
            expected
          );
        });
      });
    });

    describe("AND operand", () => {
      it("returns true correctly with 1 child", () => {
        assert.strictEqual(
          evaluateExpression(
            {
              type: ExpressionType.Logical,
              op: LogicalExpressionOperator.And,
              children: [
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: {
                    type: RelationalExpressionLeft.Article,
                    value: "title",
                  },
                  right: {
                    type: RelationalExpressionRight.String,
                    value: "a",
                  },
                },
              ],
            },
            {
              ARTICLE: createArticle({ title: "a" }),
            }
          ).result,
          true
        );
      });

      it("returns true correctly with 2 children", () => {
        assert.strictEqual(
          evaluateExpression(
            {
              type: ExpressionType.Logical,
              op: LogicalExpressionOperator.And,
              children: [
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: {
                    type: RelationalExpressionLeft.Article,
                    value: "title",
                  },
                  right: {
                    type: RelationalExpressionRight.String,
                    value: "a",
                  },
                },
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: {
                    type: RelationalExpressionLeft.Article,
                    value: "description",
                  },
                  right: {
                    type: RelationalExpressionRight.String,
                    value: "b",
                  },
                },
              ],
            },
            {
              ARTICLE: createArticle({ title: "a", description: "b" }),
            }
          ).result,
          true
        );
      });

      it("returns false correctly", () => {
        assert.strictEqual(
          evaluateExpression(
            {
              type: ExpressionType.Logical,
              op: LogicalExpressionOperator.And,
              children: [
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: {
                    type: RelationalExpressionLeft.Article,
                    value: "title",
                  },
                  right: {
                    type: RelationalExpressionRight.String,
                    value: "a",
                  },
                },
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: {
                    type: RelationalExpressionLeft.Article,
                    value: "description",
                  },
                  right: {
                    type: RelationalExpressionRight.String,
                    value: "b-different",
                  },
                },
              ],
            },
            {
              ARTICLE: createArticle({ title: "a", description: "b" }),
            }
          ).result,
          false
        );
      });
    });

    describe("OR operand", () => {
      it("returns true correctly", () => {
        assert.strictEqual(
          evaluateExpression(
            {
              type: ExpressionType.Logical,
              op: LogicalExpressionOperator.Or,
              children: [
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: {
                    type: RelationalExpressionLeft.Article,
                    value: "title",
                  },
                  right: {
                    type: RelationalExpressionRight.String,
                    value: "a-different",
                  },
                },
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: {
                    type: RelationalExpressionLeft.Article,
                    value: "description",
                  },
                  right: {
                    type: RelationalExpressionRight.String,
                    value: "b",
                  },
                },
              ],
            },
            {
              ARTICLE: createArticle({ title: "a", description: "b" }),
            }
          ).result,
          true
        );
      });

      it("returns false correctly", () => {
        assert.strictEqual(
          evaluateExpression(
            {
              type: ExpressionType.Logical,
              op: LogicalExpressionOperator.Or,
              children: [
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: {
                    type: RelationalExpressionLeft.Article,
                    value: "title",
                  },
                  right: {
                    type: RelationalExpressionRight.String,
                    value: "a-different",
                  },
                },
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: {
                    type: RelationalExpressionLeft.Article,
                    value: "description",
                  },
                  right: {
                    type: RelationalExpressionRight.String,
                    value: "b-different",
                  },
                },
              ],
            },
            {
              ARTICLE: createArticle({ title: "a", description: "b" }),
            }
          ).result,
          false
        );
      });

      it("returns false if reference contains no value", () => {
        assert.strictEqual(
          evaluateExpression(
            {
              type: ExpressionType.Logical,
              op: LogicalExpressionOperator.Or,
              children: [
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: {
                    type: RelationalExpressionLeft.Article,
                    value: "title",
                  },
                  right: {
                    type: RelationalExpressionRight.String,
                    value: "a-different",
                  },
                },
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: {
                    type: RelationalExpressionLeft.Article,
                    value: "description",
                  },
                  right: {
                    type: RelationalExpressionRight.String,
                    value: "b-different",
                  },
                },
              ],
            },
            {
              ARTICLE: createArticle({}),
            }
          ).result,
          false
        );
      });

      it("returns false if reference object does not exist", () => {
        assert.strictEqual(
          evaluateExpression(
            {
              type: ExpressionType.Logical,
              op: LogicalExpressionOperator.Or,
              children: [
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: {
                    type: RelationalExpressionLeft.Article,
                    value: "title",
                  },
                  right: {
                    type: RelationalExpressionRight.String,
                    value: "a-different",
                  },
                },
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: {
                    type: RelationalExpressionLeft.Article,
                    value: "description",
                  },
                  right: {
                    type: RelationalExpressionRight.String,
                    value: "b-different",
                  },
                },
              ],
            },
            {} as never
          ).result,
          false
        );
      });
    });
  });

  describe("explainBlocked", () => {
    it("returns explainBlocked when filter fails", () => {
      const article = createArticle({ title: "Hello World" });
      const expression: LogicalExpression = {
        type: ExpressionType.Logical,
        op: LogicalExpressionOperator.And,
        children: [
          {
            type: ExpressionType.Relational,
            op: RelationalExpressionOperator.Eq,
            left: { type: RelationalExpressionLeft.Article, value: "title" },
            right: {
              type: RelationalExpressionRight.String,
              value: "Goodbye World",
            },
          },
        ],
      };

      const result = getArticleFilterResults(expression, article);
      assert.strictEqual(result.result, false);
      assert.strictEqual(result.explainBlocked.length, 1);
      assert.strictEqual(result.explainBlocked[0]!.truncatedReferenceValue, "Hello World");
      assert.strictEqual(result.explainBlocked[0]!.filterInput, "Goodbye World");
    });

    it("treats missing fields as empty string", () => {
      const article = createArticle({});
      const expression: LogicalExpression = {
        type: ExpressionType.Logical,
        op: LogicalExpressionOperator.And,
        children: [
          {
            type: ExpressionType.Relational,
            op: RelationalExpressionOperator.Eq,
            left: {
              type: RelationalExpressionLeft.Article,
              value: "nonexistent",
            },
            right: { type: RelationalExpressionRight.String, value: "" },
          },
        ],
      };

      const result = getArticleFilterResults(expression, article);
      assert.strictEqual(result.result, true);
    });
  });

  describe("explainMatched", () => {
    it("populates explainMatched when non-negated CONTAINS filter passes", () => {
      const article = createArticle({ title: "Hello World" });
      const expression: LogicalExpression = {
        type: ExpressionType.Logical,
        op: LogicalExpressionOperator.Or,
        children: [
          {
            type: ExpressionType.Relational,
            op: RelationalExpressionOperator.Contains,
            left: { type: RelationalExpressionLeft.Article, value: "title" },
            right: { type: RelationalExpressionRight.String, value: "Hello" },
          },
        ],
      };

      const result = getArticleFilterResults(expression, article);
      assert.strictEqual(result.result, true);
      assert.strictEqual(result.explainMatched.length, 1);
      assert.strictEqual(result.explainBlocked.length, 0);
    });

    it("populates explainMatched when NOT CONTAINS filter passes (article doesn't contain text)", () => {
      const article = createArticle({ title: "Hello World" });
      const expression: LogicalExpression = {
        type: ExpressionType.Logical,
        op: LogicalExpressionOperator.Or,
        children: [
          {
            type: ExpressionType.Relational,
            op: RelationalExpressionOperator.Contains,
            left: { type: RelationalExpressionLeft.Article, value: "title" },
            right: { type: RelationalExpressionRight.String, value: "forbidden" },
            not: true,
          },
        ],
      };

      const result = getArticleFilterResults(expression, article);
      assert.strictEqual(result.result, true);
      assert.strictEqual(result.explainMatched.length, 1);
      assert.strictEqual(result.explainBlocked.length, 0);
    });

    it("populates explainBlocked when NOT CONTAINS filter fails (article does contain text)", () => {
      const article = createArticle({ title: "Hello World" });
      const expression: LogicalExpression = {
        type: ExpressionType.Logical,
        op: LogicalExpressionOperator.Or,
        children: [
          {
            type: ExpressionType.Relational,
            op: RelationalExpressionOperator.Contains,
            left: { type: RelationalExpressionLeft.Article, value: "title" },
            right: { type: RelationalExpressionRight.String, value: "Hello" },
            not: true,
          },
        ],
      };

      const result = getArticleFilterResults(expression, article);
      assert.strictEqual(result.result, false);
      assert.strictEqual(result.explainMatched.length, 0);
      assert.strictEqual(result.explainBlocked.length, 1);
    });

    it("populates explainMatched when NOT EQ filter passes (values don't match)", () => {
      const article = createArticle({ title: "Hello" });
      const expression: LogicalExpression = {
        type: ExpressionType.Logical,
        op: LogicalExpressionOperator.Or,
        children: [
          {
            type: ExpressionType.Relational,
            op: RelationalExpressionOperator.Eq,
            left: { type: RelationalExpressionLeft.Article, value: "title" },
            right: { type: RelationalExpressionRight.String, value: "other" },
            not: true,
          },
        ],
      };

      const result = getArticleFilterResults(expression, article);
      assert.strictEqual(result.result, true);
      assert.strictEqual(result.explainMatched.length, 1);
      assert.strictEqual(result.explainBlocked.length, 0);
    });

    it("populates explainBlocked when NOT EQ filter fails (values match)", () => {
      const article = createArticle({ title: "Hello" });
      const expression: LogicalExpression = {
        type: ExpressionType.Logical,
        op: LogicalExpressionOperator.Or,
        children: [
          {
            type: ExpressionType.Relational,
            op: RelationalExpressionOperator.Eq,
            left: { type: RelationalExpressionLeft.Article, value: "title" },
            right: { type: RelationalExpressionRight.String, value: "Hello" },
            not: true,
          },
        ],
      };

      const result = getArticleFilterResults(expression, article);
      assert.strictEqual(result.result, false);
      assert.strictEqual(result.explainMatched.length, 0);
      assert.strictEqual(result.explainBlocked.length, 1);
    });

    it("populates explainMatched when NOT MATCHES filter passes (regex doesn't match)", () => {
      const article = createArticle({ title: "Hello World" });
      const expression: LogicalExpression = {
        type: ExpressionType.Logical,
        op: LogicalExpressionOperator.Or,
        children: [
          {
            type: ExpressionType.Relational,
            op: RelationalExpressionOperator.Matches,
            left: { type: RelationalExpressionLeft.Article, value: "title" },
            right: { type: RelationalExpressionRight.String, value: "^forbidden" },
            not: true,
          },
        ],
      };

      const result = getArticleFilterResults(expression, article);
      assert.strictEqual(result.result, true);
      assert.strictEqual(result.explainMatched.length, 1);
      assert.strictEqual(result.explainBlocked.length, 0);
    });
  });

  describe("validateRelationalLeft", () => {
    it("returns error if left is not an object", () => {
      const result = validateRelationalLeft("not-object" as never, "root.");
      assert.strictEqual(result.length, 1);
      assert.ok(result[0]!.includes("root."));
      assert.ok(result[0]!.includes("object"));
    });

    it("returns error if left.type is not ARTICLE", () => {
      const result = validateRelationalLeft(
        { type: "INVALID", value: "title" } as never,
        "root."
      );
      assert.strictEqual(result.length, 1);
      assert.ok(result[0]!.includes("root.type"));
    });

    it("returns error if left.value is not a string", () => {
      const result = validateRelationalLeft(
        { type: RelationalExpressionLeft.Article, value: 123 } as never,
        "root."
      );
      assert.strictEqual(result.length, 1);
      assert.ok(result[0]!.includes("root.value"));
      assert.ok(result[0]!.includes("string"));
    });

    it("returns empty array for valid left", () => {
      const result = validateRelationalLeft(
        { type: RelationalExpressionLeft.Article, value: "title" },
        "root."
      );
      assert.deepStrictEqual(result, []);
    });
  });

  describe("validateRelationalRight", () => {
    it("returns error if right is not an object", () => {
      const result = validateRelationalRight("not-object" as never, "root.");
      assert.strictEqual(result.length, 1);
      assert.ok(result[0]!.includes("root."));
      assert.ok(result[0]!.includes("object"));
    });

    it("returns error if right.type is not STRING", () => {
      const result = validateRelationalRight(
        { type: "INVALID", value: "test" } as never,
        "root."
      );
      assert.strictEqual(result.length, 1);
      assert.ok(result[0]!.includes("root.type"));
    });

    it("returns error if right.value is not a string", () => {
      const result = validateRelationalRight(
        { type: RelationalExpressionRight.String, value: 123 } as never,
        "root."
      );
      assert.strictEqual(result.length, 1);
      assert.ok(result[0]!.includes("root.value"));
      assert.ok(result[0]!.includes("string"));
    });

    it("returns empty array for valid right", () => {
      const result = validateRelationalRight(
        { type: RelationalExpressionRight.String, value: "test" },
        "root."
      );
      assert.deepStrictEqual(result, []);
    });
  });

  describe("validateRelationalExpression", () => {
    it("returns error if type is not RELATIONAL", () => {
      const result = validateRelationalExpression(
        { type: "INVALID" } as never,
        "root."
      );
      assert.strictEqual(result.length, 1);
      assert.ok(result[0]!.includes("root.type"));
      assert.ok(result[0]!.includes(ExpressionType.Relational));
    });

    it("returns error if op is not a valid relational operator", () => {
      const result = validateRelationalExpression(
        {
          type: ExpressionType.Relational,
          op: "INVALID",
          left: { type: RelationalExpressionLeft.Article, value: "title" },
          right: { type: RelationalExpressionRight.String, value: "test" },
        } as never,
        "root."
      );
      assert.strictEqual(result.length, 1);
      assert.ok(result[0]!.includes("root.op"));
    });

    it("returns left error for invalid left value", () => {
      const result = validateRelationalExpression(
        {
          type: ExpressionType.Relational,
          op: RelationalExpressionOperator.Eq,
          left: "invalid",
          right: { type: RelationalExpressionRight.String, value: "test" },
        } as never,
        "root."
      );
      assert.strictEqual(result.length, 1);
      assert.ok(result[0]!.includes("root.left"));
      assert.ok(result[0]!.includes("object"));
    });

    it("returns right error for invalid right value", () => {
      const result = validateRelationalExpression(
        {
          type: ExpressionType.Relational,
          op: RelationalExpressionOperator.Eq,
          left: { type: RelationalExpressionLeft.Article, value: "title" },
          right: "invalid",
        } as never,
        "root."
      );
      assert.strictEqual(result.length, 1);
      assert.ok(result[0]!.includes("root.right"));
      assert.ok(result[0]!.includes("object"));
    });

    it("returns empty array for valid relational expression", () => {
      const result = validateRelationalExpression(
        {
          type: ExpressionType.Relational,
          op: RelationalExpressionOperator.Eq,
          left: { type: RelationalExpressionLeft.Article, value: "title" },
          right: { type: RelationalExpressionRight.String, value: "test" },
        },
        "root."
      );
      assert.deepStrictEqual(result, []);
    });
  });

  describe("validateLogicalExpression", () => {
    it("returns error if input is not an object", () => {
      const result = validateLogicalExpression("not-object" as never, "root.");
      assert.strictEqual(result.length, 1);
      assert.ok(result[0]!.includes("root."));
      assert.ok(result[0]!.includes("object"));
    });

    it("returns error if type is not LOGICAL", () => {
      const result = validateLogicalExpression(
        { type: "INVALID" } as never,
        "root."
      );
      assert.strictEqual(result.length, 1);
      assert.ok(result[0]!.includes("root.type"));
      assert.ok(result[0]!.includes(ExpressionType.Logical));
    });

    it("returns error if op is not a valid logical operator", () => {
      const result = validateLogicalExpression(
        {
          type: ExpressionType.Logical,
          op: "INVALID",
          children: [],
        } as never,
        "root."
      );
      assert.strictEqual(result.length, 1);
      assert.ok(result[0]!.includes("root.op"));
    });

    it("returns error if children is not an array", () => {
      const result = validateLogicalExpression(
        {
          type: ExpressionType.Logical,
          op: LogicalExpressionOperator.And,
          children: "not-array",
        } as never,
        "root."
      );
      assert.strictEqual(result.length, 1);
      assert.ok(result[0]!.includes("root.children"));
      assert.ok(result[0]!.includes("array"));
    });

    it("returns error if a child has an invalid type", () => {
      const result = validateLogicalExpression(
        {
          type: ExpressionType.Logical,
          op: LogicalExpressionOperator.And,
          children: [{ type: "INVALID" }],
        } as never,
        "root."
      );
      assert.strictEqual(result.length, 1);
      assert.ok(result[0]!.includes("root.children[0].type"));
    });

    it("validates nested relational expressions", () => {
      const result = validateLogicalExpression(
        {
          type: ExpressionType.Logical,
          op: LogicalExpressionOperator.And,
          children: [
            {
              type: ExpressionType.Relational,
              op: "INVALID",
              left: { type: RelationalExpressionLeft.Article, value: "title" },
              right: { type: RelationalExpressionRight.String, value: "test" },
            },
          ],
        } as never,
        "root."
      );
      assert.strictEqual(result.length, 1);
      assert.ok(result[0]!.includes("root.children[0].op"));
    });

    it("validates deeply nested logical expressions", () => {
      const result = validateLogicalExpression(
        {
          type: ExpressionType.Logical,
          op: LogicalExpressionOperator.And,
          children: [
            {
              type: ExpressionType.Logical,
              op: LogicalExpressionOperator.Or,
              children: [
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: { type: "INVALID", value: "title" },
                  right: {
                    type: RelationalExpressionRight.String,
                    value: "test",
                  },
                },
              ],
            },
          ],
        } as never,
        "root."
      );
      assert.strictEqual(result.length, 1);
      assert.ok(result[0]!.includes("root.children[0].children[0].left.type"));
    });

    it("returns error when depth exceeds 10 levels", () => {
      // Create a deeply nested structure (11 levels)
      const createNestedLogical = (depth: number): Record<string, unknown> => {
        if (depth === 0) {
          return {
            type: ExpressionType.Logical,
            op: LogicalExpressionOperator.And,
            children: [
              {
                type: ExpressionType.Relational,
                op: RelationalExpressionOperator.Eq,
                left: {
                  type: RelationalExpressionLeft.Article,
                  value: "title",
                },
                right: { type: RelationalExpressionRight.String, value: "x" },
              },
            ],
          };
        }
        return {
          type: ExpressionType.Logical,
          op: LogicalExpressionOperator.And,
          children: [createNestedLogical(depth - 1)],
        };
      };

      const deeplyNested = createNestedLogical(11);
      const result = validateLogicalExpression(deeplyNested, "root.");
      assert.ok(result.length > 0);
      assert.ok(result[0]!.includes("Depth"));
    });

    it("returns empty array for valid logical expression", () => {
      const result = validateLogicalExpression(
        {
          type: ExpressionType.Logical,
          op: LogicalExpressionOperator.And,
          children: [
            {
              type: ExpressionType.Relational,
              op: RelationalExpressionOperator.Eq,
              left: { type: RelationalExpressionLeft.Article, value: "title" },
              right: { type: RelationalExpressionRight.String, value: "test" },
            },
          ],
        },
        "root."
      );
      assert.deepStrictEqual(result, []);
    });

    it("collects multiple errors from different children", () => {
      const result = validateLogicalExpression(
        {
          type: ExpressionType.Logical,
          op: LogicalExpressionOperator.And,
          children: [
            {
              type: ExpressionType.Relational,
              op: RelationalExpressionOperator.Eq,
              left: { type: "INVALID", value: "title" },
              right: { type: RelationalExpressionRight.String, value: "test" },
            },
            {
              type: ExpressionType.Relational,
              op: RelationalExpressionOperator.Eq,
              left: { type: RelationalExpressionLeft.Article, value: "title" },
              right: { type: "INVALID", value: "test" },
            },
          ],
        } as never,
        "root."
      );
      assert.strictEqual(result.length, 2);
      assert.ok(
        result.some((e: string) => e.includes("root.children[0].left"))
      );
      assert.ok(
        result.some((e: string) => e.includes("root.children[1].right"))
      );
    });

    it("handles exactly 10 levels of nesting without error", () => {
      const createNestedLogical = (depth: number): Record<string, unknown> => {
        if (depth === 0) {
          return {
            type: ExpressionType.Logical,
            op: LogicalExpressionOperator.And,
            children: [
              {
                type: ExpressionType.Relational,
                op: RelationalExpressionOperator.Eq,
                left: {
                  type: RelationalExpressionLeft.Article,
                  value: "title",
                },
                right: { type: RelationalExpressionRight.String, value: "x" },
              },
            ],
          };
        }
        return {
          type: ExpressionType.Logical,
          op: LogicalExpressionOperator.And,
          children: [createNestedLogical(depth - 1)],
        };
      };

      const tenLevels = createNestedLogical(9); // 0-9 = 10 levels
      const result = validateLogicalExpression(tenLevels, "root.");
      assert.deepStrictEqual(result, []);
    });

    it("validates complex OR expression with multiple children", () => {
      const result = validateLogicalExpression(
        {
          type: ExpressionType.Logical,
          op: LogicalExpressionOperator.Or,
          children: [
            {
              type: ExpressionType.Relational,
              op: RelationalExpressionOperator.Contains,
              left: { type: RelationalExpressionLeft.Article, value: "title" },
              right: { type: RelationalExpressionRight.String, value: "foo" },
            },
            {
              type: ExpressionType.Relational,
              op: RelationalExpressionOperator.Matches,
              left: {
                type: RelationalExpressionLeft.Article,
                value: "description",
              },
              right: { type: RelationalExpressionRight.String, value: "bar.*" },
            },
          ],
        },
        "root."
      );
      assert.deepStrictEqual(result, []);
    });
  });
});
