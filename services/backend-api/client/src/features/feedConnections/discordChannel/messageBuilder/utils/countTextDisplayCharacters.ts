import { Component, ComponentType } from "../types";

const countTextDisplayCharacters = (component: Component): number => {
  const ownContent =
    component.type === ComponentType.V2TextDisplay ? (component.content?.length ?? 0) : 0;
  const children =
    "children" in component && Array.isArray(component.children) ? component.children : [];

  return (
    ownContent + children.reduce((total, child) => total + countTextDisplayCharacters(child), 0)
  );
};

export default countTextDisplayCharacters;
