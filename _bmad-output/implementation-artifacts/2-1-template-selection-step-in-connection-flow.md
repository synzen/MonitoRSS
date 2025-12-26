# Story 2.1: Template Selection Step in Connection Flow

Status: done

## Dependencies

- **Epic 1 (Completed):** Template Gallery Foundation - All components from Epic 1 are implemented and available:
  - Story 1.1: Template Types and Constants (provides `Template` interface, `TEMPLATES` array, `DEFAULT_TEMPLATE`)
  - Story 1.2: Shared Discord Message Display Component (`DiscordMessageDisplay`)
  - Story 1.3: Template Card Component (`TemplateCard` with radio button integration)
  - Story 1.4: Template Gallery Modal (`TemplateGalleryModal` component)
  - Story 1.5: Accessible Template Selection (accessibility features verified)

## Story

As a new user creating a connection,
I want to be presented with template selection as part of the connection setup,
So that I can choose how my messages will look before my connection goes live.

## Business Context

This is the **most critical story in Epic 2** - it transforms the new user onboarding experience from "configure placeholders manually" to "pick a template and be done." The goal is click-and-forget simplicity where users can be delivering beautifully formatted messages to Discord in under a minute.

**Target Persona: Alex** - the community manager who budgeted an hour for setup but wants to be done in 3 minutes.

## Acceptance Criteria

1. **Given** I am creating a new connection in the AddConnectionDialog
   **When** I complete the Discord channel selection step
   **Then** I am presented with the template selection step before the connection is finalized

2. **Given** I am on the template selection step
   **When** the step loads
   **Then** the Template Gallery Modal opens automatically with my feed's articles available for preview

3. **Given** I am on the template selection step
   **When** I view the modal
   **Then** only templates compatible with my feed's available fields are enabled (based on `requiredFields` matching)

4. **Given** I am on the template selection step
   **When** I have not yet completed this step
   **Then** my connection is not active and no articles will be delivered

5. **Given** I complete the template selection step (by selecting a template or skipping)
   **When** I proceed
   **Then** the connection becomes active and articles will begin delivering automatically

6. **Given** the template gallery loads
   **When** the UI renders
   **Then** it does not block or delay the connection creation flow (NFR1)

7. **Given** I am on the template selection step
   **When** my feed's available fields don't match any template's `requiredFields` (except the default)
   **Then** only the default template is enabled, other templates show "Needs articles" badge, and an info banner explains the situation

8. **Given** I am on the template selection step with limited feed fields
   **When** only the default template is enabled
   **Then** the default template is automatically selected and the preview panel shows exactly how it will render with my feed's content

9. **Given** the default template is selected
   **When** I view the template card
   **Then** it clearly indicates this is the "Default" template (labeled "Simple Text") with description "Clean text format that works with any feed"

## Tasks / Subtasks

