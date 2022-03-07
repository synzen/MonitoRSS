import {
  UsePaginationOptions,
  UseGlobalFiltersColumnOptions,
  UseGlobalFiltersInstanceProps,
  UseGlobalFiltersOptions,
  UseGlobalFiltersState,
} from 'react-table';

declare module 'react-table' {
  // take this file as-is, or comment out the sections that don't apply to your plugin configuration

  export interface TableOptions<D extends object = {}>
    extends UsePaginationOptions<D>,
    UseGlobalFiltersOptions<D>,
    // feature set, this is a safe default.
    Record<string, any> {}

  export interface TableInstance<D extends object = {}>
    extends UsePaginationInstanceProps<D>,
    UseGlobalFiltersInstanceProps<D> {}

  export interface TableState<D extends object = {}>
    extends UsePaginationState<D>,
    UseGlobalFiltersState<D> {}

  export interface ColumnInterface<D extends object = {}>
    extends UseGlobalFiltersColumnOptions<D> {}
}
