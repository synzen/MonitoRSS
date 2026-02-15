import {
  UsePaginationOptions,
  UseGlobalFiltersColumnOptions,
  UseGlobalFiltersInstanceProps,
  UseGlobalFiltersOptions,
  UseGlobalFiltersState,
  UseRowSelectHooks,
  UseRowSelectInstanceProps,
  UseRowSelectOptions,
  UseRowSelectRowProps,
  UseRowSelectState,
  UseSortByColumnOptions,
  UseSortByColumnProps,
  UseSortByHooks,
  UseSortByInstanceProps,
  UseSortByOptions,
  UseSortByState,
} from "react-table";

declare module "react-table" {
  // take this file as-is, or comment out the sections that don't apply to your plugin configuration

  export interface TableOptions<D extends object = {}>
    extends
      UsePaginationOptions<D>,
      UseGlobalFiltersOptions<D>,
      UseRowSelectOptions<D>,
      UseSortByOptions<D>,
      // feature set, this is a safe default.
      Record<string, any> {}

  export interface Hooks<D extends object = {}> extends UseRowSelectHooks<D>, UseSortByHooks<D> {}

  export interface TableInstance<D extends object = {}>
    extends
      UsePaginationInstanceProps<D>,
      UseRowSelectInstanceProps<D>,
      UseSortByInstanceProps<D>,
      UseGlobalFiltersInstanceProps<D> {}

  export interface TableState<D extends object = {}>
    extends
      UsePaginationState<D>,
      UseRowSelectState<D>,
      UseSortByState<D>,
      UseGlobalFiltersState<D> {}

  export interface ColumnInterface<D extends object = {}>
    extends UseGlobalFiltersColumnOptions<D>, UseSortByColumnOptions<D> {}

  export interface ColumnInstance<D extends object = {}> extends UseSortByColumnProps<D> {}

  export interface Row<D extends object = {}> extends UseRowSelectRowProps<D> {}
}
