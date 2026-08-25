import { Box, Button, HStack, Stack } from "@chakra-ui/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Tag } from "@/components/ui/tag";
import {
  NestedPopoverRoot,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { WORKSPACE_TAG_COLORS, type WorkspaceTag, type WorkspaceTagColor } from "../types";

export const WORKSPACE_TAG_PALETTE = Object.fromEntries(
  WORKSPACE_TAG_COLORS.map((color) => [
    color,
    {
      background: `workspaceTag.${color}.background`,
      text: `workspaceTag.${color}.text`,
      border: `workspaceTag.${color}.border`,
    },
  ]),
) as Record<WorkspaceTagColor, { background: string; text: string; border: string }>;

export const WorkspaceTagChip = ({ tag }: { tag: WorkspaceTag }) => {
  const palette = WORKSPACE_TAG_PALETTE[tag.color ?? "gray"];

  return (
    <Tag
      data-testid="workspace-tag-chip"
      size="lg"
      background={palette.background}
      color={palette.text}
      borderWidth="1px"
      borderColor={palette.border}
      fontWeight="semibold"
      whiteSpace="nowrap"
    >
      {tag.name}
    </Tag>
  );
};

interface Props {
  tags?: WorkspaceTag[];
  maxVisible?: number;
}

export const WorkspaceTagList = ({ tags = [], maxVisible }: Props) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const measurementRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const overflowMeasurementRef = useRef<HTMLSpanElement>(null);
  const ordered = useMemo(
    () =>
      [...tags].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [tags],
  );
  const [measuredVisibleCount, setMeasuredVisibleCount] = useState(ordered.length);
  const visibleCount = Math.min(maxVisible ?? measuredVisibleCount, ordered.length);
  const visible = ordered.slice(0, visibleCount);
  const hiddenCount = Math.max(ordered.length - visible.length, 0);

  useLayoutEffect(() => {
    if (maxVisible !== undefined) {
      return undefined;
    }

    const measure = () => {
      const availableWidth = containerRef.current?.clientWidth ?? 0;

      if (availableWidth === 0) {
        return;
      }

      const widths = ordered.map((_, index) => measurementRefs.current[index]?.offsetWidth ?? 0);
      const gap = 4;
      const totalWidth =
        widths.reduce((total, width) => total + width, 0) + gap * Math.max(widths.length - 1, 0);

      if (totalWidth <= availableWidth) {
        setMeasuredVisibleCount(ordered.length);

        return;
      }

      let usedWidth = overflowMeasurementRef.current?.offsetWidth ?? 0;
      let nextVisibleCount = 0;

      for (const width of widths) {
        const nextWidth = usedWidth + gap + width;

        if (nextWidth > availableWidth) {
          break;
        }

        usedWidth = nextWidth;
        nextVisibleCount += 1;
      }

      setMeasuredVisibleCount(nextVisibleCount);
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);

      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [maxVisible, ordered]);

  if (ordered.length === 0) {
    return null;
  }

  return (
    <Box
      ref={containerRef}
      data-testid="workspace-tag-list"
      position="relative"
      width="260px"
      maxWidth="100%"
      minWidth={0}
    >
      <HStack gap={1} minWidth={0}>
        {visible.map((tag) => (
          <WorkspaceTagChip key={tag.id} tag={tag} />
        ))}
        {hiddenCount > 0 && (
          <NestedPopoverRoot finalFocusEl={() => triggerRef.current}>
            <PopoverTrigger asChild>
              <Button
                ref={triggerRef}
                size="sm"
                variant="outline"
                aria-label={`Show all tags (${hiddenCount} more)`}
              >
                +{hiddenCount}
              </Button>
            </PopoverTrigger>
            <PopoverContent role="dialog" aria-label="All tags" maxWidth="sm">
              <PopoverHeader>
                <PopoverTitle>All tags</PopoverTitle>
              </PopoverHeader>
              <PopoverBody>
                <Stack direction="row" gap={2} flexWrap="wrap">
                  {ordered.map((tag) => (
                    <WorkspaceTagChip key={tag.id} tag={tag} />
                  ))}
                </Stack>
              </PopoverBody>
            </PopoverContent>
          </NestedPopoverRoot>
        )}
      </HStack>
      {maxVisible === undefined && (
        <HStack
          aria-hidden="true"
          position="absolute"
          visibility="hidden"
          pointerEvents="none"
          whiteSpace="nowrap"
        >
          {ordered.map((tag, index) => (
            <span
              key={tag.id}
              ref={(element) => {
                measurementRefs.current[index] = element;
              }}
            >
              <WorkspaceTagChip tag={tag} />
            </span>
          ))}
          <span ref={overflowMeasurementRef}>
            <Button size="sm" variant="outline">
              +{ordered.length}
            </Button>
          </span>
        </HStack>
      )}
    </Box>
  );
};
