export enum RelationalExpressionOperator {
  Equals = 'eq',
  Contains = 'contains',
  Matches = 'matches',
}

export enum RelationalExpressionLeftOperandType {
  Article = 'article',
}

export enum RelationalExpressionRightOperandType {
  String = 'string',
  RegExp = 'regexp',
}

export enum LogicalExpressionOperator {
  And = 'and',
  Or = 'or',
}
