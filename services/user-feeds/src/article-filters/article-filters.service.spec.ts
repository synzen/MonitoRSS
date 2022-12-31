import { Test, TestingModule } from "@nestjs/testing";
import { ArticleFiltersService } from "./article-filters.service";
import { InvalidExpressionException } from "./exceptions";
import {
  ExpressionType,
  LogicalExpression,
  LogicalExpressionOperator,
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
            op: "invalid" as RelationalExpressionOperator,
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

    it("works with relationa expressions with regex right operands", async () => {
      const expression: LogicalExpression = {
        type: ExpressionType.Logical,
        op: LogicalExpressionOperator.And,
        children: [
          {
            left: {
              type: RelationalExpressionLeft.Article,
              value: "title",
            },
            op: RelationalExpressionOperator.Matches,
            right: {
              type: RelationalExpressionRight.RegExp,
              value: "other",
            },
            type: ExpressionType.Relational,
          },
        ],
      };

      await expect(
        service.evaluateExpression(expression, {
          ARTICLE: {
            id: "1",
            title: "MOTHER",
          },
        })
      ).resolves.toEqual(true);

      await expect(
        service.evaluateExpression(expression, {
          ARTICLE: {
            id: "1",
            title: "father",
          },
        })
      ).resolves.toEqual(false);
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
