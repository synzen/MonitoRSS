import React, { useState, useEffect, ReactNode } from "react";
import { Box } from "@chakra-ui/react";

interface ResizablePanelProps {
  children: ReactNode;
  width: number;
  minWidth?: number;
  maxWidth?: number;
  onWidthChange: (width: number) => void;
  side: "left" | "right";
  showHandle?: boolean;
  display?: any;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  width,
  minWidth = 300,
  maxWidth = 600,
  onWidthChange,
  side,
  showHandle = true,
  display,
}) => {
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      let newWidth: number;

      if (side === "left") {
        // Left panel: width increases as mouse moves right
        newWidth = Math.max(minWidth, Math.min(maxWidth, e.clientX));
      } else {
        // Right panel: width increases as mouse moves left (from right edge)
        newWidth = Math.max(minWidth, Math.min(maxWidth, window.innerWidth - e.clientX));
      }

      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, minWidth, maxWidth, onWidthChange, side]);

  const handleResizeStart = () => {
    setIsResizing(true);
  };

  return (
    <>
      {side === "right" && showHandle && (
        <Box
          w="6px"
          bg="gray.700"
          cursor="col-resize"
          _hover={{ bg: "gray.600" }}
          onMouseDown={handleResizeStart}
          display={display}
          position="relative"
          _before={{
            content: '""',
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "2px",
            height: "20px",
            bg: "gray.500",
            borderRadius: "1px",
          }}
        />
      )}
      <Box w={`${width}px`} display={display} position="relative" flexShrink={0}>
        {children}
      </Box>
      {side === "left" && showHandle && (
        <Box
          w="6px"
          bg="gray.700"
          cursor="col-resize"
          _hover={{ bg: "gray.600" }}
          onMouseDown={handleResizeStart}
          display={display}
          position="relative"
          _before={{
            content: '""',
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "2px",
            height: "20px",
            bg: "gray.500",
            borderRadius: "1px",
          }}
        />
      )}
    </>
  );
};
