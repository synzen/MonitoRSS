import {
  Component,
  ComponentType,
  LegacyMessageComponentRoot,
  MessageComponentRoot,
} from "../types";

export type SharedRootFields = Omit<
  LegacyMessageComponentRoot,
  "type" | "id" | "name" | "children"
>;

type UpdateRootFieldAction = {
  [K in keyof SharedRootFields]-?: {
    type: "UPDATE_ROOT_FIELD";
    field: K;
    value: SharedRootFields[K];
  };
}[keyof SharedRootFields];

export type MessageBuilderAction =
  | { type: "ADD_COMPONENT"; parentId: string; childType: ComponentType; isAccessory?: boolean }
  | { type: "DELETE_COMPONENT"; componentId: string }
  | { type: "MOVE_COMPONENT_UP"; componentId: string }
  | { type: "MOVE_COMPONENT_DOWN"; componentId: string }
  | { type: "UPDATE_COMPONENT"; componentId: string; component: Component }
  | UpdateRootFieldAction
  | { type: "SWITCH_ROOT_TYPE"; targetType: ComponentType.LegacyRoot | ComponentType.V2Root }
  | { type: "SET_MESSAGE_COMPONENT"; messageComponent: MessageComponentRoot }
  | { type: "RESET"; snapshot: MessageComponentRoot | undefined };

export interface MessageBuilderReducerState {
  messageComponent: MessageComponentRoot | undefined;
}
