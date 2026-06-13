import { StandardException } from "./standard.exception";

// A workspace billing endpoint was called on an instance without Paddle
// configured (self-host posture: workspaces are free and fully active).
export class WorkspaceBillingNotConfiguredException extends StandardException {}

// A workspace subscription change referenced a price that does not belong to
// a workspace-capable product (Tier 2 / Tier 3 / the additional-feed add-on).
export class InvalidWorkspaceTierException extends StandardException {}

// Conversion was attempted but the caller's personal plan can't fund a
// workspace: no personal subscription, or a Free / Tier 1 plan (workspace
// plans are Tier 2 / Tier 3 only).
export class PersonalSubscriptionNotConvertibleException extends StandardException {}

// Conversion was attempted onto a workspace that already has its own
// subscription (would clobber a funded team).
export class WorkspaceAlreadySubscribedException extends StandardException {}

// The selected feeds aren't all the caller's own currently-personal feeds, or
// there are more of them than the converting plan's feed limit allows.
export class InvalidConversionFeedSelectionException extends StandardException {}

// A conversion for this workspace is already in flight (its guard is live), so
// a second concurrent attempt is rejected rather than re-running the move.
export class ConversionAlreadyInProgressException extends StandardException {}
