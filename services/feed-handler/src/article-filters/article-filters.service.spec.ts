import { Test, TestingModule } from "@nestjs/testing";
import { ArticleFiltersService } from "./article-filters.service";
import {
  ExpressionType,
  FilterLogicalExpression,
  LogicalExpressionOperator,
  RelationalExpressionOperator,
} from "./article-filterse.constants";
import { InvalidExpressionException } from "./exceptions";

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

    it("throws if relational expression operator is invalid", async () => {
      const expression: FilterLogicalExpression = {
        type: ExpressionType.Logical,
        op: LogicalExpressionOperator.And,
        children: [
          {
            left: "article:title",
            op: "invalid" as RelationalExpressionOperator,
            right: "s",
            type: ExpressionType.Relational,
          },
        ],
      };

      await expect(
        service.evaluateExpression(expression as never, {
          article: {
            id: "1",
            title: "1",
          },
        })
      ).rejects.toThrow(InvalidExpressionException);
    });

    describe("AND operand", () => {
      it("returns true correctly", async () => {
        await expect(
          service.evaluateExpression(
            {
              type: ExpressionType.Logical,
              op: LogicalExpressionOperator.And,
              children: [
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: "article:title",
                  right: "a",
                },
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: "article:description",
                  right: "b",
                },
              ],
            },
            {
              article: {
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
                  left: "article:title",
                  right: "a",
                },
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: "article:description",
                  right: "b-differnet",
                },
              ],
            },
            {
              article: {
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
                  left: "article:title",
                  right: "a-different",
                },
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: "article:description",
                  right: "b",
                },
              ],
            },
            {
              article: {
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
                  left: "article:title",
                  right: "a-different",
                },
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: "article:description",
                  right: "b-different",
                },
              ],
            },
            {
              article: {
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
                  left: "article:title",
                  right: "a-different",
                },
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: "article:description",
                  right: "b-different",
                },
              ],
            },
            {
              article: {
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
                  left: "article:title",
                  right: "a-different",
                },
                {
                  type: ExpressionType.Relational,
                  op: RelationalExpressionOperator.Eq,
                  left: "article:description",
                  right: "b-different",
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
                  left: "article:title",
                  right: "a-different",
                },
              ],
            },
            {
              article: {
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
                  left: "article:title",
                  right: "a",
                },
              ],
            },
            {
              article: {
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
