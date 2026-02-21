const AVATAR_COLORS = [
  "#7c3aed",
  "#0d9488",
  "#ea580c",
  "#db2777",
  "#0891b2",
  "#ca8a04",
  "#16a34a",
  "#dc2626",
];

export function getAvatarColor(title: string): string {
  return AVATAR_COLORS[
    Array.from(title).reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length
  ];
}
