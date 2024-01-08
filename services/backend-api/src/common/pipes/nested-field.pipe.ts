/* eslint-disable @typescript-eslint/no-explicit-any */
import { mixin, PipeTransform, Type } from "@nestjs/common";
import { memoize } from "lodash";

interface Options {
  transform: (input: any) => any;
}

const createNestedFieldPipe = (
  field: string,
  options?: Options
): Type<PipeTransform> => {
  class MixinNestedFieldPipe implements PipeTransform {
    transform(value: Record<string, any>) {
      const allFields = field.split(".");

      let currentField = value;

      for (const field of allFields) {
        currentField = currentField[field];
      }

      return options?.transform
        ? options.transform(currentField)
        : currentField;
    }
  }

  return mixin(MixinNestedFieldPipe);
};

export const NestedFieldPipe: (
  field: string,
  options?: Options
) => Type<PipeTransform> = memoize(createNestedFieldPipe);
