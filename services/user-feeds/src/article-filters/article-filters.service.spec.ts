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

describe("ArticleFiltersService", () => {
  let service: ArticleFiltersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ArticleFiltersService],
    }).compile();

    service = module.get<ArticleFiltersService>(ArticleFiltersService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getArticleFilterResults", () => {
    it("throws if expression is invalid", async () => {
      const expression = {
        type: "invalid",
      } as never;

      await expect(
        service.getArticleFilterResults(expression, {} as never)
      ).rejects.toThrow(InvalidExpressionException);
    });
  });

  describe("evaluateExpression", () => {
    it("throws if expression type is invalid", async () => {
      const expression = {
        type: "invalid",
      } as never;

      await expect(
        service.evaluateExpression(expression, {} as never)
      ).rejects.toThrow(InvalidExpressionException);
    });

    it("throws if logical operand is not supported", async () => {
      const expression = {
        type: ExpressionType.Logical,
        op: "not-supported" as LogicalExpressionOperator,
        children: [],
      };

      await expect(
        service.evaluateExpression(expression as never, {} as never)
      ).rejects.toThrow(InvalidExpressionException);
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

      await expect(
        service.evaluateExpression(expression as never, {
          ARTICLE: {
            id: "1",
            title: "1",
          },
        })
      ).rejects.toThrow(InvalidExpressionException);
    });

    it("throws if relational expression operator for regex operand is invalid", async () => {
      const expression: LogicalExpression = {
        type: ExpressionType.Logical,
        op: LogicalExpressionOperator.And,
        children: [
          {
            left: {
              type: RelationalExpressionLeft.Article,
              value: "title",
            },
            op: RelationalExpressionOperator.Eq,
            right: {
              type: RelationalExpressionRight.RegExp as never,
              value: "s",
            },
            type: ExpressionType.Relational,
          },
        ],
      };

      await expect(
        service.evaluateExpression(expression as never, {
          ARTICLE: {
            id: "1",
            title: "1",
          },
        })
      ).rejects.toThrow(InvalidExpressionException);
    });

    describe("relational", () => {
      it.each([
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
      ])(
        "supports Eq when expected is $expected",
        async ({ value, articleProperty, articleValue, expected }) => {
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
              id: "1",
              [articleProperty]: articleValue,
            },
          };

          await expect(
            service.evaluateExpression(expression, reference)
          ).resolves.toEqual(expected);
        }
      );

      it.each([
        { value: "s", articleValue: "s", expected: false },
        {
          value: "s",
          articleValue: "sticks",
          expected: true,
        },
      ])(
        "supports NotEq when expected is $expected",
        async ({ value, articleValue, expected }) => {
          const expression: RelationalExpression = {
            left: {
              type: RelationalExpressionLeft.Article,
              value: "title",
            },
            op: RelationalExpressionOperator.NotEq,
            right: {
              type: RelationalExpressionRight.String,
              value,
            },
            type: ExpressionType.Relational,
          };

          const reference = {
            [RelationalExpressionLeft.Article]: {
              id: "1",
              title: articleValue,
            },
          };

          await expect(
            service.evaluateExpression(expression, reference)
          ).resolves.toEqual(expected);
        }
      );

      it.each([
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
      ])(
        "supports Contains when expected is $expected",
        async ({ value, articleValue, expected }) => {
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
              id: "1",
              title: articleValue,
            },
          };

          await expect(
            service.evaluateExpression(expression, reference)
          ).resolves.toEqual(expected);
        }
      );

      it.each([
        {
          value: "s",
          articleValue: "sticks",
          expected: false,
        },
        {
          value: "s",
          articleValue: "top gun",
          expected: true,
        },
      ])(
        "supports NotContains when expected is $expected",
        async ({ value, articleValue, expected }) => {
          const expression: RelationalExpression = {
            left: {
              type: RelationalExpressionLeft.Article,
              value: "title",
            },
            op: RelationalExpressionOperator.NotContain,
            right: {
              type: RelationalExpressionRight.String,
              value: value,
            },
            type: ExpressionType.Relational,
          };

          const reference = {
            [RelationalExpressionLeft.Article]: {
              id: "1",
              title: articleValue,
            },
          };

          await expect(
            service.evaluateExpression(expression, reference)
          ).resolves.toEqual(expected);
        }
      );

      it.each([
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
      ])(
        "supports Matches when expected is $expected",
        async ({ articleValue, expected, value }) => {
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
              id: "1",
              title: articleValue,
            },
          };

          await expect(
            service.evaluateExpression(expression, reference)
          ).resolves.toEqual(expected);
        }
      );
    });

    describe("AND operand", () => {
      it("returns true correctly with 1 child", async () => {
        await expect(
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
                id: "1",
                title: "a",
              },
            }
          )
        ).resolves.toBe(true);
      });

      it("returns true correctly with 2 children", async () => {
        await expect(
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
                id: "1",
                title: "a",
                description: "b",
              },
            }
          )
        ).resolves.toBe(true);
      });

      it("returns false correctly", async () => {
        await expect(
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
                id: "1",
                title: "a",
                description: "b",
              },
            }
          )
        ).resolves.toBe(false);
      });
    });

    describe("OR operand", () => {
      it("returns true correctly", async () => {
        await expect(
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
                id: "1",
                title: "a",
                description: "b",
              },
            }
          )
        ).resolves.toBe(true);
      });

      it("returns false correctly", async () => {
        await expect(
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
                id: "1",
                title: "a",
                description: "b",
              },
            }
          )
        ).resolves.toBe(false);
      });

      it("returns false if reference contains no value", async () => {
        await expect(
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
                id: "1",
              },
            }
          )
        ).resolves.toBe(false);
      });

      it("returns false if reference object does not exist", async () => {
        await expect(
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
          )
        ).resolves.toBe(false);
      });
    });

    describe("NOT operand", () => {
      it("returns true correctly", async () => {
        await expect(
          service.evaluateExpression(
            {
              type: ExpressionType.Logical,
              op: LogicalExpressionOperator.Not,
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
              ],
            },
            {
              ARTICLE: {
                id: "1",
                title: "a",
              },
            }
          )
        ).resolves.toBe(true);
      });

      it("returns false correctly", async () => {
        await expect(
          service.evaluateExpression(
            {
              type: ExpressionType.Logical,
              op: LogicalExpressionOperator.Not,
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
                id: "1",
                title: "a",
                description: "b",
              },
            }
          )
        ).resolves.toBe(false);
      });
    });
  });
});
