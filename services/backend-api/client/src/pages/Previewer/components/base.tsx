import { v4 as uuidv4 } from "uuid";
import { FieldError, FieldErrors } from "react-hook-form";
import { IconType } from "react-icons/lib";
import { DiscordComponentType } from "../constants/DiscordComponentType";
import PreviewerFormState from "../types/PreviewerFormState";

const getNestedError = (obj: any, path: string) => {
  return path.split(".").reduce((current, key) => {
    return current && current[key];
  }, obj);
};

const ROOT_COMPONENTS_TYPES = [DiscordComponentType.LegacyRoot, DiscordComponentType.V2Root];

abstract class MessageBuilderComponent<T extends object = {}> {
  id: string = uuidv4();

  abstract type: DiscordComponentType;

  abstract icon: IconType;

  abstract label: string;

  children?: MessageBuilderComponent[];

  data?: T;

  constructor(children?: MessageBuilderComponent[], data?: T) {
    this.children = children;
    this.data = data;
  }

  setChildren(children: MessageBuilderComponent[] | undefined) {
    this.children = children;
  }

  clone(overrideData?: T): MessageBuilderComponent<T> {
    const useData = overrideData || this.data;

    return new (this.constructor as new (
      children?: MessageBuilderComponent[],
      data?: T
    ) => MessageBuilderComponent<T>)(
      this.children?.map((child) => child.clone()),
      useData
    );
  }

  isRoot() {
    return ROOT_COMPONENTS_TYPES.includes(this.type);
  }

  getFieldErrorFromFormErrors(
    rootComponent: MessageBuilderComponent | undefined,
    errors: FieldErrors<PreviewerFormState>,
    fieldNames: string[]
  ): (FieldError | undefined)[] | undefined {
    if (!rootComponent) return undefined;

    const stack: {
      component: MessageBuilderComponent;
      path: string;
    }[] = [{ component: rootComponent, path: "messageComponent" as keyof PreviewerFormState }];

    while (stack.length > 0) {
      const { component, path } = stack.pop()!;

      if (component.id === this.id) {
        const errorPath = `${path}`;
        const errorObjectWithFields = getNestedError(errors, errorPath);

        return fieldNames.map((fieldName) => errorObjectWithFields?.[fieldName]);
      }

      if (component.children) {
        for (let i = component.children.length - 1; i >= 0; i -= 1) {
          stack.push({
            component: component.children[i],
            path: `${path}.children.${i}`,
          });
        }
      }
    }

    return undefined;
  }
}

export default MessageBuilderComponent;
