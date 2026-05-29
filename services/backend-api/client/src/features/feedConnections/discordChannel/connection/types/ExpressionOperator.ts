export enum RelationalExpressionOperator {
  Equals = "EQ",
  Contains = "CONTAINS",
  NotContain = "NOT_CONTAIN",
  NotEqual = "NOT_EQ",
  Matches = "MATCHES",
}

export enum RelationalExpressionLeftOperandType {
  Article = "ARTICLE",
}

export enum RelationalExpressionRightOperandType {
  String = "STRING",
}

export enum LogicalExpressionOperator {
  And = "AND",
  Or = "OR",
}
