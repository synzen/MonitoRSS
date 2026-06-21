// Coarse capacity detents for the workspace slider (DECIDED). The underlying
// add-on is 1-feed granular, so every detent maps to a real purchasable item set
// (base tier + add-on quantity); the detents are a legibility choice, not a
// billing constraint. The slider is driven by the INDEX into this array (one
// step per detent), so every reachable position is one of these anchors and the
// control is keyboard-operable in both directions without snap math.
export const WORKSPACE_DETENTS = [70, 100, 140, 200, 300, 500];
