import { useBreakpointValue } from "@chakra-ui/react";
import { MESSAGE_BUILDER_MOBILE_BREAKPOINT } from "../pages/Previewer/constants/MessageBuilderMobileBreakpoint";

/**
 * Hook to determine if the current viewport is desktop size for the previewer component
 * Uses the [MESSAGE_BUILDER_MOBILE_BREAKPOINT] breakpoint (1024px) which is when the previewer switches to desktop layout
 * @returns boolean - true if desktop (lg breakpoint or larger), false otherwise
 */
export const useIsPreviewerDesktop = () => {
  return useBreakpointValue({ base: false, [MESSAGE_BUILDER_MOBILE_BREAKPOINT]: true }) ?? false;
};

/**
 * Hook to determine if the current viewport is mobile/tablet size for the previewer component
 * Uses the lg breakpoint (1024px) which is when the previewer switches layouts
 * @returns boolean - true if mobile/tablet (below lg breakpoint), false otherwise
 */
export const useIsPreviewerMobile = () => {
  return useBreakpointValue({ base: true, [MESSAGE_BUILDER_MOBILE_BREAKPOINT]: false }) ?? true;
};
