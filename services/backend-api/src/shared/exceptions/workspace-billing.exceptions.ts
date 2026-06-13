import { StandardException } from "./standard.exception";

// A workspace billing endpoint was called on an instance without Paddle
// configured (self-host posture: workspaces are free and fully active).
export class WorkspaceBillingNotConfiguredException extends StandardException {}

// A workspace subscription change referenced a price that does not belong to
// a workspace-capable product (Tier 2 / Tier 3 / the additional-feed add-on).
export class InvalidWorkspaceTierException extends StandardException {}
