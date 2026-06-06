import { describe, it, expect } from "vitest";
import {
  COMPONENT_CHILD_RULES,
  EMPTY_STATE_PROMPTS,
  getGroupCount,
  getMaxForChildType,
  getMaxTotalChildren,
  isChildRuleAtLimit,
} from "./componentChildRules";
import { Component, ComponentType, PARENT_COMPONENT_TYPES } from "../types";

const makeParent = (type: ComponentType, children: Component[] = []): Component =>
  ({ id: "p", name: type, type, children }) as Component;

const makeChild = (type: ComponentType): Component => ({ id: type, name: type, type }) as Component;

describe("COMPONENT_CHILD_RULES", () => {
  it("has exactly the parent types that PARENT_COMPONENT_TYPES declares", () => {
    const registryParents = new Set(Object.keys(COMPONENT_CHILD_RULES));
    const declaredParents = new Set<string>(PARENT_COMPONENT_TYPES);

    expect(registryParents).toEqual(declaredParents);
  });

  it("never offers a root component as a child", () => {
    for (const groups of Object.values(COMPONENT_CHILD_RULES)) {
      for (const group of groups!) {
        for (const rule of group.rules) {
          expect(rule.type).not.toBe(ComponentType.LegacyRoot);
          expect(rule.type).not.toBe(ComponentType.V2Root);
        }
      }
    }
  });

  it("uses unique menu item values across the whole registry", () => {
    const values = Object.values(COMPONENT_CHILD_RULES)
      .flat()
      .flatMap((group) => group!.rules.map((r) => r.value));

    expect(new Set(values).size).toBe(values.length);
  });
});

describe("isChildRuleAtLimit", () => {
  it("caps per-type rules independently (LegacyRoot allows one Text and one Embeds List)", () => {
    const [textRule] = COMPONENT_CHILD_RULES[ComponentType.LegacyRoot]![0].rules;
    const withText = makeParent(ComponentType.LegacyRoot, [makeChild(ComponentType.LegacyText)]);

    expect(isChildRuleAtLimit(withText, textRule)).toBe(true);

    const [, embedsGroup] = COMPONENT_CHILD_RULES[ComponentType.LegacyRoot]!;
    expect(isChildRuleAtLimit(withText, embedsGroup.rules[0])).toBe(false);
  });

  it("caps total-scope rules on the parent's whole child count", () => {
    const [rule] = COMPONENT_CHILD_RULES[ComponentType.V2ActionRow]![0].rules;
    const fullRow = makeParent(
      ComponentType.V2ActionRow,
      Array.from({ length: 5 }, () => makeChild(ComponentType.V2Button)),
    );

    expect(isChildRuleAtLimit(fullRow, rule)).toBe(true);
  });

  it("treats the Section accessory slot as full once an accessory is set", () => {
    const accessoryGroup = COMPONENT_CHILD_RULES[ComponentType.V2Section]!.find(
      (g) => g.rules[0].isAccessory,
    )!;
    const withAccessory = {
      id: "s",
      name: "Section",
      type: ComponentType.V2Section,
      children: [],
      accessory: makeChild(ComponentType.V2Thumbnail),
    } as unknown as Component;

    for (const rule of accessoryGroup.rules) {
      expect(isChildRuleAtLimit(withAccessory, rule)).toBe(true);
    }
  });
});

describe("getGroupCount", () => {
  it("counts total children for total-scope groups", () => {
    const group = COMPONENT_CHILD_RULES[ComponentType.V2Root]![0];
    const root = makeParent(ComponentType.V2Root, [
      makeChild(ComponentType.V2Section),
      makeChild(ComponentType.V2Divider),
    ]);

    expect(getGroupCount(root, group)).toBe(2);
  });

  it("counts only the matching type for per-type groups", () => {
    const actionRowGroup = COMPONENT_CHILD_RULES[ComponentType.LegacyRoot]![2];
    const root = makeParent(ComponentType.LegacyRoot, [
      makeChild(ComponentType.LegacyText),
      makeChild(ComponentType.LegacyActionRow),
    ]);

    expect(getGroupCount(root, actionRowGroup)).toBe(1);
  });
});

describe("getMaxTotalChildren", () => {
  it("returns the shared total cap for total-scope parents", () => {
    expect(getMaxTotalChildren(ComponentType.V2Root)).toBe(10);
    expect(getMaxTotalChildren(ComponentType.V2Container)).toBe(10);
    expect(getMaxTotalChildren(ComponentType.V2ActionRow)).toBe(5);
    expect(getMaxTotalChildren(ComponentType.V2Section)).toBe(3);
    expect(getMaxTotalChildren(ComponentType.V2MediaGallery)).toBe(10);
    expect(getMaxTotalChildren(ComponentType.LegacyEmbedContainer)).toBe(9);
    expect(getMaxTotalChildren(ComponentType.LegacyActionRow)).toBe(5);
  });

  it("returns null for parents capped per-type rather than by total", () => {
    expect(getMaxTotalChildren(ComponentType.LegacyRoot)).toBeNull();
    expect(getMaxTotalChildren(ComponentType.LegacyEmbed)).toBeNull();
  });
});

describe("getMaxForChildType", () => {
  it("returns the per-type cap for a declared child", () => {
    expect(getMaxForChildType(ComponentType.LegacyEmbed, ComponentType.LegacyEmbedField)).toBe(25);
    expect(getMaxForChildType(ComponentType.LegacyRoot, ComponentType.LegacyText)).toBe(1);
  });

  it("returns null for a child type the parent does not accept", () => {
    expect(getMaxForChildType(ComponentType.LegacyRoot, ComponentType.V2Button)).toBeNull();
  });
});

describe("EMPTY_STATE_PROMPTS", () => {
  it("only references parents and child types that exist in the add registry", () => {
    for (const [parentType, prompts] of Object.entries(EMPTY_STATE_PROMPTS)) {
      const allowedChildTypes = new Set(
        (COMPONENT_CHILD_RULES[parentType as ComponentType] ?? [])
          .flatMap((g) => g.rules)
          .map((r) => r.type),
      );

      for (const prompt of prompts!) {
        for (const action of prompt.actions) {
          expect(allowedChildTypes.has(action.type)).toBe(true);
        }
      }
    }
  });

  it("flags a Section that is missing both a child and an accessory", () => {
    const emptySection = {
      id: "s",
      name: "Section",
      type: ComponentType.V2Section,
      children: [],
      accessory: undefined,
    } as unknown as Component;

    const missing = EMPTY_STATE_PROMPTS[ComponentType.V2Section]!.filter((p) =>
      p.isMissing(emptySection),
    );

    expect(missing.map((p) => p.key)).toEqual(["children", "accessory"]);
  });
});
