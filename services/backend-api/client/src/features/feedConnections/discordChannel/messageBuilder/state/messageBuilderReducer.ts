import {
  Component,
  ComponentType,
  LegacyEmbedComponent,
  LegacyEmbedContainerComponent,
  LegacyMessageComponentRoot,
  MessageComponentRoot,
  SectionComponent,
  V2MessageComponentRoot,
} from "../types";
import createNewMessageBuilderComponent from "../utils/createNewMessageBuilderComponent";
import {
  MessageBuilderAction,
  MessageBuilderReducerState,
  SharedRootFields,
} from "./messageBuilderActions";

function updateInTree(
  root: Component,
  targetId: string,
  updater: (c: Component) => Component,
): Component {
  if (root.id === targetId) {
    return updater(root);
  }

  if (root.type === ComponentType.V2Section) {
    const section = root as SectionComponent;

    if (section.accessory?.id === targetId) {
      return { ...section, accessory: updater(section.accessory) } as Component;
    }
  }

  if (root.children) {
    const newChildren = root.children.map((child) => updateInTree(child, targetId, updater));
    const changed = newChildren.some((child, i) => child !== root.children![i]);

    if (changed) {
      return { ...root, children: newChildren } as Component;
    }
  }

  return root;
}

function removeFromTree(component: Component, targetId: string): Component | null {
  if (component.type === ComponentType.V2Section) {
    const section = component as SectionComponent;

    if (section.accessory?.id === targetId) {
      return { ...section, accessory: undefined } as unknown as Component;
    }
  }

  if (component.children) {
    const newChildren = component.children
      .filter((child) => child.id !== targetId)
      .map((child) => removeFromTree(child, targetId))
      .filter((child): child is Component => child !== null);

    return { ...component, children: newChildren } as Component;
  }

  return component.id === targetId ? null : component;
}

function addComponentToParent(
  component: Component,
  parentId: string,
  childType: ComponentType,
  isAccessory: boolean,
): Component {
  if (component.id === parentId) {
    if (isAccessory && component.type === ComponentType.V2Section) {
      const newAccessory = createNewMessageBuilderComponent(childType, `${parentId}-accessory`, 0);

      return { ...component, accessory: newAccessory } as Component;
    }

    let indexToAddAt = component.children?.length || 0;
    let newComponent: Component;

    if (childType === ComponentType.LegacyEmbedContainer) {
      newComponent = createNewMessageBuilderComponent(
        childType,
        parentId,
        0,
      ) as LegacyEmbedContainerComponent;

      indexToAddAt = 1;
      const childEmbed = createNewMessageBuilderComponent(
        ComponentType.LegacyEmbed,
        newComponent.id,
        0,
      ) as LegacyEmbedComponent;
      (newComponent as LegacyEmbedContainerComponent).children = [childEmbed];
    } else if (childType === ComponentType.LegacyText) {
      newComponent = createNewMessageBuilderComponent(childType, parentId, 0);
      indexToAddAt = 0;
    } else {
      newComponent = createNewMessageBuilderComponent(childType, parentId, indexToAddAt);
    }

    const childrenClone = [...(component.children || [])];
    childrenClone.splice(indexToAddAt, 0, newComponent);

    return { ...component, children: childrenClone } as Component;
  }

  if (component.children) {
    const newChildren = component.children.map((child) =>
      addComponentToParent(child, parentId, childType, isAccessory),
    );
    const changed = newChildren.some((child, i) => child !== component.children![i]);

    if (changed) {
      return { ...component, children: newChildren } as Component;
    }
  }

  return component;
}

function moveInTree(component: Component, targetId: string, direction: -1 | 1): Component {
  if (component.children) {
    const childIndex = component.children.findIndex((child) => child.id === targetId);

    if (childIndex >= 0) {
      const swapIndex = childIndex + direction;

      if (swapIndex >= 0 && swapIndex < component.children.length) {
        const newChildren = [...component.children];
        [newChildren[childIndex], newChildren[swapIndex]] = [
          newChildren[swapIndex],
          newChildren[childIndex],
        ];

        return { ...component, children: newChildren } as Component;
      }

      return component;
    }

    const newChildren = component.children.map((child) => moveInTree(child, targetId, direction));
    const changed = newChildren.some((child, i) => child !== component.children![i]);

    if (changed) {
      return { ...component, children: newChildren } as Component;
    }
  }

  return component;
}

const SHARED_ROOT_FIELDS: (keyof SharedRootFields)[] = [
  "formatTables",
  "stripImages",
  "ignoreNewLines",
  "enablePlaceholderFallback",
  "forumThreadTitle",
  "forumThreadTags",
  "isForumChannel",
  "channelNewThreadTitle",
  "channelNewThreadExcludesPreview",
  "mentions",
  "placeholderLimits",
];

export function messageBuilderReducer(
  state: MessageBuilderReducerState,
  action: MessageBuilderAction,
): MessageBuilderReducerState {
  switch (action.type) {
    case "SET_MESSAGE_COMPONENT":
      return { messageComponent: action.messageComponent };

    case "RESET":
      return { messageComponent: action.snapshot };

    case "ADD_COMPONENT": {
      if (!state.messageComponent) return state;

      const updated = addComponentToParent(
        state.messageComponent,
        action.parentId,
        action.childType,
        action.isAccessory || false,
      );

      return { messageComponent: updated as MessageComponentRoot };
    }

    case "DELETE_COMPONENT": {
      if (!state.messageComponent) return state;
      if (action.componentId === state.messageComponent.id) return state;

      const updated = removeFromTree(state.messageComponent, action.componentId);

      return { messageComponent: updated as MessageComponentRoot };
    }

    case "MOVE_COMPONENT_UP": {
      if (!state.messageComponent) return state;

      const updated = moveInTree(state.messageComponent, action.componentId, -1);

      if (updated === state.messageComponent) return state;

      return { messageComponent: updated as MessageComponentRoot };
    }

    case "MOVE_COMPONENT_DOWN": {
      if (!state.messageComponent) return state;

      const updated = moveInTree(state.messageComponent, action.componentId, 1);

      if (updated === state.messageComponent) return state;

      return { messageComponent: updated as MessageComponentRoot };
    }

    case "UPDATE_COMPONENT": {
      if (!state.messageComponent) return state;

      const updated = updateInTree(
        state.messageComponent,
        action.componentId,
        () => action.component,
      );

      if (updated === state.messageComponent) return state;

      return { messageComponent: updated as MessageComponentRoot };
    }

    case "UPDATE_ROOT_FIELD": {
      if (!state.messageComponent) return state;

      return {
        messageComponent: {
          ...state.messageComponent,
          [action.field]: action.value,
        } as MessageComponentRoot,
      };
    }

    case "SWITCH_ROOT_TYPE": {
      if (!state.messageComponent) return state;
      if (state.messageComponent.type === action.targetType) return state;

      const sharedProperties: Record<string, any> = {};

      for (const field of SHARED_ROOT_FIELDS) {
        sharedProperties[field] = (state.messageComponent as any)[field];
      }

      const base = createNewMessageBuilderComponent(action.targetType, "", 0);

      const newRoot: MessageComponentRoot = {
        ...base,
        ...sharedProperties,
        children: [],
      } as unknown as MessageComponentRoot;

      if (action.targetType === ComponentType.LegacyRoot) {
        (newRoot as LegacyMessageComponentRoot).type = ComponentType.LegacyRoot;
      } else {
        (newRoot as V2MessageComponentRoot).type = ComponentType.V2Root;
      }

      return { messageComponent: newRoot };
    }

    default:
      return state;
  }
}
