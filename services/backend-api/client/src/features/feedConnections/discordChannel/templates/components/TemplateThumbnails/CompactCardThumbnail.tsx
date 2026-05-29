export const CompactCardThumbnail = () => (
  <svg
    viewBox="0 0 160 60"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    width="100%"
    height="100%"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
  >
    {/* Compact card icon - card container with thumbnail accessory and button */}
    {/* Card outline */}
    <rect
      x="30"
      y="4"
      width="100"
      height="52"
      rx="4"
      fill="#3949ab"
      stroke="#5c6bc0"
      strokeWidth="2"
    />
    {/* Text line */}
    <rect x="40" y="10" width="40" height="7" rx="2" fill="#7986cb" />
    {/* Small description */}
    <rect x="40" y="21" width="28" height="5" rx="1" fill="#5c6bc0" />
    {/* Thumbnail accessory on right */}
    <rect
      x="96"
      y="10"
      width="26"
      height="26"
      rx="3"
      fill="#283593"
      stroke="#7986cb"
      strokeWidth="1"
    />
    {/* Button */}
    <rect x="40" y="40" width="35" height="10" rx="3" fill="#7986cb" />
  </svg>
);
