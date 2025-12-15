# Story 1.2: Shared Discord Message Display Component

Status: ready-for-dev

## Dependencies

- Story 1.1: Template Types and Constants (provides MessageComponentRoot type and template structures)

## Story

As a developer,
I want a stateless Discord message display component extracted from the existing preview code,
So that both the message builder and template gallery can render Discord-style previews consistently.

## Why This Refactoring Matters

This extraction is essential for the template gallery feature (Epic 1). Currently, the message builder has a monolithic preview component that:
1. Fetches data (useCreateConnectionPreview)
2. Manages state (form context, article context)
3. Renders Discord messages

The template gallery needs to render Discord messages WITHOUT the message builder's context. By extracting pure rendering logic, we enable:
- Template gallery preview (Story 1.4)
- Potential future uses (connection listing previews, template sharing, etc.)
- Easier testing (render with mock data, no complex context setup)
- Better separation of concerns (data fetching vs presentation)

## Acceptance Criteria

1. **Given** the existing `DiscordMessagePreview` component in the message builder
   **When** I extract the rendering logic into `src/components/DiscordMessageDisplay/index.tsx`
   **Then** the new component accepts props only (no internal data fetching or context usage)

2. **Given** a `DiscordMessageDisplay` component
   **When** I pass it preview data from the preview API response
   **Then** it renders the Discord embed/message visually matching the current preview output

3. **Given** the preview data contains a V1 (Legacy embed) format
   **When** `DiscordMessageDisplay` renders it
   **Then** it displays the embed with title, description, color, thumbnail, fields, footer, and timestamp as appropriate

4. **Given** the preview data contains a V2 (component-based) format
   **When** `DiscordMessageDisplay` renders it
   **Then** it displays the component structure correctly (buttons, action rows, Containers, Sections, TextDisplay, MediaGallery, etc.)

5. **Given** the existing `DiscordMessagePreview` in the message builder
   **When** it is refactored to use `DiscordMessageDisplay`
   **Then** the message builder preview continues to work exactly as before (no visual or behavioral changes)

6. **Given** `DiscordMessageDisplay` receives no data or empty data
   **When** it renders
   **Then** it displays an appropriate empty state or placeholder

7. **Given** the preview data contains an unknown component type
   **When** `DiscordMessageDisplay` renders it
   **Then** it gracefully skips that component without crashing (returns null)

## Tasks / Subtasks

