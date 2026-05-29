import { describe, it, expect } from "vitest";
import { messageBuilderReducer } from "./messageBuilderReducer";
import { MessageBuilderReducerState } from "./messageBuilderActions";
import {
  ComponentType,
  V2MessageComponentRoot,
  TextDisplayComponent,
  ActionRowComponent,
  ButtonComponent,
  SectionComponent,
  ContainerComponent,
  LegacyMessageComponentRoot,
} from "../types";
import { DiscordButtonStyle } from "../constants/DiscordButtonStyle";

function makeTextDisplay(id: string, content = "hello"): TextDisplayComponent {
  return { id, name: "Text Display", type: ComponentType.V2TextDisplay, content };
}

function makeButton(id: string, label = "Click"): ButtonComponent {
  return {
    id,
    name: "Button",
    type: ComponentType.V2Button,
    label,
    style: DiscordButtonStyle.Link,
    disabled: false,
    href: "https://example.com",
  };
}

function makeActionRow(id: string, children: ButtonComponent[] = []): ActionRowComponent {
  return { id, name: "Action Row", type: ComponentType.V2ActionRow, children };
}

function makeSection(
  id: string,
  children: TextDisplayComponent[] = [],
  accessory?: ButtonComponent,
): SectionComponent {
  return {
    id,
    name: "Section",
    type: ComponentType.V2Section,
    children,
    accessory,
  };
}

function makeContainer(id: string, children: any[] = []): ContainerComponent {
  return {
    id,
    name: "Container",
    type: ComponentType.V2Container,
    children,
    accentColor: null,
  };
}

function makeV2Root(children: any[] = []): V2MessageComponentRoot {
  return {
    id: "root-1",
    name: "Discord Components V2",
    type: ComponentType.V2Root,
    children,
  };
}

function makeLegacyRoot(): LegacyMessageComponentRoot {
  return {
    id: "-Legacy Discord Message-0",
    name: "Legacy Discord Message",
    type: ComponentType.LegacyRoot,
    children: [],
  };
}

function stateWith(messageComponent: any): MessageBuilderReducerState {
  return { messageComponent };
}

