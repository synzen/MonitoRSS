export enum RelationalExpressionOperator {
  Equals = 'EQ',
  Contains = 'CONTAINS',
  Matches = 'MATCHES',
}

export enum RelationalExpressionLeftOperandType {
  Article = 'ARTICLE',
}

export enum RelationalExpressionRightOperandType {
  String = 'STRING',
  RegExp = 'REGEXP',
}

export enum LogicalExpressionOperator {
  And = 'AND',
  Or = 'OR',
}
