# Story 2.2: One-Click Template Application

Status: ready-for-dev

## Dependencies

- **Epic 1 (Completed):** Template Gallery Foundation - All components from Epic 1 are implemented:
  - Story 1.1: `Template` interface, `TEMPLATES` array, `DEFAULT_TEMPLATE`
  - Story 1.2: `DiscordMessageDisplay` component
  - Story 1.3: `TemplateCard` with radio button integration
  - Story 1.4: `TemplateGalleryModal` component
  - Story 1.5: Accessibility features verified
- **Story 2.1 (In Progress):** Template Selection Step in Connection Flow - provides the step-based dialog architecture

## Story

As a new user,
I want to apply a template with a single click,
So that I can quickly choose how my messages look without complex configuration.

## Business Context

This story completes the "one-click" simplicity promise of Epic 2. While Story 2.1 integrated the template gallery into the connection flow, this story ensures the template application itself is seamless - select a template and you're done. No confirmation dialogs, no extra steps.

**Target Persona: Alex** - the community manager who wants to be delivering formatted messages in under 3 minutes.

## Acceptance Criteria

1. **Given** I am in the template gallery during connection creation
   **When** I click on an enabled template card
   **Then** the template is selected with one click (no confirmation dialog required)

2. **Given** I have selected a template
   **When** the template is applied to my connection
   **Then** the connection's `messageComponent` is set to the template's `messageComponent` structure

3. **Given** I am in the template gallery
   **When** I click the "Skip" button (secondary action)
   **Then** the default template is automatically applied to my connection

4. **Given** I skip template selection
   **When** my connection is created
   **Then** it uses the default template settings (FR23 - skip = default applied)

5. **Given** I have selected a template
   **When** I want to change my mind before finalizing
   **Then** I can click a different template to switch my selection (no penalty, no extra steps)

6. **Given** the template gallery modal footer
   **When** I view the action buttons
   **Then** they follow the button hierarchy: "Customize manually" (tertiary/link) on left, "Skip" (secondary) in center-right, primary action on right

## Tasks / Subtasks

