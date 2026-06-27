import { createContext, useContext } from "react";

/**
 * Breadcrumb root label for the current scope: the workspace's name in workspace
 * scope, "Personal" otherwise — but only once the user belongs to at least one
 * workspace (the same count-gate as the header switcher). Undefined means no scope
 * labeling applies, and crumbs fall back to "Feeds" so zero-workspace users see no
 * change. The value is computed in the pages layer (ScopeNavigationContainer); this
 * context stays feature-free so feature components can consume it without
 * cross-feature imports.
 */
const ScopeLabelContext = createContext<string | undefined>(undefined);

export const ScopeLabelProvider = ScopeLabelContext.Provider;

export const useScopeCrumbLabel = (): string => useContext(ScopeLabelContext) ?? "Feeds";
