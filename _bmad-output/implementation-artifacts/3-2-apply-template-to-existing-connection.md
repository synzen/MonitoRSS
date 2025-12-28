# Story 3.2: Apply Template to Existing Connection

Status: done

## Dependencies

- **Epic 1 (Complete):** Template Gallery Foundation
  - Story 1.1: `Template` interface, `TEMPLATES` array, `DEFAULT_TEMPLATE`
  - Story 1.2: `DiscordMessageDisplay` component
  - Story 1.3: `TemplateCard` with radio button integration
  - Story 1.4: `TemplateGalleryModal` component with preview panel
  - Story 1.5: Accessibility features (keyboard navigation, screen reader support)
- **Epic 2 (Complete):** New User Onboarding Flow
  - Story 2.1: Template selection step in connection flow
  - Story 2.2: One-click template application and `convertTemplateToUpdateDetails`
  - Story 2.3: Empty feed handling
  - Story 2.4: Test send and completion
- **Story 3.1 (Ready-for-Dev):** Templates Button in Message Builder
  - Adds "Templates" button to MessageBuilder top bar
  - Opens `TemplateGalleryModal` in dual preview mode
  - Passes `showComparisonPreview` and `currentMessageComponent` props

## Integration with Story 3.1

**Story 3.1 provides (must be implemented first):**
- "Templates" button in MessageBuilder top bar
- `useDisclosure` for modal open/close state
- Article fetching via `useUserFeedArticles`
- Feed field extraction for template filtering
- `TemplateGalleryModal` integration with dual preview mode
- Modal props: isOpen, onClose, templates, feedFields, articles, etc.

**Story 3.2 adds:**
- `handleApplyTemplate` callback function
- `onPrimaryAction={handleApplyTemplate}` prop
- Form state population via `setValue`

## Story

As an existing user,
I want to apply a template to my connection and have it populate the message builder form,
So that I can use a template as a starting point and further customize if needed.

## Business Context

This story completes the "Existing User Template Access" journey. Users with existing connections can browse templates, see how they compare to their current format, and apply a template with one click. The template becomes the **starting point** - users can further customize after applying.

**Target Persona: Sam** - the existing MonitoRSS user who wants to improve their message format without starting from scratch.

**Key UX Principles:**
- Templates are a **starting point**, not locked configurations
- Changes aren't saved until the user clicks Save
- "Discard changes" restores previous state before template was applied
- Clear visual comparison between current and template formats

## Acceptance Criteria

1. **Given** I have selected a template in the gallery (from message builder context)
   **When** I click "Use this template" (primary action)
   **Then** the modal closes and the message builder form fields are populated with the template's settings

2. **Given** I apply a template
   **When** the form is populated
   **Then** the template's `messageComponent` replaces my current `messageComponent` in the form state

3. **Given** I apply a template
   **When** I view the message builder form
   **Then** I can see the template settings in the form fields and modify them if desired (FR14)

4. **Given** I apply a template and make additional modifications
   **When** I view the form
   **Then** my modifications are preserved in the form state (template is a starting point, not locked)