- [ ] **Task 1: Create DiscordMessageDisplay component structure** (AC: #1)
  - [ ] Create directory: `services/backend-api/client/src/components/DiscordMessageDisplay/`
  - [ ] Create `index.tsx` file
  - [ ] Define `DiscordMessageDisplayProps` interface accepting preview messages data

- [ ] **Task 2: Extract V2 component rendering logic** (AC: #4, #7)
  - [ ] Copy `DISCORD_V2_COMPONENT_TYPE` constant from `DiscordMessagePreview.tsx` (include MediaGalleryItem if used)
  - [ ] Copy `buttonColors` and `styleNumToName` constants
  - [ ] Extract `renderApiAccessory` function (handles Thumbnail and Button accessories)
  - [ ] Extract `renderApiButton` function
  - [ ] Extract `renderApiComponent` function (renders Section, ActionRow, Separator, TextDisplay, MediaGallery, Container)
  - [ ] Extract spoiler overlay rendering (used in Thumbnail, MediaGallery, Container)
  - [ ] Make all rendering functions accept data as parameters instead of using context
  - [ ] Import parseAllowLinks and jumboify with @ts-ignore comment:
    ```typescript
    // @ts-ignore - markdown utils lack TypeScript definitions (established pattern)
    import { parseAllowLinks, jumboify } from "../DiscordView/utils/markdown";
    ```

- [ ] **Task 3: Extract V1 Legacy embed rendering support** (AC: #3)
  - [ ] Import existing `DiscordView` component from `../DiscordView`
  - [ ] Handle legacy messages array rendering via DiscordView
  - [ ] Pass `darkTheme={true}` to DiscordView (Discord previews always use dark theme)
  - [ ] Preserve exact props: `username`, `avatar_url`, `messages`, `excludeHeader`

- [ ] **Task 4: Handle message format detection** (AC: #2, #3, #4)
  - [ ] Copy `DISCORD_COMPONENTS_V2_FLAG` constant: `const DISCORD_COMPONENTS_V2_FLAG = 1 << 15;`
  - [ ] Safely detect format with null checks:
    ```typescript
    const firstMessage = messages[0];
    // eslint-disable-next-line no-bitwise
    const isV2Components = firstMessage && (firstMessage.flags ?? 0) & DISCORD_COMPONENTS_V2_FLAG;
    ```
  - [ ] Route to appropriate renderer (V2 custom rendering or V1 DiscordView)

- [ ] **Task 5: Implement empty/loading states** (AC: #6)
  - [ ] Handle empty messages array with placeholder message:
    ```typescript
    if (!messages || messages.length === 0) {
      return (
        <Text color="gray.400" fontSize="sm" fontStyle="italic">
          {emptyMessage || "No components added yet"}
        </Text>
      );
    }
    ```
  - [ ] Handle null/undefined data gracefully
  - [ ] Support optional `isLoading` prop - show Progress bar at top of container when true

- [ ] **Task 6: Create the visual Discord container** (AC: #2)
  - [ ] Define constants for Discord header:
    ```typescript
    const MONITORSS_AVATAR_URL = "https://cdn.discordapp.com/avatars/302050872383242240/1fb101f4b0fe104b6b8c53ec5e3d5af6.png";
    const MONITORSS_USERNAME = "MonitoRSS";
    ```
  - [ ] Render Discord-style dark background container (#36393f)
  - [ ] Include MonitoRSS avatar, username, APP badge, and timestamp ("Today at 12:04 PM" - hardcoded placeholder)
  - [ ] Support optional `maxHeight` prop for container sizing (default: `{ base: 300, lg: 450 }`)
  - [ ] Include Progress bar logic when `isLoading` prop is true (positioned absolute at top)
  - [ ] Match existing visual styling exactly (no visual changes)

- [ ] **Task 7: Refactor DiscordMessagePreview to use DiscordMessageDisplay** (AC: #5)
  - [ ] Keep all data fetching and context usage in `DiscordMessagePreview`
  - [ ] Pass fetched `connectionPreview.result.messages` to `DiscordMessageDisplay`
  - [ ] Pass `isLoading={fetchStatus === 'fetching' || !currentArticle}` to DiscordMessageDisplay
  - [ ] Keep `ArticlePreviewBanner`, server/channel info display in parent
  - [ ] Keep "Unsaved changes" highlight in parent
  - [ ] Remove extracted rendering logic from parent
  - [ ] Verify message builder preview works identically before and after

- [ ] **Task 8: Export and test** (AC: #2, #5)
  - [ ] Export `DiscordMessageDisplay` from component index (named + default export)
  - [ ] Verify TypeScript compiles without errors: `npm run type-check`
  - [ ] Manual testing: verify message builder preview unchanged

## Dev Notes

### Critical Architecture Constraints

**MUST FOLLOW - These are non-negotiable:**

1. **Component Location**: `services/backend-api/client/src/components/DiscordMessageDisplay/index.tsx`
2. **Stateless Design**: Component receives data via props ONLY. No hooks for data fetching, no context usage, no form state. Only `useColorModeValue` hook allowed.
3. **Preserve Visual Fidelity**: The refactored message builder preview MUST look IDENTICAL to before. Zero visual regressions.
4. **Import Paths**: Use relative imports from `src/components/DiscordMessageDisplay/`:
   - `../DiscordView` - for DiscordView component
   - `../DiscordView/utils/markdown` - for parseAllowLinks, jumboify
   - `../../types/discord/DiscordApiPayload` - for DiscordApiComponent type

### Current DiscordMessagePreview Analysis

The existing component at `src/pages/MessageBuilder/DiscordMessagePreview.tsx` (832 lines) contains:

**Data Fetching (KEEP IN PARENT):**
- Lines 56-66: Form context and MessageBuilder context usage
- Lines 67-72: Preview data conversion
- Lines 111-127: `useCreateConnectionPreview` API call
- Lines 639-654: Error handling with InlineErrorAlert

**Pure Rendering Logic (EXTRACT TO DiscordMessageDisplay):**
- Lines 39-50: `DISCORD_V2_COMPONENT_TYPE` constant
- Lines 131-167: Button colors and style mappings
- Lines 169-264: `renderApiAccessory` function
- Lines 266-301: `renderApiButton` function
- Lines 303-636: `renderApiComponent` function (THE CORE - handles all V2 types)
- Lines 657-682: Message format detection (V2 flag check, legacyMessages filtering)
- Lines 738-824: Discord message container rendering (including Progress bar)

**Keep in Parent (MessageBuilder-specific):**
- `ArticlePreviewBanner` component
- Server/channel info display (Lines 696-737)
- "Unsaved changes" highlight
- Form dirty state indicator
- Error handling with InlineErrorAlert

### Props Interface Design

```typescript
import { DiscordApiComponent } from '../../types/discord/DiscordApiPayload';

interface DiscordMessage {
  content?: string | null;
  embeds?: Array<{
    title?: string;
    description?: string;
    url?: string;
    color?: number;
    // ... other embed fields
  }>;
  components?: DiscordApiComponent[] | null;
  flags?: number;
}

interface DiscordMessageDisplayProps {
  /** Array of Discord messages from preview API response */
  messages: DiscordMessage[];
  /** Maximum height for scrollable container (default: { base: 300, lg: 450 }) */
  maxHeight?: string | number;
  /** Show loading state (Progress bar at top) */
  isLoading?: boolean;
  /** Custom empty state message (default: "No components added yet") */
  emptyMessage?: string;
}
```

### Props Usage Guide

- `messages`: Pass `connectionPreview.result.messages` from parent
- `maxHeight`: Pass through from parent's prop (default: `{ base: 300, lg: 450 }`)
- `isLoading`: Pass `fetchStatus === 'fetching' || !currentArticle` from parent
- `emptyMessage`: Optional custom message for empty state

### Rendering Flow

```
DiscordMessageDisplay
├── Check if messages empty → render empty state with emptyMessage
├── Render Discord container (dark bg #36393f)
│   ├── Show Progress bar if isLoading
│   ├── Render MonitoRSS avatar + username + APP badge + timestamp
│   └── Detect format (V2 flag on first message)
│       ├── V2 Format (flags & (1 << 15))
│       │   └── Iterate components[] → renderApiComponent()
│       └── V1 Legacy Format
│           └── Render via DiscordView component
└── Return rendered container
```

### V2 Component Type Reference

```typescript
const DISCORD_V2_COMPONENT_TYPE = {
  ActionRow: 1,
  Button: 2,
  Section: 9,
  TextDisplay: 10,
  Thumbnail: 11,
  MediaGallery: 12,
  Separator: 14,
  Container: 17,
} as const;
```

Each type has specific rendering logic in the current `renderApiComponent`:
- **Container**: Background box with accent color (convert number to hex: `` `#${Number(accent_color).toString(16).padStart(6, "0")}` ``), renders children recursively with VStack
- **Section**: HStack with text content and optional accessory (thumbnail/button)
- **TextDisplay**: Markdown text via `parseAllowLinks`
- **ActionRow**: HStack of buttons
- **Separator**: Divider with configurable spacing
- **MediaGallery**: Complex grid layouts based on item count (special handling for 2, 3, 5, 7, 8, 10 images)

### Spoiler Overlay Rendering

Components (Thumbnail, MediaGallery items, Container) can have a `spoiler` field. When true, render overlay:
```typescript
{item.spoiler && (
  <Box
    position="absolute"
    top={0} left={0} right={0} bottom={0}
    bg="blackAlpha.800"
    display="flex"
    alignItems="center"
    justifyContent="center"
    fontSize="xs"
    color="gray.300"
    zIndex={1}
  >
    SPOILER
  </Box>
)}
```

### Color Mode Handling

The Discord preview is ALWAYS dark mode. While `useColorModeValue` is imported, both light and dark values should be set to Discord's dark theme colors:
- Background: #36393f
- Text: #dcddde

```typescript
const bgColor = useColorModeValue("#36393f", "#36393f");
const textColor = useColorModeValue("#dcddde", "#dcddde");
```

This maintains the Discord aesthetic regardless of the app's theme.

### Dependencies to Import

```typescript
// From src/components/DiscordMessageDisplay/index.tsx:

// Chakra UI
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  useColorModeValue,
  Avatar,
  Stack,
  Progress,
  Divider,
  Image,
  SimpleGrid,
} from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";

// Existing components - relative path from src/components/DiscordMessageDisplay/
import DiscordView from "../DiscordView";

// Markdown utils - lacks TS definitions, use @ts-ignore
// @ts-ignore
import { parseAllowLinks, jumboify } from "../DiscordView/utils/markdown";

// Types - relative path from src/components/DiscordMessageDisplay/
import { DiscordApiComponent } from "../../types/discord/DiscordApiPayload";
```

### React Key Strategy

Use index-based keys for components from API (API order is stable):
- Examples: `key={\`section-${index}\`}`, `key={\`actionrow-${index}\`}`
- For nested items, combine parent and child indices: `key={\`btn-${index}-${i}\`}`
- Avoid content-based keys (content can be duplicate or empty)

### Refactoring Strategy

**Step 1: Create DiscordMessageDisplay**
1. Copy rendering functions from DiscordMessagePreview
2. Create props-based interface
3. Build the Discord container with header and Progress bar

**Step 2: Verify Standalone**
1. Create test page or temporarily render component with mock data
2. Verify both V1 and V2 rendering works

**Step 3: Integrate into DiscordMessagePreview**
1. Import `DiscordMessageDisplay`
2. Remove extracted rendering logic (lines 39-50, 131-167, 169-636, 738-824)
3. Pass `connectionPreview.result.messages` and `isLoading` as props
4. Keep all parent-level concerns (banner, server/channel info, error handling)

**Step 4: Verify No Regressions**
1. Test message builder with V1 Legacy message
2. Test message builder with V2 Components message
3. Test with empty message
4. Verify loading states work

### MediaGallery Layout Reference

The `renderApiComponent` has special grid layouts for different image counts:

| Items | Layout |
|-------|--------|
| 1 | Single image, auto height |
| 2 | Two squares side by side |
| 3 | 1 large left (spans 2 rows), 2 stacked right |
| 4 | 2x2 grid |
| 5 | 2 squares top, 3 squares bottom |
| 6 | 3x2 grid (default) |
| 7 | 1 large top, 2 rows of 3 below |
| 8 | 2 large top, 2 rows of 3 below |
| 9 | 3x3 grid (default) |
| 10 | 1 large top, 3 rows of 3 below |
| 11+ | 3 columns grid (default) |

All counts not in special layouts use the default grid logic (lines 563-586).

This logic MUST be preserved exactly in the extraction.

### Expected File Structure After Extraction

```
src/components/DiscordMessageDisplay/
└── index.tsx  (350-400 lines estimated)
    ├── Imports (lines 1-30)
    ├── Constants (DISCORD_V2_COMPONENT_TYPE, DISCORD_COMPONENTS_V2_FLAG, MONITORSS_AVATAR_URL, MONITORSS_USERNAME)
    ├── Helper constants (buttonColors, styleNumToName)
    ├── Props interface (DiscordMessageDisplayProps)
    ├── Helper functions
    │   ├── renderApiAccessory (50 lines)
    │   ├── renderApiButton (30 lines)
    │   └── renderApiComponent (330 lines - recursive)
    ├── Main component function
    │   ├── Empty state check
    │   ├── Format detection logic
    │   ├── Discord container with header + Progress
    │   ├── V1 rendering (DiscordView)
    │   └── V2 rendering (custom components)
    └── Exports (default + named)

src/pages/MessageBuilder/DiscordMessagePreview.tsx (400-450 lines, down from 832)
    ├── Data fetching logic (KEPT)
    ├── Form context usage (KEPT)
    ├── Error handling (KEPT)
    ├── ArticlePreviewBanner (KEPT)
    ├── Server/channel info display (KEPT)
    └── Import and use DiscordMessageDisplay (NEW)
```

### Manual Testing Strategy

1. **V1 Testing:** Use message builder with Legacy embed - verify embeds render with title, description, color, thumbnail
2. **V2 Testing:** Use message builder with V2 Components message - verify Container, Section, TextDisplay, ActionRow, MediaGallery render correctly
3. **Format Switching:** Change message type from V1 to V2 - preview should update correctly
4. **Empty State:** Clear all components - verify "No components added yet" message appears
5. **Loading State:** Trigger preview refresh - verify Progress bar appears at top during load
6. **Spoiler State:** If possible, test component with spoiler flag - verify overlay appears

### Performance Notes

- `renderApiComponent` is recursive for Container children (line 629)
- Discord likely limits nesting depth server-side
- No artificial limits needed in renderer for MVP

### Rollback Strategy

If refactoring causes issues:

1. **Git revert:** Revert the DiscordMessagePreview changes but keep DiscordMessageDisplay
2. **Incremental migration:** Use DiscordMessageDisplay only in template gallery (Story 1.4), leave message builder as-is
3. **Feature flag:** Add conditional to use old or new rendering logic during testing

The extraction is designed to be non-breaking, but having a rollback plan ensures safety.

### Potential Gotchas

1. **TypeScript `// @ts-ignore`**: Required above markdown import - these utils lack TS definitions
2. **parseAllowLinks import path**: From new component location: `../DiscordView/utils/markdown`
3. **eslint-disable-next-line no-bitwise**: Required above flag check (bitwise operations flagged by linter)
4. **Color mode**: Always use Discord dark theme colors regardless of app theme
5. **Key props**: Use index-based keys for stable rendering
6. **Accent color conversion**: Container accent_color is a NUMBER - convert to hex string

### References

- [Architecture: Preview Component Architecture] docs/architecture.md:276-300
- [Architecture: Component Responsibilities Table] docs/architecture.md:289-296
- [Existing Implementation] services/backend-api/client/src/pages/MessageBuilder/DiscordMessagePreview.tsx:1-832
- [PRD: NFR13] docs/prd.md:329-330 - "Template preview reuses existing message preview API and component"
- [UX: Preview Component] docs/ux-design-specification.md:203-212 - "Slack Block Kit Builder (Live Preview)"
- [Epics: Story 1.2] docs/epics.md:220-250

## Verification Checklist

Before marking this story complete, verify:

- [ ] TypeScript compiles without errors (`npm run type-check`)
- [ ] DiscordMessageDisplay is a pure function component (no hooks except useColorModeValue)
- [ ] All rendering functions are internal to DiscordMessageDisplay (not exported separately)
- [ ] Message builder preview renders identically before and after refactor
- [ ] Both V1 (Legacy) and V2 (Components) formats render correctly
- [ ] Empty message array shows "No components added yet" message
- [ ] Loading state shows Progress bar at top of Discord container
- [ ] Spoiler overlays render correctly on components with spoiler flag
- [ ] No ESLint errors (bitwise operations have disable comments)

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
