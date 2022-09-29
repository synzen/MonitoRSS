import { useState } from 'react';
import { cloneDeep } from 'lodash';
import {
  LogicalFilterExpression,
} from '../../types';
import { LogicalExpressionForm } from './LogicalExpressionForm';

interface Props {
  expression: LogicalFilterExpression
}

export const FiltersForm = ({
  expression,
}: Props) => {
  const [editingExpression, setEditingExpression] = useState(cloneDeep(expression));

  const onDeletedExpression = () => {
    console.log('deleted');
  };

  return (
    <LogicalExpressionForm
      expression={editingExpression}
      onChange={setEditingExpression}
      onDeleted={onDeletedExpression}
    />
  );
};
