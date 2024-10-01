import { Test, TestingModule } from "@nestjs/testing";
import { ArticleFiltersService } from "./article-filters.service";
import { InvalidExpressionException } from "./exceptions";
import {
  ExpressionType,
  LogicalExpression,
  LogicalExpressionOperator,
  RelationalExpression,
  RelationalExpressionLeft,
  RelationalExpressionOperator,
  RelationalExpressionRight,
} from "./types";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

describe("ArticleFiltersService", () => {
  let service: ArticleFiltersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ArticleFiltersService],
    }).compile();

    service = module.get<ArticleFiltersService>(ArticleFiltersService);
  });

  it("should be defined", () => {
    assert.ok(service);
  });

  describe("getArticleFilterResults", () => {
    it("throws if expression is invalid", async () => {
      const expression = {
        type: "invalid",
      } as never;

      assert.throws(
        () => service.getArticleFilterResults(expression, {} as never),
        InvalidExpressionException
      );
    });
  });

  describe("evaluateExpression", () => {
    it("throws if expression type is invalid", async () => {
      const expression = {
        type: "invalid",
      } as never;

      assert.throws(
        () => service.evaluateExpression(expression, {} as never),
        InvalidExpressionException
      );
    });

    it("throws if logical operand is not supported", async () => {
      const expression = {
        type: ExpressionType.Logical,
        op: "not-supported" as LogicalExpressionOperator,
        children: [],
      };

      assert.throws(
        () => service.evaluateExpression(expression as never, {} as never),
        InvalidExpressionException
      );
    });

    it("throws if relational expression operator for string operand is invalid", async () => {
      const expression: LogicalExpression = {
        type: ExpressionType.Logical,
        op: LogicalExpressionOperator.And,
        children: [
          {
            left: {
              type: RelationalExpressionLeft.Article,
              value: "title",
            },
            op: "invalid" as never,
            right: {
              type: RelationalExpressionRight.String as never,
              value: "s",
            },
            type: ExpressionType.Relational,
          },
        ],
      };

      assert.throws(
        () =>
          service.evaluateExpression(expression as never, {
            ARTICLE: {
              flattened: {
                id: "1",
                idHash: "1",
                title: "1",
              },
              raw: {} as never,
            },
          }),
        InvalidExpressionException
      );
    });

    describe("relational", () => {
      it("returns the inverse of the expected value when NOT is true", async () => {
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

        const reference = {
          [RelationalExpressionLeft.Article]: {
            flattened: {
              id: "1",
              idHash: "1",
              title: "s",
            },
            raw: {} as never,
          },
        };

        assert.strictEqual(
          service.evaluateExpression(expression, reference).result,
          false
        );
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

      for (const {
        value,
        articleProperty,
        articleValue,
        expected,
      } of eqTestCases) {
        it(`supports Eq when expected is ${expected}`, async () => {
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

          const reference = {
            [RelationalExpressionLeft.Article]: {
              flattened: {
                id: "1",
                idHash: "1",
                [articleProperty]: articleValue,
              },
              raw: {} as never,
            },
          };

          assert.strictEqual(
            service.evaluateExpression(expression, reference).result,
            expected
          );
        });
      }

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

      for (const { value, articleValue, expected } of containsTestCases) {
        it(`supports Contains when expected is ${expected}`, async () => {
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

          const reference = {
            [RelationalExpressionLeft.Article]: {
              flattened: {
                id: "1",
                idHash: "1",
                title: articleValue,
              },
              raw: {} as never,
            },
          };

          assert.strictEqual(
            service.evaluateExpression(expression, reference).result,
            expected
          );
        });
      }

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

      for (const { articleValue, expected, value } of matchesTestCases) {
        it(`supports Matches when expected is ${expected}`, async () => {
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

          const reference = {
            [RelationalExpressionLeft.Article]: {
              flattened: {
                id: "1",
                idHash: "1",
                title: articleValue,
              },
              raw: {} as never,
            },
          };

          assert.strictEqual(
            service.evaluateExpression(expression, reference).result,
            expected
          );
        });
      }
    });

    describe("AND operand", () => {
      it("returns true correctly with 1 child", () => {
        assert.strictEqual(
          service.evaluateExpression(
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
              ARTICLE: {
                flattened: {
                  id: "1",
                  idHash: "1",
                  title: "a",
                },
                raw: {} as never,
              },
            }
          ).result,
          true
        );
      });

      it("returns true correctly with 2 children", () => {
        assert.strictEqual(
          service.evaluateExpression(
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
              ARTICLE: {
                flattened: {
                  id: "1",
                  idHash: "1",
                  title: "a",
                  description: "b",
                },
                raw: {} as never,
              },
            }
          ).result,
          true
        );
      });

      it("returns false correctly", () => {
        assert.strictEqual(
          service.evaluateExpression(
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
              ARTICLE: {
                flattened: {
                  id: "1",
                  idHash: "1",
                  title: "a",
                  description: "b",
                },
                raw: {} as never,
              },
            }
          ).result,
          false
        );
      });
    });

    describe("OR operand", () => {
      it("returns true correctly", () => {
        assert.strictEqual(
          service.evaluateExpression(
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
              ARTICLE: {
                flattened: {
                  id: "1",
                  idHash: "1",
                  title: "a",
                  description: "b",
                },
                raw: {} as never,
              },
            }
          ).result,
          true
        );
      });

      it("returns false correctly", () => {
        assert.strictEqual(
          service.evaluateExpression(
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
              ARTICLE: {
                flattened: {
                  id: "1",
                  idHash: "1",
                  title: "a",
                  description: "b",
                },
                raw: {} as never,
              },
            }
          ).result,
          false
        );
      });

      it("returns false if reference contains no value", () => {
        assert.strictEqual(
          service.evaluateExpression(
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
              ARTICLE: {
                flattened: {
                  id: "1",
                  idHash: "1",
                },
                raw: {} as never,
              },
            }
          ).result,
          false
        );
      });

      it("returns false if reference object does not exist", () => {
        assert.strictEqual(
          service.evaluateExpression(
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
});