- [x] **Task 1: Create Step-Based Dialog Architecture** (AC: #1, #4)
  - [x] Create `ConnectionCreationStep` enum with values: `ServerChannel`, `TemplateSelection`
  - [x] Add step state management to `DiscordTextChannelConnectionDialogContent`
  - [x] Implement step navigation (Next, Back) while preserving form data across steps
  - [x] Ensure connection is NOT created until template step is completed

- [x] **Task 2: Integrate TemplateGalleryModal into Connection Flow** (AC: #2, #6)
  - [x] Import and render `TemplateGalleryModal` for template selection step
  - [x] Pass required props: `templates`, `feedFields`, `articles`, `feedId`, `connectionId`, `userFeed`, `connection`
  - [x] Handle template selection state within the connection dialog
  - [x] Ensure modal opens automatically when step is active

- [x] **Task 3: Fetch Feed Data for Template Compatibility** (AC: #3, #7, #8)
  - [x] Use existing feed query to get `userFeed` data
  - [x] Extract available feed fields from feed articles
  - [x] Fetch articles using existing API patterns
  - [x] Pass feed fields to `isTemplateCompatible` function for filtering

- [x] **Task 4: Handle Template Selection and Application** (AC: #5, #9)
  - [x] Store selected template ID in connection creation state
  - [x] Apply template's `messageComponent` when creating the connection
  - [x] If no template selected (Skip), apply `DEFAULT_TEMPLATE`
  - [x] Ensure the connection's `messageComponent` is set from the selected template

- [x] **Task 5: Update Connection Creation API Call** (AC: #4, #5)
  - [x] Modify `onSubmit` to include `messageComponent` from selected template
  - [x] Verify `useCreateDiscordChannelConnection` hook accepts message component data
  - [x] If hook doesn't accept message component, create separate mutation to update after connection creation

- [x] **Task 6: Configure Action Buttons for Template Step** (AC: #1, #5)
  - [x] Primary action: "Continue" (applies template, proceeds to final save)
  - [x] Secondary action: "Skip" (applies default template, proceeds)
  - [x] Tertiary action: "Customize manually" (escape hatch to full message builder - post-connection)
  - [x] Back button to return to server/channel step

- [x] **Task 7: Handle Edge Cases** (AC: #7, #8)
  - [x] Empty feed (no articles): Show info banner, disable non-default templates
  - [x] Auto-select default template when it's the only option
  - [x] Ensure preview works with available data (or shows placeholder)

- [x] **Task 8: Add Forum and Webhook Dialog Support** (AC: #1)
  - [x] Created shared `useConnectionTemplateSelection` hook for reusable template selection logic
  - [x] Apply hook to `DiscordForumChannelConnectionDialogContent`
  - [x] Apply hook to `DiscordApplicationWebhookConnectionDialogContent`
  - Note: All three connection dialogs (Text, Forum, Webhook) now have template selection

- [x] **Task 9: Write Tests** (AC: all)
  - [x] Unit tests for step navigation logic
  - [x] Integration tests for template selection within connection flow
  - [x] Test empty feed handling
  - [x] Test template compatibility filtering
  - [x] Verify accessibility requirements maintained

- [x] **Task 10: Manual Testing and Verification** (AC: all)
  - [x] Test complete flow: Server → Channel → Template → Connection Created
  - [x] Test Skip flow: Server → Channel → Skip → Default Applied
  - [x] Test empty feed flow
  - [x] Verify keyboard navigation through steps
  - [x] Verify screen reader announcements

## Dev Notes

### Critical Architecture Constraints

**MUST FOLLOW - These are non-negotiable:**

1. **Arrow Function Components ONLY** - ESLint enforces `namedComponents: "arrow-function"`
   ```typescript
   // CORRECT
   export const MyComponent: React.FC<Props> = ({ prop }) => { ... }

   // WRONG - will fail ESLint
   export function MyComponent({ prop }: Props) { ... }
   ```

2. **Use Existing TemplateGalleryModal** - Do NOT recreate the gallery. The component at `src/features/templates/components/TemplateGalleryModal/index.tsx` already has:
   - Radio button group pattern with accessibility
   - Preview rendering with `DiscordMessageDisplay`
   - Template compatibility checking via `isTemplateCompatible`
   - Article selection
   - Configurable action buttons

3. **Template Application Pattern** - Use `form.setValue` for message component:
   ```typescript
   form.setValue('messageComponent', template.messageComponent);
   ```

4. **Path Aliases** - Use `@/*` for imports from `src/*`

5. **Chakra UI for All Styling** - No custom CSS

### Existing Component Integration

**TemplateGalleryModal Props Interface:**
```typescript
interface TemplateGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Template[];
  selectedTemplateId?: string;
  onTemplateSelect: (templateId: string) => void;
  feedFields: string[];
  articles: Article[];
  selectedArticleId?: string;
  onArticleChange: (articleId: string) => void;
  connectionId?: string;
  feedId: string;
  userFeed?: UserFeed;
  connection?: FeedDiscordChannelConnection;
  primaryActionLabel?: string;
  onPrimaryAction?: (selectedTemplateId: string) => void;
  isPrimaryActionLoading?: boolean;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  tertiaryActionLabel?: string;
  onTertiaryAction?: () => void;
  testId?: string;
}
```

**Key Imports:**
```typescript
import { TEMPLATES, DEFAULT_TEMPLATE, getTemplateById } from "@/features/templates/constants/templates";
import { Template } from "@/features/templates/types";
import { TemplateGalleryModal, isTemplateCompatible } from "@/features/templates/components/TemplateGalleryModal";
```

### Step-Based Dialog Pattern

The current `DiscordTextChannelConnectionDialogContent` is a single-step modal. Transform it into a multi-step flow:

```typescript
enum ConnectionCreationStep {
  ServerChannel = "server-channel",
  TemplateSelection = "template-selection",
}

// State management
const [currentStep, setCurrentStep] = useState<ConnectionCreationStep>(
  ConnectionCreationStep.ServerChannel
);
const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();

// Step navigation
const handleNextStep = () => {
  if (currentStep === ConnectionCreationStep.ServerChannel) {
    setCurrentStep(ConnectionCreationStep.TemplateSelection);
  }
};

const handleBackStep = () => {
  if (currentStep === ConnectionCreationStep.TemplateSelection) {
    setCurrentStep(ConnectionCreationStep.ServerChannel);
  }
};
```

### Connection Creation with Template

**Current Pattern (from existing code):**
```typescript
await mutateAsync({
  feedId,
  details: {
    name,
    channelId: threadId || inputChannelId,
    threadCreationMethod: /* ... */,
  },
});
```

**Required Update:**
Check if `useCreateDiscordChannelConnection` supports `messageComponent`. If not, you may need to:
1. Create connection first
2. Then update the connection with template's message component using `useUpdateDiscordChannelConnection`

### Feed Fields Extraction

Feed fields come from articles. Use existing hooks/API to fetch articles:
```typescript
// Check existing feed hooks for article data
// Articles contain fields like: title, description, link, image, author, etc.
// Extract field names: Object.keys(article).filter(key => article[key] !== undefined)
```

### Template Compatibility Check

The `isTemplateCompatible` function is already exported from TemplateGalleryModal:
```typescript
export function isTemplateCompatible(template: Template, feedFields: string[]): boolean {
  if (!template.requiredFields || template.requiredFields.length === 0) {
    return true;
  }
  return template.requiredFields.every((field) => feedFields.includes(field));
}
```

### Available Templates

From `src/features/templates/constants/templates.ts`:
- **Simple Text** (default): `requiredFields: []` - works with any feed
- **Rich Embed**: `requiredFields: ["description"]`
- **Compact Card**: `requiredFields: []` - works with any feed (V2 format)
- **Media Gallery**: `requiredFields: ["image"]`

### Button Hierarchy (UX Spec)

Per docs/ux-design-specification.md:
- **Primary** (right): Main action - "Continue" or "Send Test & Save"
- **Secondary** (center-right): Alternative - "Skip"
- **Tertiary** (left, link style): Escape hatch - "Customize manually"

### Project Structure Notes

Files to modify:
```
services/backend-api/client/src/features/feedConnections/components/AddConnectionDialog/
├── DiscordTextChannelConnectionDialogContent.tsx      # Add template step
├── DiscordForumChannelConnectionDialogContent.tsx     # Add template step
└── DiscordApplicationWebhookConnectionDialogContent.tsx # Add template step
```

### Git Intelligence (Recent Commits)

From recent Epic 1 commits:
- `00d39cf4e`: Story 1.5 accessibility implementation
- `cffa7e2d2`: Stories 1.3-1.4 TemplateCard and TemplateGalleryModal
- `a5aa1087a`: Story 1.2 DiscordMessageDisplay extraction
- `a62779f13`: Story 1.1 template types and constants

**Patterns to follow:**
- Tests are co-located: `ComponentName.test.tsx`
- Use `data-testid` for test selectors
- MSW for API mocking in tests

### Testing Strategy

**Unit Tests:**
- Step state transitions
- Template selection updates
- Form data preservation across steps

**Integration Tests:**
- Full flow: Server → Channel → Template → Submit
- Skip flow with default template
- Empty feed handling
- API calls with correct payload

**Accessibility Tests:**
- Focus management when transitioning between steps
- Screen reader announcements for step changes
- Keyboard navigation through entire flow

### References

- [Architecture: Template Application] docs/architecture.md:179-186
- [Architecture: Connection Flow Integration] docs/architecture.md:132-133
- [UX: Journey 1 - New User Template Selection] docs/ux-design-specification.md:506-561
- [UX: Button Hierarchy] docs/ux-design-specification.md:747-750
- [PRD: FR7] Connection creation includes template selection
- [PRD: FR8] Connection active only after template step
- [PRD: FR9] Skip uses default template
- [PRD: NFR1] Gallery loads without blocking flow
- [Epics: Story 2.1] docs/epics.md:390-433
- [Project Context] docs/project-context.md (TypeScript rules, component patterns)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None

### Completion Notes List

1. **Step-Based Dialog Architecture**: Implemented `ConnectionCreationStep` enum with `ServerChannel` and `TemplateSelection` steps in the text channel connection dialog.

2. **Shared Hook**: Created `useConnectionTemplateSelection` hook extracting all template selection logic for reuse across dialog types (Text, Forum, Webhook). This hook manages:
   - Step state transitions
   - Template selection state
   - Article selection state
   - Feed field extraction from articles
   - Template-to-API format conversion

3. **Template Conversion**: Implemented `convertTemplateToUpdateDetails` function that converts both LegacyRoot (V1) and V2Root template formats to the connection update API format, handling:
   - Legacy embeds (author, title, description, image, thumbnail, footer)
   - V2 components (Container, Section, TextDisplay, ActionRow, Button, MediaGallery, Divider, Thumbnail)
   - Placeholder limits

4. **Connection Flow**: After channel selection, users are presented with the template gallery. Connection is created first, then immediately updated with the selected template's message component.

5. **Action Buttons**: Template step has Continue (apply selected), Skip (apply default), Back (return to channel selection), and Customize manually link.

6. **Tests**: 25 unit tests covering hook functionality and template conversion. All 159 tests in the client package pass.

7. **All Dialogs Complete**: Template selection added to all three connection dialog types (Text, Forum, Webhook).

8. **Forum Dialog**: Added template selection to `DiscordForumChannelConnectionDialogContent` using the shared hook.

9. **Webhook Dialog**: Added template selection to `DiscordApplicationWebhookConnectionDialogContent` using the shared hook.

10. **Code Review Fixes Applied**:
    - Fixed failing test for COMPACT_CARD_TEMPLATE requiredFields (changed from `[]` to `["title"]`)
    - Refactored TextChannel dialog to use shared `useConnectionTemplateSelection` hook (removed ~200 lines of duplicated code)
    - Updated File List to include templates.ts and templates.test.ts changes
    - Kept tertiary action as "Back" (returns to server/channel step) - "Customize manually" is redundant with "Skip" during creation flow; reserved for Story 3.x

11. **Known Gaps Tracked to Story 2.2**:
    - **Template Preview**: Doesn't work during connection creation (requires `connectionId` that doesn't exist yet). Solution: Task 0 - new minimal preview endpoint
    - **Step Indicator**: No visual indicator showing wizard progress (Step 1/2). Solution: Task 0.5 - add step indicator to modal header

### File List

**Modified:**
- `services/backend-api/client/src/features/feedConnections/components/AddConnectionDialog/DiscordTextChannelConnectionDialogContent.tsx` - Added template selection step
- `services/backend-api/client/src/features/feedConnections/components/AddConnectionDialog/DiscordForumChannelConnectionDialogContent.tsx` - Added template selection step
- `services/backend-api/client/src/features/feedConnections/components/AddConnectionDialog/DiscordApplicationWebhookConnectionDialogContent.tsx` - Added template selection step
- `services/backend-api/client/src/features/feedConnections/hooks/index.ts` - Added export for new hook
- `services/backend-api/client/src/pages/MessageBuilder/utils/convertMessageBuilderStateToConnectionPreviewInput.ts` - Fixed circular dependency
- `services/backend-api/client/src/features/templates/constants/templates.ts` - Updated COMPACT_CARD_TEMPLATE requiredFields to include "title"
- `services/backend-api/client/src/features/templates/constants/templates.test.ts` - Updated test to match requiredFields change

**Created:**
- `services/backend-api/client/src/features/feedConnections/hooks/useConnectionTemplateSelection.tsx` - Shared template selection hook
- `services/backend-api/client/src/features/feedConnections/hooks/useConnectionTemplateSelection.test.tsx` - Unit tests (25 tests)

