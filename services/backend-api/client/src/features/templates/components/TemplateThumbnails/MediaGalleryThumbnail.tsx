export const MediaGalleryThumbnail = () => (
  <svg
    viewBox="0 0 160 60"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    width="100%"
    height="100%"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
  >
    {/* Media gallery icon - container with title, multiple images, and button */}
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
    {/* Title line */}
    <rect x="40" y="10" width="40" height="5" rx="2" fill="#7986cb" />
    {/* Multiple image placeholders - grid layout */}
    <rect
      x="40"
      y="19"
      width="38"
      height="18"
      rx="2"
      fill="#283593"
      stroke="#7986cb"
      strokeWidth="1"
    />
    <rect
      x="82"
      y="19"
      width="38"
      height="18"
      rx="2"
      fill="#283593"
      stroke="#7986cb"
      strokeWidth="1"
    />

    {/* Button */}
    <rect x="40" y="42" width="30" height="8" rx="2" fill="#7986cb" />
  </svg>
);