- [ ] **Task 0: Create Template Preview Endpoint for Connection Creation** (AC: #1 prerequisite)
  - [ ] Create new minimal API endpoint: `POST /feeds/:feedId/preview-template`
  - [ ] **Follow existing preview API contract** - same response format as `/connections/:connectionId/preview`
  - [ ] **Minimal request body** - remove connection-specific fields:
    - Required: `{ articleId, content?, embeds?, componentsV2? }` (template data)
    - NOT required: connectionId, connection-specific settings
  - [ ] Backend renders template with article data and returns Discord message format
  - [ ] Update `TemplateGalleryModal` to use this endpoint when `connectionId` is not provided
  - [ ] Reuse existing preview rendering logic internally (DRY)
  - [ ] **Context:** During connection creation, no connectionId exists yet, so the existing preview endpoint can't be used

- [ ] **Task 0.5: Add Step Indicator to Connection Creation Wizard** (UX enhancement)
  - [ ] Add visual step indicator showing progress (e.g., "Step 1 of 2" or Chakra Stepper)
  - [ ] Step 1: Server/Channel selection
  - [ ] Step 2: Template selection
  - [ ] Consider using Chakra's `Stepper` component or simple text in modal header
  - [ ] **Context:** Currently no visual indicator of wizard progress; users don't know they're in a multi-step flow

- [ ] **Task 1: Verify Template Selection is Already One-Click** (AC: #1, #5)
  - [ ] Confirm `TemplateGalleryModal` already handles one-click selection via `onTemplateSelect`
  - [ ] Confirm no confirmation dialogs exist in current implementation
  - [ ] Verify template can be changed by clicking a different card (no penalty)
  - [ ] Ensure radio button group allows instant switching

- [ ] **Task 2: Verify Template Application in Connection Flow** (AC: #2)
  - [ ] Review `DiscordTextChannelConnectionDialogContent.tsx:226-277` for template application
  - [ ] Confirm `convertMessageBuilderStateToConnectionPreviewInput` correctly transforms template
  - [ ] Verify `updateMutateAsync` receives the template data (content, embeds, componentRows, componentsV2)
  - [ ] Test that `messageComponent` from template becomes the connection's message format

- [ ] **Task 3: Verify Skip Button Applies Default Template** (AC: #3, #4)
  - [ ] Review `onSecondaryAction` handler (line 334-337) applies `DEFAULT_TEMPLATE`
  - [ ] Confirm `setSelectedTemplateId(undefined)` results in `DEFAULT_TEMPLATE` being used
  - [ ] Verify line 227-229: `selectedTemplateId ? getTemplateById(selectedTemplateId) : DEFAULT_TEMPLATE`
  - [ ] Test skip flow creates connection with default template format

- [x] **Task 4: Verify Button Hierarchy** (AC: #6) - UPDATED
  - [x] Confirm current button layout:
    - Tertiary "Back" on left - returns to server/channel step
    - Secondary "Skip" in center-right - creates with default template
    - Primary "Continue" on right - creates with selected template
  - [x] **NOTE:** "Customize manually" is NOT appropriate for creation flow (redundant with Skip)
  - [x] "Customize manually" reserved for Story 3.x (applying templates to existing connections)

- [ ] ~~**Task 5: Implement "Customize manually" Escape Hatch**~~ - REMOVED
  - **Reason:** During connection creation, "Customize manually" is redundant with "Skip" - both would create connection with default template. The escape hatch makes more sense for Story 3.x where users can apply a template to an existing connection AND navigate to Message Builder.

- [x] **Task 6: Verify All Dialogs Have Consistent Button Layout** (AC: all)
  - [x] All three dialogs (Text, Forum, Webhook) use "Back" for tertiary action
  - [x] Verified in Story 2.1 code review

- [ ] **Task 7: Write Tests** (AC: all)
  - [ ] Test template selection updates state without confirmation
  - [ ] Test template switching between different templates
  - [ ] Test Skip applies DEFAULT_TEMPLATE
  - [ ] Test "Customize manually" flow
  - [ ] Test connection creation includes template's messageComponent

- [ ] **Task 8: Manual Testing and Verification** (AC: all)
  - [ ] Test one-click selection flow
  - [ ] Test Skip flow with default template
  - [ ] Test "Customize manually" escape hatch
  - [ ] Verify button hierarchy visually matches spec

## Dev Notes

### IMPORTANT: Template Preview Gap from Story 2.1

**Issue identified in code review:** The template preview doesn't work during connection creation because the existing preview endpoint requires a `connectionId`, which doesn't exist yet.

**Current behavior:**
- `TemplateGalleryModal` shows "Preview requires a connection" message
- Users cannot see what templates look like before committing

**Solution (Task 0):**
- Create a new minimal preview endpoint: `POST /feeds/:feedId/preview-template`
- Accepts `{ articleId, templateData }` without requiring connectionId
- Frontend calls this endpoint when in "creation mode" (no existing connection)

### Critical Architecture Constraints

**MUST FOLLOW - These are non-negotiable:**

1. **Arrow Function Components ONLY** - ESLint enforces `namedComponents: "arrow-function"`
   ```typescript
   // CORRECT
   export const MyComponent: React.FC<Props> = ({ prop }) => { ... }

   // WRONG - will fail ESLint
   export function MyComponent({ prop }: Props) { ... }
   ```

2. **Use Existing TemplateGalleryModal** - Do NOT modify the gallery selection logic. The component at `src/features/templates/components/TemplateGalleryModal/index.tsx` already handles:
   - One-click selection via radio button group pattern
   - No confirmation dialogs
   - Instant template switching

3. **Template Application Pattern** - Already implemented in Story 2.1:
   ```typescript
   // In DiscordTextChannelConnectionDialogContent.tsx:260-277
   const templateData = convertMessageBuilderStateToConnectionPreviewInput(
     userFeed,
     tempConnection,
     templateToApply.messageComponent
   );

   await updateMutateAsync({
     feedId,
     connectionId: newConnectionId,
     details: {
       content: templateData.content,
       embeds: templateData.embeds,
       componentRows: templateData.componentRows,
       componentsV2: templateData.componentsV2,
       placeholderLimits: templateData.placeholderLimits,
     },
   });
   ```

4. **Path Aliases** - Use `@/*` for imports from `src/*`

5. **Chakra UI for All Styling** - No custom CSS

### Current Implementation Analysis (Story 2.1)

**What's Already Working:**
- One-click template selection via `onTemplateSelect` callback
- Template switching by clicking different cards (radio group behavior)
- Skip button applies default template (line 227-229)
- Template application via `updateMutateAsync` after connection creation

**What's Been Resolved (Story 2.1 Code Review):**
- ~~Tertiary action is "Back" but should be "Customize manually"~~ - RESOLVED: "Back" is CORRECT for creation flow
- "Customize manually" is redundant with "Skip" during creation (both create with default template)
- "Customize manually" reserved for Story 3.x (existing connections)

### Button Hierarchy Implementation

**UPDATED - Creation Flow (Story 2.1/2.2):**

```
+-------------------------------------------------------------------+
| [Back]                              [Skip]            [Continue] |
+-------------------------------------------------------------------+
     ↑ tertiary/link               ↑ secondary          ↑ primary
     returns to step 1             default template     selected template
```

**Existing Connection Flow (Story 3.x - future):**

```
+-------------------------------------------------------------------+
| [Customize manually]                [Skip]            [Apply]    |
+-------------------------------------------------------------------+
     ↑ tertiary/link               ↑ secondary          ↑ primary
     apply + open builder          just apply           just apply
```

### "Customize manually" - Reserved for Story 3.x

During connection CREATION, "Customize manually" doesn't make sense because:
1. No connection exists yet to customize
2. It would do the same as "Skip" (create with default template)
3. User would need to navigate to Message Builder manually anyway

For EXISTING connections (Story 3.x), "Customize manually" makes sense:
1. User has an existing connection
2. Apply template AND navigate to Message Builder
3. User can immediately tweak the applied template
4. User has full access to all message formatting options

### Default Template Application

The default template application is already correct in line 227-229:

```typescript
const templateToApply = selectedTemplateId
  ? getTemplateById(selectedTemplateId) || DEFAULT_TEMPLATE
  : DEFAULT_TEMPLATE;
```

When Skip is clicked:
1. `setSelectedTemplateId(undefined)` is called (line 335)
2. `handleSubmit(onSubmit)()` is called (line 336)
3. In `onSubmit`, `selectedTemplateId` is `undefined`
4. `templateToApply` becomes `DEFAULT_TEMPLATE`
5. Connection is created with default template

### Available Templates

From `src/features/templates/constants/templates.ts`:
- **Simple Text** (default): `requiredFields: []` - works with any feed
- **Rich Embed**: `requiredFields: ["description"]`
- **Compact Card**: `requiredFields: []` - works with any feed (V2 format)
- **Media Gallery**: `requiredFields: ["image"]`

### Key Imports

```typescript
import { TEMPLATES, DEFAULT_TEMPLATE, getTemplateById } from "@/features/templates/constants/templates";
import { Template } from "@/features/templates/types";
import { TemplateGalleryModal, isTemplateCompatible } from "@/features/templates/components/TemplateGalleryModal";
```

### Files to Modify

```
services/backend-api/client/src/features/feedConnections/components/AddConnectionDialog/
├── DiscordTextChannelConnectionDialogContent.tsx      # Update tertiary action
├── DiscordForumChannelConnectionDialogContent.tsx     # Add template step + patterns
└── DiscordApplicationWebhookConnectionDialogContent.tsx # Add template step + patterns
```

### Previous Story Intelligence (from 2-1)

**Patterns Established:**
- Step-based dialog with `ConnectionCreationStep` enum
- Template state management: `selectedTemplateId`, `selectedArticleId`
- Articles fetched via `useUserFeedArticles` hook
- Feed fields extracted: `Object.keys(articles[0]).filter(...)`
- Template applied in `onSubmit` via `convertMessageBuilderStateToConnectionPreviewInput`
- Two-phase creation: create connection, then update with template

**Template Application Flow (working):**
1. Create connection with basic details
2. Get `newConnectionId` from result
3. Build `tempConnection` object for conversion
4. Call `convertMessageBuilderStateToConnectionPreviewInput`
5. Update connection with template data via `updateMutateAsync`

### Git Intelligence (Recent Commits)

From recent Epic 1 and 2.1 commits:
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
- Template selection state changes correctly
- Skip handler sets `selectedTemplateId` to undefined
- "Customize manually" triggers connection creation

**Integration Tests:**
- Full flow: Select template → Continue → Connection created with template
- Skip flow: Skip → Connection created with default template
- "Customize manually" flow: Creates connection, navigates to Message Builder
- Template switching: Select A → Select B → Continue → Connection has B's format

### Accessibility Considerations

All accessibility is handled by `TemplateGalleryModal` from Story 1.5:
- Radio button group pattern for one-click selection
- Keyboard navigation (arrow keys to switch, Enter/Space to select)
- Screen reader announces selection changes
- Focus management within modal

### References

- [Architecture: Template Application] docs/architecture.md:179-186
- [UX: Button Hierarchy] docs/ux-design-specification.md:747-750
- [Epics: Story 2.2] docs/epics.md:434-466
- [PRD: FR4] One-click template application
- [PRD: FR23] Skip = default template applied
- [Project Context] docs/project-context.md (TypeScript rules, component patterns)
- [Story 2.1] implementation-artifacts/2-1-template-selection-step-in-connection-flow.md

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