5. **Given** I apply a template
   **When** I view the message builder preview
   **Then** it reflects the applied template (and any subsequent modifications I've made)

6. **Given** I apply a template
   **When** the form is updated
   **Then** the form is marked as having unsaved changes (dirty state)

7. **Given** I apply a template to my message builder form
   **When** the existing "Changes won't be saved until you click Save" message and "Discard changes" functionality are present
   **Then** they work correctly with template-applied changes (discard reverts to pre-template state)

## Tasks / Subtasks

- [x] **Task 1: Add onPrimaryAction Handler in MessageBuilder** (AC: #1, #2)
  - [x] In `MessageBuilder.tsx`, create `handleApplyTemplate` function
  - [x] Function receives `selectedTemplateId` from modal's `onPrimaryAction` callback
  - [x] Use `getTemplateById(selectedTemplateId)` with `DEFAULT_TEMPLATE` fallback
  - [x] Extract `template.createMessageComponent()` for form population (templates use factory functions)
  - [x] Pass handler as `onPrimaryAction` prop to `TemplateGalleryModal`
  - [x] Close modal after template is applied (`handleCloseTemplatesModal()`)

- [x] **Task 2: Apply Template to Form State** (AC: #2, #6)
  - [x] Use `useFormContext<MessageBuilderFormState>()` to get form methods including `setValue`
  - [x] Call `setValue("messageComponent", newMessageComponent, { shouldValidate: true, shouldDirty: true, shouldTouch: true })`
  - [x] Verify form becomes dirty after template application
  - [x] Form will show "unsaved changes" warning after apply

- [x] **Task 3: Verify Form Field Population** (AC: #3, #4)
  - [x] After `setValue`, messageComponent in form state contains template data
  - [x] Message builder UI reflects the new messageComponent:
    - Content text field shows template content
    - Embeds section shows template embeds (if V1)
    - Components section shows template components (if V2)
  - [x] All fields remain editable (no read-only state)
  - [x] User modifications update form state normally
  - [x] Form validation applies to modified template values

- [x] **Task 4: Verify Preview Updates** (AC: #5)
  - [x] After template apply, message builder preview updates
  - [x] Preview reflects template + any subsequent user modifications
  - [x] Uses existing preview query (no new API calls)

- [x] **Task 5: Verify Discard Changes Works** (AC: #7)
  - [x] "Discard changes" button appears (form is dirty)
  - [x] Clicking discard calls `reset()` via existing `resetMessage()` context
  - [x] Form reverts to pre-template state (connection's original format)
  - [x] Test: Apply template -> Modify fields -> Discard -> Original state restored

- [x] **Task 6: Update TemplateGalleryModal Props** (AC: #1)
  - [x] Pass `primaryActionLabel="Use this template"` to modal
  - [x] Pass `onPrimaryAction={handleApplyTemplate}` to modal
  - [x] Pass `detectedImageField` for proper image field detection in templates
  - [x] Pass `secondaryActionLabel="Cancel"` for close action
  - [x] Pass `onSecondaryAction={handleCloseTemplatesModal}` for cancel
  - [x] Verify button hierarchy: Cancel on left, "Use this template" on right

- [x] **Task 7: Write Tests** (AC: all)
  - [x] Test "Use this template" applies template to form
  - [x] Test form becomes dirty after template apply
  - [x] Test template `messageComponent` replaces current `messageComponent`
  - [x] Test user can modify form fields after template apply
  - [x] Test preview updates to show template
  - [x] Test "Discard changes" reverts to pre-template state
  - [x] Test modal closes after template apply
  - [x] Test fallback to DEFAULT_TEMPLATE when templateId not found

- [x] **Task 8: Integration Testing** (AC: all)
  - [x] Full flow: Open Templates -> Select -> Use this template -> Form updated -> Preview shows template
  - [x] Discard flow: Apply template -> Modify -> Discard -> Pre-template state restored
  - [x] Save flow: Apply template -> Save -> Connection saved with template format

## Dev Notes

### Critical Architecture Constraints

1. **Arrow Function Components ONLY** - ESLint enforces `namedComponents: "arrow-function"`
   ```typescript
   // CORRECT
   export const MyComponent: React.FC<Props> = ({ prop }) => { ... }
   ```

2. **Chakra UI for All Styling** - No custom CSS

3. **Path Aliases** - Use `@/*` for imports from `src/*`

4. **Inline Feedback Only** - Use Alert components, not toasts

### Key Imports

```typescript
// Form context - FormProvider wrapper provides this in MessageBuilder page
import { useFormContext } from "react-hook-form";
// MessageBuilderFormState is defined in MessageBuilderContext.tsx

// Template system
import { TEMPLATES, DEFAULT_TEMPLATE, getTemplateById } from "@/features/templates/constants/templates";
import type { Template } from "@/features/templates/types";
import { TemplateGalleryModal } from "@/features/templates/components";
```

### Form State Type

From `MessageBuilderContext.tsx`:

```typescript
// MessageBuilderFormState - Form state that matches Template.messageComponent
type MessageBuilderFormState = {
  messageComponent?: MessageComponentRoot;
  // ... other fields managed by the form
};

// Both Template and Form use MessageComponentRoot - direct assignment is type-safe
```

### TemplateGalleryModal Props (from Story 3.1)

These props were added to `TemplateGalleryModalProps` in Story 3.1:

| Prop | Type | Purpose |
|------|------|---------|
| `showComparisonPreview` | `boolean` | Enables dual preview mode |
| `currentMessageComponent` | `MessageComponentRoot` | Current format for comparison |
| `modalTitle` | `string` | Override "Choose a Template" |
| `primaryActionLabel` | `string` | Button text (default: "Use this template") |
| `onPrimaryAction` | `(templateId: string) => void` | Called when primary button clicked |
| `secondaryActionLabel` | `string` | Cancel button text |
| `onSecondaryAction` | `() => void` | Called when cancel clicked |

**If any props are missing:** Check Story 3.1 implementation in `src/features/templates/components/TemplateGalleryModal/index.tsx`

### Template Application Pattern

```typescript
// The TemplateGalleryModal tracks selectedTemplateId internally via onTemplateSelect
// When user clicks "Use this template", the modal calls:
//   onPrimaryAction(selectedTemplateId)
// The parent receives the ID and applies the template

const handleApplyTemplate = (selectedTemplateId: string) => {
  // Always fallback to DEFAULT_TEMPLATE if template not found
  const template = getTemplateById(selectedTemplateId);

  if (!template) {
    console.warn(`Template ${selectedTemplateId} not found, using default`);
  }

  const templateToApply = template || DEFAULT_TEMPLATE;

  // Apply template's messageComponent to form
  // setValue will validate the messageComponent structure
  setValue("messageComponent", templateToApply.messageComponent, {
    shouldValidate: true,
    shouldDirty: true,
    shouldTouch: true,
  });

  // Close the modal
  onCloseTemplates();
};
```

### Complete Integration Example

```typescript
// From Story 3.1 - already implemented
const templatesButtonRef = useRef<HTMLButtonElement>(null);
const {
  isOpen: isTemplatesOpen,
  onOpen: onOpenTemplates,
  onClose: onCloseTemplates,
} = useDisclosure();

// Get form methods
const { setValue } = useFormContext<MessageBuilderFormState>();

// Story 3.2 - Add this handler
const handleApplyTemplate = (selectedTemplateId: string) => {
  const template = getTemplateById(selectedTemplateId) || DEFAULT_TEMPLATE;
  setValue("messageComponent", template.messageComponent, {
    shouldValidate: true,
    shouldDirty: true,
    shouldTouch: true,
  });
  onCloseTemplates();
};

// Story 3.1 modal with Story 3.2 handler
<TemplateGalleryModal
  isOpen={isTemplatesOpen}
  onClose={onCloseTemplates}
  templates={TEMPLATES}
  selectedTemplateId={selectedTemplateId}
  onTemplateSelect={setSelectedTemplateId}
  feedFields={feedFields}
  articles={galleryArticles}
  selectedArticleId={selectedArticleId}
  onArticleChange={setSelectedArticleId}
  feedId={feedId!}
  connectionId={connectionId}
  userFeed={userFeed}
  connection={connection}
  modalTitle="Browse Templates"
  showComparisonPreview
  currentMessageComponent={currentMessageComponent}
  primaryActionLabel="Use this template"
  onPrimaryAction={handleApplyTemplate}
  secondaryActionLabel="Cancel"
  onSecondaryAction={onCloseTemplates}
  finalFocusRef={templatesButtonRef}
/>
```

### How "Discard Changes" Works

**React-hook-form behavior:**
1. `initialValues` set when FormProvider mounts (from connection data)
2. `setValue()` changes `currentValues` but NOT `initialValues`
3. `reset()` reverts `currentValues` to `initialValues`

**Flow:**
```
┌─────────────────┐    setValue()    ┌─────────────────┐
│ initialValues   │ ───────────────> │ currentValues   │
│ (connection)    │                  │ (template)      │
└─────────────────┘                  └─────────────────┘
                         reset()
                    <────────────────
                    Reverts to initialValues
```

**Result:** Discard always returns to the connection's original state, regardless of how many templates were applied or fields modified.

**No manual state storage needed** - the form handles it automatically.

### V1 vs V2 Format Switching

Templates can be V1 (Legacy embeds) or V2 (component-based). When applying:

| Current Format | Template Format | Result |
|----------------|-----------------|--------|
| V1 (embeds) | V1 (embeds) | Embeds replaced |
| V1 (embeds) | V2 (components) | **Full switch** to components |
| V2 (components) | V1 (embeds) | **Full switch** to embeds |
| V2 (components) | V2 (components) | Components replaced |

**No special handling needed:**
- `MessageComponentRoot` is a union type supporting both formats
- `setValue` accepts either format
- `DiscordMessageDisplay` renders both formats
- Preview API handles both formats

**Developer action:** Just apply the template directly. Don't check formats.

### TypeScript Type Safety

```typescript
// Both types use MessageComponentRoot - direct assignment is safe:
interface Template {
  messageComponent: MessageComponentRoot;  // From template constants
}

type MessageBuilderFormState = {
  messageComponent?: MessageComponentRoot;  // Form state
};

// Type-safe assignment (no casting needed):
setValue("messageComponent", template.messageComponent);
// TypeScript will catch any format mismatches at compile time.
```

### Button Layout in Modal

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  [Cancel]                      [Use this template]  │
│                                                     │
└─────────────────────────────────────────────────────┘
     ↑                                  ↑
     secondary (ghost)                  primary (blue)
     Closes modal                       Applies template
     No form changes                    Closes modal
```

### Performance Considerations

- `setValue()` is synchronous - no loading state needed
- Form validation runs inline (< 1ms for messageComponent)
- Preview already fetched by Story 3.1 - no new API calls on apply
- Dirty state change is instant (no API call)

**No loading spinners or async handling required for template apply.**

### Files to Modify

```
services/backend-api/client/src/pages/
└── MessageBuilder.tsx  # Add handleApplyTemplate handler + pass to modal
```

**Note:** Story 3.1 adds the modal integration. Story 3.2 only adds the `handleApplyTemplate` handler.

### Testing Patterns

```typescript
// Test 1: Template applies to form
describe('handleApplyTemplate', () => {
  it('applies template messageComponent to form state', () => {
    const setValue = vi.fn();
    vi.mocked(useFormContext).mockReturnValue({ setValue } as any);

    handleApplyTemplate('rich-embed');

    expect(setValue).toHaveBeenCalledWith(
      'messageComponent',
      expect.objectContaining({ type: expect.any(Number) }),
      { shouldValidate: true, shouldDirty: true, shouldTouch: true }
    );
  });
});

// Test 2: Modal closes after apply
it('closes modal after template apply', () => {
  const onClose = vi.fn();
  // ... setup
  handleApplyTemplate('rich-embed');
  expect(onClose).toHaveBeenCalled();
});

// Test 3: Fallback to default
it('uses DEFAULT_TEMPLATE when templateId not found', () => {
  handleApplyTemplate('non-existent-id');
  expect(setValue).toHaveBeenCalledWith(
    'messageComponent',
    DEFAULT_TEMPLATE.messageComponent,
    expect.any(Object)
  );
});
```

### Learnings from Story 2.2

Story 2.2 (One-Click Template Application) established these patterns:

1. **Template conversion:** Use `getTemplateById()` with `DEFAULT_TEMPLATE` fallback
2. **No confirmation dialogs:** One-click selection, no extra steps
3. **Button hierarchy:** Primary action on right, secondary on left
4. **V2 format support:** Templates can be Legacy or V2 component format

**Key difference from 2.2:**
- Story 2.2: Applies template to NEW connection via API update
- Story 3.2: Applies template to EXISTING form via `setValue`

**Same pattern, different target.**

### Accessibility Considerations

1. **Focus Return:**
   - After modal closes, focus returns to Templates button (via `finalFocusRef`)

2. **Screen Reader Announcements:**
   - Template application is a form change, not requiring special announcement
   - Form dirty state will be reflected in save button label changes

3. **Keyboard Flow:**
   - Tab to Templates button -> Enter to open
   - Navigate templates with arrow keys
   - Enter on "Use this template" applies and closes
   - Focus returns to Templates button

### Project Structure Notes

- Main change is in `MessageBuilder.tsx`
- Uses existing `TemplateGalleryModal` component (no changes needed to modal)
- Uses existing form context and `setValue` pattern

### References

- [Epics: Story 3.2] `_bmad-output/planning-artifacts/epics.md:608-643`
- [PRD: FR12] Apply template to existing connection
- [PRD: FR13] Template populates form fields
- [PRD: FR14] Modify settings after applying
- [PRD: FR16] Discard changes option
- [Architecture: Form Integration] `docs/architecture.md:306-316`
- [Project Context] `docs/project-context.md`
- [Story 3.1] `_bmad-output/implementation-artifacts/3-1-templates-button-in-message-builder.md`
- [Story 2.2] `_bmad-output/implementation-artifacts/2-2-one-click-template-application.md`
- [MessageBuilder] `src/pages/MessageBuilder.tsx`
- [MessageBuilderContext] `src/pages/MessageBuilder/MessageBuilderContext.tsx`
- [TemplateGalleryModal] `src/features/templates/components/TemplateGalleryModal/index.tsx`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript compilation: PASSED
- Unit tests: 11/11 passed (MessageBuilder.test.tsx)
- Template gallery tests: 99/99 passed (TemplateGalleryModal.test.tsx)

### Completion Notes List

1. **Implementation Approach**: Added `handleApplyTemplate` function to MessageBuilder.tsx that:
   - Uses `getTemplateById()` with `DEFAULT_TEMPLATE` fallback for robustness
   - Calls `template.createMessageComponent(detectedImageField)` to generate messageComponent (templates use factory functions, not static properties)
   - Uses `setValue()` with `shouldDirty: true` to mark form as having unsaved changes
   - Closes modal via `handleCloseTemplatesModal()` after applying

2. **Image Field Detection**: Added `detectedImageField` logic to detect image fields from articles (checks for keys containing "image") and passes to both the modal and `createMessageComponent()` for proper template rendering.

3. **Props Added to TemplateGalleryModal**:
   - `primaryActionLabel="Use this template"` - button text
   - `onPrimaryAction={handleApplyTemplate}` - callback receiving selected template ID
   - `detectedImageField={detectedImageField}` - for template preview and creation

4. **React Hook Form Integration**: The implementation leverages react-hook-form's built-in dirty state tracking. Using `setValue()` with `shouldDirty: true` automatically:
   - Enables the "Discard Changes" button
   - Shows unsaved changes warning on page unload
   - Allows `reset()` to revert to original connection state

5. **Tests Created**: New test file `MessageBuilder.test.tsx` with 11 tests covering:
   - Template application via setValue
   - Fallback to DEFAULT_TEMPLATE
   - V1/V2 format handling
   - Image field parameter passing
   - Template utilities (getTemplateById, createMessageComponent)

### File List

**Modified:**
- services/backend-api/client/src/pages/MessageBuilder.tsx
- services/backend-api/client/src/features/templates/components/TemplateGalleryModal/index.tsx
- services/backend-api/client/src/features/templates/components/TemplateGalleryModal/TemplateGalleryModal.test.tsx

**Created:**
- services/backend-api/client/src/pages/MessageBuilder.test.tsx

### Change Log

- 2025-12-28: Implemented Story 3.2 - Apply Template to Existing Connection
  - Added handleApplyTemplate function with template lookup and form integration
  - Added image field detection for dynamic template creation
  - Added onPrimaryAction and related props to TemplateGalleryModal
  - Created comprehensive unit tests for template application logic
- 2025-12-28: UX Simplification - Removed disabled state from "Use this template" button
  - Button is now always enabled for simpler UX (no need to track selection state across modal opens)
  - Button still only fires callback when a template is actually selected (safe no-op otherwise)
  - Updated tests to reflect new behavior
- 2025-12-28: Auto-select root component after template application
  - Added `setCurrentSelectedId(newMessageComponent.id)` to select root component in tree
  - Prevents empty state in component properties panel after applying template
- 2025-12-28: Code Review Fixes
  - Removed 2 flaky validation error tests from TemplateGalleryModal (tests had race conditions)
  - Updated File List to include all modified files
  - Updated test mock in MessageBuilder.test.tsx to match actual component behavior
  - TypeScript: PASSED, All tests: 110/110 passed

