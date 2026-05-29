import { FieldError, FieldErrors } from "react-hook-form";
import { Component, ComponentType } from "../types";

const getNestedError = (obj: any, path: string) => {
  return path.split(".").reduce((current, key) => {
    return current && current[key];
  }, obj);
};

const getMessageBuilderFieldErrors = (
  errors: FieldErrors,
  messageComponent: Component | undefined,
  componentId: string,
  fieldNames: string[],
): (FieldError | undefined)[] => {
  if (!messageComponent) return fieldNames.map(() => undefined);

  interface StackItem {
    component: Component;
    path: string;
  }

  const stack: StackItem[] = [{ component: messageComponent, path: "messageComponent" }];

  while (stack.length > 0) {
    const { component, path } = stack.pop()!;

    if (component.id === componentId) {
      const objectOfErrors = getNestedError(errors, path);

      return fieldNames.map((fieldName) => objectOfErrors?.[fieldName]);
    }

    if (component.children) {
      for (let i = component.children.length - 1; i >= 0; i -= 1) {
        stack.push({
          component: component.children[i],
          path: `${path}.children.${i}`,
        });
      }
    }

    if (component.type === ComponentType.V2Section && component.accessory) {
      stack.push({
        component: component.accessory,
        path: `${path}.accessory`,
      });
    }
  }

  return fieldNames.map(() => undefined);
};

export default getMessageBuilderFieldErrors;