describe("messageBuilderReducer", () => {
  describe("SET_MESSAGE_COMPONENT", () => {
    it("sets the message component from undefined", () => {
      const root = makeV2Root();
      const result = messageBuilderReducer(
        { messageComponent: undefined },
        { type: "SET_MESSAGE_COMPONENT", messageComponent: root },
      );

      expect(result.messageComponent).toBe(root);
    });

    it("replaces existing message component", () => {
      const oldRoot = makeV2Root([makeTextDisplay("td-1")]);
      const newRoot = makeV2Root([makeTextDisplay("td-2")]);
      const result = messageBuilderReducer(stateWith(oldRoot), {
        type: "SET_MESSAGE_COMPONENT",
        messageComponent: newRoot,
      });

      expect(result.messageComponent).toBe(newRoot);
    });
  });

  describe("RESET", () => {
    it("restores from snapshot", () => {
      const snapshot = makeV2Root([makeTextDisplay("td-1")]);
      const current = makeV2Root([makeTextDisplay("td-2")]);
      const result = messageBuilderReducer(stateWith(current), {
        type: "RESET",
        snapshot,
      });

      expect(result.messageComponent).toBe(snapshot);
    });

    it("sets undefined when snapshot is undefined", () => {
      const current = makeV2Root();
      const result = messageBuilderReducer(stateWith(current), {
        type: "RESET",
        snapshot: undefined,
      });

      expect(result.messageComponent).toBeUndefined();
    });
  });

  describe("ADD_COMPONENT", () => {
    it("adds a child at the end of parent children", () => {
      const root = makeV2Root([makeTextDisplay("td-1")]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "ADD_COMPONENT",
        parentId: "root-1",
        childType: ComponentType.V2TextDisplay,
      });

      expect(result.messageComponent!.children).toHaveLength(2);
      expect(result.messageComponent!.children[1].type).toBe(ComponentType.V2TextDisplay);
    });

    it("adds a container to the root", () => {
      const root = makeV2Root([makeTextDisplay("td-1")]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "ADD_COMPONENT",
        parentId: "root-1",
        childType: ComponentType.V2Container,
      });

      expect(result.messageComponent!.children).toHaveLength(2);
      expect(result.messageComponent!.children[1].type).toBe(ComponentType.V2Container);
    });

    it("adds a button to an action row", () => {
      const actionRow = makeActionRow("ar-1", [makeButton("btn-1")]);
      const root = makeV2Root([actionRow]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "ADD_COMPONENT",
        parentId: "ar-1",
        childType: ComponentType.V2Button,
      });

      const updatedRow = result.messageComponent!.children[0] as ActionRowComponent;

      expect(updatedRow.children).toHaveLength(2);
      expect(updatedRow.children[1].type).toBe(ComponentType.V2Button);
    });

    it("adds an accessory to a section when isAccessory is true", () => {
      const section = makeSection("sec-1", [makeTextDisplay("td-1")]);
      const root = makeV2Root([section]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "ADD_COMPONENT",
        parentId: "sec-1",
        childType: ComponentType.V2Button,
        isAccessory: true,
      });

      const updatedSection = result.messageComponent!.children[0] as SectionComponent;

      expect(updatedSection.accessory).toBeDefined();
      expect(updatedSection.accessory!.type).toBe(ComponentType.V2Button);
    });

    it("adds a text display as a child of section (not accessory) when isAccessory is false", () => {
      const section = makeSection("sec-1", [makeTextDisplay("td-1")]);
      const root = makeV2Root([section]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "ADD_COMPONENT",
        parentId: "sec-1",
        childType: ComponentType.V2TextDisplay,
      });

      const updatedSection = result.messageComponent!.children[0] as SectionComponent;

      expect(updatedSection.children).toHaveLength(2);
      expect(updatedSection.accessory).toBeUndefined();
    });

    it("returns unchanged state when messageComponent is undefined", () => {
      const state: MessageBuilderReducerState = { messageComponent: undefined };
      const result = messageBuilderReducer(state, {
        type: "ADD_COMPONENT",
        parentId: "root-1",
        childType: ComponentType.V2TextDisplay,
      });

      expect(result.messageComponent).toBeUndefined();
    });

    it("adds LegacyText at index 0 for legacy root", () => {
      const root = makeLegacyRoot();
      const result = messageBuilderReducer(stateWith(root), {
        type: "ADD_COMPONENT",
        parentId: root.id,
        childType: ComponentType.LegacyText,
      });

      expect(result.messageComponent!.children[0].type).toBe(ComponentType.LegacyText);
    });

    it("adds LegacyEmbedContainer at index 1 with a child embed", () => {
      const root = makeLegacyRoot();
      const result = messageBuilderReducer(stateWith(root), {
        type: "ADD_COMPONENT",
        parentId: root.id,
        childType: ComponentType.LegacyEmbedContainer,
      });

      expect(result.messageComponent!.children[0].type).toBe(ComponentType.LegacyEmbedContainer);
      expect(result.messageComponent!.children[0].children).toHaveLength(1);
      expect(result.messageComponent!.children[0].children![0].type).toBe(
        ComponentType.LegacyEmbed,
      );
    });

    it("produces a new root reference", () => {
      const root = makeV2Root([makeTextDisplay("td-1")]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "ADD_COMPONENT",
        parentId: "root-1",
        childType: ComponentType.V2TextDisplay,
      });

      expect(result.messageComponent).not.toBe(root);
    });
  });

  describe("DELETE_COMPONENT", () => {
    it("removes a direct child of root", () => {
      const td1 = makeTextDisplay("td-1");
      const td2 = makeTextDisplay("td-2");
      const root = makeV2Root([td1, td2]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "DELETE_COMPONENT",
        componentId: "td-1",
      });

      expect(result.messageComponent!.children).toHaveLength(1);
      expect(result.messageComponent!.children[0].id).toBe("td-2");
    });

    it("removes a deeply nested child", () => {
      const btn = makeButton("btn-1");
      const actionRow = makeActionRow("ar-1", [btn]);
      const container = makeContainer("c-1", [actionRow]);
      const root = makeV2Root([container]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "DELETE_COMPONENT",
        componentId: "btn-1",
      });

      const updatedRow = (result.messageComponent!.children[0] as ContainerComponent)
        .children[0] as ActionRowComponent;

      expect(updatedRow.children).toHaveLength(0);
    });

    it("removes section accessory", () => {
      const btn = makeButton("btn-acc");
      const section = makeSection("sec-1", [makeTextDisplay("td-1")], btn);
      const root = makeV2Root([section]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "DELETE_COMPONENT",
        componentId: "btn-acc",
      });

      const updatedSection = result.messageComponent!.children[0] as SectionComponent;

      expect(updatedSection.accessory).toBeUndefined();
    });

    it("does not delete the root component", () => {
      const root = makeV2Root([makeTextDisplay("td-1")]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "DELETE_COMPONENT",
        componentId: "root-1",
      });

      expect(result.messageComponent!.id).toBe("root-1");
      expect(result.messageComponent!.children).toHaveLength(1);
    });

    it("returns unchanged state when messageComponent is undefined", () => {
      const result = messageBuilderReducer(
        { messageComponent: undefined },
        { type: "DELETE_COMPONENT", componentId: "x" },
      );

      expect(result.messageComponent).toBeUndefined();
    });

    it("produces a new root reference", () => {
      const root = makeV2Root([makeTextDisplay("td-1"), makeTextDisplay("td-2")]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "DELETE_COMPONENT",
        componentId: "td-1",
      });

      expect(result.messageComponent).not.toBe(root);
    });
  });

  describe("MOVE_COMPONENT_UP", () => {
    it("swaps a component with its previous sibling", () => {
      const td1 = makeTextDisplay("td-1", "first");
      const td2 = makeTextDisplay("td-2", "second");
      const root = makeV2Root([td1, td2]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "MOVE_COMPONENT_UP",
        componentId: "td-2",
      });

      expect(result.messageComponent!.children[0].id).toBe("td-2");
      expect(result.messageComponent!.children[1].id).toBe("td-1");
    });

    it("does nothing when component is already first", () => {
      const td1 = makeTextDisplay("td-1");
      const td2 = makeTextDisplay("td-2");
      const root = makeV2Root([td1, td2]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "MOVE_COMPONENT_UP",
        componentId: "td-1",
      });

      expect(result.messageComponent!.children[0].id).toBe("td-1");
      expect(result.messageComponent!.children[1].id).toBe("td-2");
    });

    it("moves a deeply nested child up", () => {
      const btn1 = makeButton("btn-1");
      const btn2 = makeButton("btn-2");
      const actionRow = makeActionRow("ar-1", [btn1, btn2]);
      const root = makeV2Root([actionRow]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "MOVE_COMPONENT_UP",
        componentId: "btn-2",
      });

      const updatedRow = result.messageComponent!.children[0] as ActionRowComponent;

      expect(updatedRow.children[0].id).toBe("btn-2");
      expect(updatedRow.children[1].id).toBe("btn-1");
    });

    it("returns unchanged state when messageComponent is undefined", () => {
      const result = messageBuilderReducer(
        { messageComponent: undefined },
        { type: "MOVE_COMPONENT_UP", componentId: "x" },
      );

      expect(result.messageComponent).toBeUndefined();
    });
  });

  describe("MOVE_COMPONENT_DOWN", () => {
    it("swaps a component with its next sibling", () => {
      const td1 = makeTextDisplay("td-1", "first");
      const td2 = makeTextDisplay("td-2", "second");
      const root = makeV2Root([td1, td2]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "MOVE_COMPONENT_DOWN",
        componentId: "td-1",
      });

      expect(result.messageComponent!.children[0].id).toBe("td-2");
      expect(result.messageComponent!.children[1].id).toBe("td-1");
    });

    it("does nothing when component is already last", () => {
      const td1 = makeTextDisplay("td-1");
      const td2 = makeTextDisplay("td-2");
      const root = makeV2Root([td1, td2]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "MOVE_COMPONENT_DOWN",
        componentId: "td-2",
      });

      expect(result.messageComponent!.children[0].id).toBe("td-1");
      expect(result.messageComponent!.children[1].id).toBe("td-2");
    });

    it("moves a deeply nested child down", () => {
      const btn1 = makeButton("btn-1");
      const btn2 = makeButton("btn-2");
      const actionRow = makeActionRow("ar-1", [btn1, btn2]);
      const root = makeV2Root([actionRow]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "MOVE_COMPONENT_DOWN",
        componentId: "btn-1",
      });

      const updatedRow = result.messageComponent!.children[0] as ActionRowComponent;

      expect(updatedRow.children[0].id).toBe("btn-2");
      expect(updatedRow.children[1].id).toBe("btn-1");
    });
  });

  describe("UPDATE_COMPONENT", () => {
    it("updates a direct child of root", () => {
      const td1 = makeTextDisplay("td-1", "original");
      const root = makeV2Root([td1]);
      const updated = makeTextDisplay("td-1", "changed");
      const result = messageBuilderReducer(stateWith(root), {
        type: "UPDATE_COMPONENT",
        componentId: "td-1",
        component: updated,
      });

      expect((result.messageComponent!.children[0] as TextDisplayComponent).content).toBe(
        "changed",
      );
    });

    it("updates a deeply nested child", () => {
      const btn = makeButton("btn-1", "original");
      const actionRow = makeActionRow("ar-1", [btn]);
      const root = makeV2Root([actionRow]);
      const updatedBtn = makeButton("btn-1", "changed");
      const result = messageBuilderReducer(stateWith(root), {
        type: "UPDATE_COMPONENT",
        componentId: "btn-1",
        component: updatedBtn,
      });

      const updatedRow = result.messageComponent!.children[0] as ActionRowComponent;

      expect(updatedRow.children[0].label).toBe("changed");
    });

    it("updates a section accessory", () => {
      const btn = makeButton("btn-acc", "original");
      const section = makeSection("sec-1", [makeTextDisplay("td-1")], btn);
      const root = makeV2Root([section]);
      const updatedBtn = makeButton("btn-acc", "changed");
      const result = messageBuilderReducer(stateWith(root), {
        type: "UPDATE_COMPONENT",
        componentId: "btn-acc",
        component: updatedBtn,
      });

      const updatedSection = result.messageComponent!.children[0] as SectionComponent;

      expect((updatedSection.accessory as ButtonComponent).label).toBe("changed");
    });

    it("does nothing if componentId not found", () => {
      const root = makeV2Root([makeTextDisplay("td-1")]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "UPDATE_COMPONENT",
        componentId: "nonexistent",
        component: makeTextDisplay("nonexistent"),
      });

      expect(result.messageComponent!.children).toHaveLength(1);
      expect(result.messageComponent!.children[0].id).toBe("td-1");
    });

    it("produces a new root reference", () => {
      const root = makeV2Root([makeTextDisplay("td-1")]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "UPDATE_COMPONENT",
        componentId: "td-1",
        component: makeTextDisplay("td-1", "changed"),
      });

      expect(result.messageComponent).not.toBe(root);
    });
  });

  describe("UPDATE_ROOT_FIELD", () => {
    it("updates a root-level boolean field", () => {
      const root = makeV2Root();
      const result = messageBuilderReducer(stateWith(root), {
        type: "UPDATE_ROOT_FIELD",
        field: "formatTables",
        value: true,
      });

      expect((result.messageComponent as V2MessageComponentRoot).formatTables).toBe(true);
    });

    it("updates a root-level string field", () => {
      const root = makeV2Root();
      const result = messageBuilderReducer(stateWith(root), {
        type: "UPDATE_ROOT_FIELD",
        field: "forumThreadTitle",
        value: "My Thread",
      });

      expect((result.messageComponent as V2MessageComponentRoot).forumThreadTitle).toBe(
        "My Thread",
      );
    });

    it("returns unchanged state when messageComponent is undefined", () => {
      const result = messageBuilderReducer(
        { messageComponent: undefined },
        { type: "UPDATE_ROOT_FIELD", field: "formatTables", value: true },
      );

      expect(result.messageComponent).toBeUndefined();
    });

    it("produces a new root reference", () => {
      const root = makeV2Root();
      const result = messageBuilderReducer(stateWith(root), {
        type: "UPDATE_ROOT_FIELD",
        field: "formatTables",
        value: true,
      });

      expect(result.messageComponent).not.toBe(root);
    });
  });

  describe("SWITCH_ROOT_TYPE", () => {
    it("switches from V2 to Legacy preserving shared properties", () => {
      const root: V2MessageComponentRoot = {
        ...makeV2Root([makeTextDisplay("td-1")]),
        formatTables: true,
        forumThreadTitle: "test-title",
      };
      const result = messageBuilderReducer(stateWith(root), {
        type: "SWITCH_ROOT_TYPE",
        targetType: ComponentType.LegacyRoot,
      });

      expect(result.messageComponent!.type).toBe(ComponentType.LegacyRoot);
      expect((result.messageComponent as LegacyMessageComponentRoot).formatTables).toBe(true);
      expect((result.messageComponent as LegacyMessageComponentRoot).forumThreadTitle).toBe(
        "test-title",
      );
      expect(result.messageComponent!.children).toHaveLength(0);
    });

    it("switches from Legacy to V2 preserving shared properties", () => {
      const root: LegacyMessageComponentRoot = {
        ...makeLegacyRoot(),
        stripImages: true,
        ignoreNewLines: true,
      };
      const result = messageBuilderReducer(stateWith(root), {
        type: "SWITCH_ROOT_TYPE",
        targetType: ComponentType.V2Root,
      });

      expect(result.messageComponent!.type).toBe(ComponentType.V2Root);
      expect((result.messageComponent as V2MessageComponentRoot).stripImages).toBe(true);
      expect((result.messageComponent as V2MessageComponentRoot).ignoreNewLines).toBe(true);
      expect(result.messageComponent!.children).toHaveLength(0);
    });

    it("does nothing when already the target type", () => {
      const root = makeV2Root([makeTextDisplay("td-1")]);
      const result = messageBuilderReducer(stateWith(root), {
        type: "SWITCH_ROOT_TYPE",
        targetType: ComponentType.V2Root,
      });

      expect(result.messageComponent).toBe(root);
    });

    it("returns unchanged state when messageComponent is undefined", () => {
      const result = messageBuilderReducer(
        { messageComponent: undefined },
        { type: "SWITCH_ROOT_TYPE", targetType: ComponentType.V2Root },
      );

      expect(result.messageComponent).toBeUndefined();
    });
  });
});
