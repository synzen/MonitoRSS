# Story 2.3: Empty Feed Handling

Status: ready-for-dev

## Dependencies

- **Epic 1 (Completed):** Template Gallery Foundation - All components from Epic 1 are implemented:
  - Story 1.1: `Template` interface, `TEMPLATES` array, `DEFAULT_TEMPLATE`
  - Story 1.2: `DiscordMessageDisplay` component
  - Story 1.3: `TemplateCard` with radio button integration
  - Story 1.4: `TemplateGalleryModal` component
  - Story 1.5: Accessibility features verified
- **Story 2.1 (Complete):** Template Selection Step in Connection Flow - provides the step-based dialog architecture
- **Story 2.2 (In Progress):** One-Click Template Application - provides template application logic

## Story

As a user with a feed that has no articles yet,
I want to still be able to complete connection setup with a safe default,
So that I'm not blocked from setting up my connection while waiting for feed content.

## Business Context

This story ensures new users aren't blocked during onboarding when their RSS feed is new or temporarily empty. Users should never see an error or be prevented from completing setup - instead, they get a sensible default with clear messaging about why some options are unavailable.

**Target Persona: Alex** - the community manager setting up a feed for a newly launched blog that doesn't have articles yet.

**Key UX Principle:** Never block the user. Empty state is a valid state, not an error.

## Acceptance Criteria

1. **Given** I am on the template selection step
   **When** my feed has no articles available
   **Then** the default template is the only selectable option

2. **Given** I am on the template selection step with an empty feed
   **When** I view the template gallery
   **Then** all templates except the default are displayed but visually greyed out/disabled

3. **Given** a template is disabled due to empty feed
   **When** I view the template card
   **Then** it displays a "Needs articles" badge explaining why it's unavailable

4. **Given** I am on the template selection step with an empty feed
   **When** the gallery opens
   **Then** an info banner at the top explains: "Some templates are unavailable until your feed has articles"

5. **Given** I am on the template selection step with an empty feed
   **When** I view the default template
   **Then** it is automatically selected and the preview shows a placeholder or sample rendering

6. **Given** I proceed with the default template on an empty feed
   **When** my connection is created
   **Then** I can return later via the message builder to change templates once articles are available (FR21)

7. **Given** I have an empty feed
   **When** I click on a disabled template card
   **Then** nothing happens (the click is ignored, no error shown)

## Tasks / Subtasks

- [ ] **Task 1: Detect Empty Feed State** (AC: #1, #4)
  - [ ] In `DiscordTextChannelConnectionDialogContent.tsx`, check if `articles.length === 0`
  - [ ] Create `isEmptyFeed` boolean derived state
  - [ ] Pass `isEmptyFeed` to `TemplateGalleryModal` or use existing props

- [ ] **Task 2: Update TemplateGalleryModal for Empty Feed** (AC: #2, #3, #4, #7)
  - [ ] Review current `TemplateGalleryModal` component for empty feed handling
  - [ ] Add info banner at top when feed has no articles
  - [ ] Ensure non-default templates are disabled when `feedFields` is empty or no articles
  - [ ] Verify "Needs articles" badge displays on disabled template cards
  - [ ] Confirm clicks on disabled templates are ignored

- [ ] **Task 3: Auto-Select Default Template for Empty Feeds** (AC: #5)
  - [ ] When `isEmptyFeed` and no template selected, auto-select `DEFAULT_TEMPLATE`
  - [ ] Update `selectedTemplateId` state to default template ID automatically
  - [ ] Ensure this happens in `useEffect` when articles load (or don't load)

- [ ] **Task 4: Preview Placeholder for Empty Feed** (AC: #5)
  - [ ] When no articles available, show placeholder preview
  - [ ] Use sample/mock data OR show "Preview will appear when articles are available"
  - [ ] Ensure preview panel doesn't show loading spinner indefinitely

- [ ] **Task 5: Verify Connection Can Be Created Without Articles** (AC: #6)
  - [ ] Test that `onSubmit` works when `articles.length === 0`
  - [ ] Verify `DEFAULT_TEMPLATE` is applied correctly
  - [ ] Confirm connection is created successfully
  - [ ] Test user can return to Message Builder later (existing functionality)

- [ ] **Task 6: Update Forum and Webhook Dialogs** (AC: all)
  - [ ] Apply same empty feed handling to `DiscordForumChannelConnectionDialogContent.tsx`
  - [ ] Apply same empty feed handling to `DiscordApplicationWebhookConnectionDialogContent.tsx`
  - [ ] Ensure consistent UX across all connection types

- [ ] **Task 7: Write Tests** (AC: all)
  - [ ] Test empty feed detection
  - [ ] Test default template auto-selection
  - [ ] Test info banner displays for empty feed
  - [ ] Test disabled templates cannot be selected
  - [ ] Test connection creation succeeds with empty feed

- [ ] **Task 8: Manual Testing and Verification** (AC: all)
  - [ ] Test with a feed that has no articles
  - [ ] Verify visual disabled state on template cards
  - [ ] Verify "Needs articles" badge displays
  - [ ] Verify info banner message
  - [ ] Verify can complete connection setup

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

2. **Chakra UI for All Styling** - No custom CSS. Use Chakra's `Alert` component for the info banner:
   ```typescript
   import { Alert, AlertIcon, AlertDescription } from "@chakra-ui/react";

   <Alert status="info" mb={4}>
     <AlertIcon />
     <AlertDescription>
       Some templates are unavailable until your feed has articles
     </AlertDescription>
   </Alert>
   ```

3. **Path Aliases** - Use `@/*` for imports from `src/*`

4. **Use Existing Components** - Do NOT create new components if existing ones suffice

### Current Implementation Analysis

**In `DiscordTextChannelConnectionDialogContent.tsx` (lines 294-319):**
```typescript
// Fetch articles for template compatibility and preview
const { data: articlesData } = useUserFeedArticles({
  feedId,
  data: {
    skip: 0,
    limit: 10,
    selectProperties: ["id", "title", "description", "link", "image"],
    // ... formatOptions
  },
  disabled: !userFeed || currentStep !== ConnectionCreationStep.TemplateSelection,
});

// Extract feed fields from articles
const articles = articlesData?.result?.articles || [];
const feedFields = articles.length > 0
  ? Object.keys(articles[0]).filter(
      (key) => key !== "id" && key !== "idHash" && (articles[0] as Record<string, unknown>)[key] !== undefined
    )
  : [];
```

**Key Insight:** When `articles.length === 0`, `feedFields` is also empty (`[]`).

**In `TemplateGalleryModal` (from Story 1.4):**
The `isTemplateCompatible` function already handles empty feedFields:
```typescript
export function isTemplateCompatible(template: Template, feedFields: string[]): boolean {
  if (!template.requiredFields || template.requiredFields.length === 0) {
    return true;  // Default template has empty requiredFields, so it's always compatible
  }
  return template.requiredFields.every((field) => feedFields.includes(field));
}
```

**This means:**
- `DEFAULT_TEMPLATE` (Simple Text) with `requiredFields: []` is always compatible
- All other templates with `requiredFields` will be incompatible when `feedFields = []`

### Empty Feed Detection Logic

Add to `DiscordTextChannelConnectionDialogContent.tsx`:
```typescript
const isEmptyFeed = articles.length === 0;

// Auto-select default template when feed is empty
useEffect(() => {
  if (isEmptyFeed && !selectedTemplateId) {
    setSelectedTemplateId(DEFAULT_TEMPLATE.id);
  }
}, [isEmptyFeed, selectedTemplateId]);
```

### Info Banner for Empty Feed

The `TemplateGalleryModal` needs to show an info banner when `articles.length === 0` or when only one template is compatible.

**Option 1: Pass `isEmptyFeed` prop to TemplateGalleryModal:**
```typescript
<TemplateGalleryModal
  // ... existing props
  isEmptyFeed={isEmptyFeed}
/>
```

**Option 2: Derive empty state inside modal from articles array:**
```typescript
// Inside TemplateGalleryModal
const isEmptyFeed = articles.length === 0;
```

**Option 2 is preferred** - modal already has `articles` prop, derive state internally.

### TemplateCard Disabled State

From Story 1.3, `TemplateCard` already supports a disabled state:
```typescript
interface TemplateCardProps {
  template: Template;
  isSelected: boolean;
  isDisabled: boolean;
  onSelect: () => void;
  // ...
}
```

When `isDisabled={true}`:
- Card appears greyed out (reduced opacity)
- Cursor shows `not-allowed`
- "Needs articles" badge displays
- onClick is ignored

**Verify this behavior is implemented** in `src/features/templates/components/TemplateCard/index.tsx`.

### Preview Panel for Empty Feed

When no articles available, the preview should show meaningful content:

**Option A: Placeholder message**
```typescript
{articles.length === 0 ? (
  <Box textAlign="center" color="gray.500" p={4}>
    <Text>Preview will appear when your feed has articles</Text>
  </Box>
) : (
  <DiscordMessageDisplay ... />
)}
```

**Option B: Sample data preview** (Better UX)
```typescript
const sampleArticle = {
  id: "sample",
  title: "Your Article Title Will Appear Here",
  description: "Article description will be shown in this area...",
  link: "https://example.com/article",
};
```

### Available Templates Reference

From `src/features/templates/constants/templates.ts`:

| Template | ID | requiredFields | Compatible with Empty Feed? |
|----------|-----|---------------|----------------------------|
| Simple Text | `simple-text` | `[]` | Yes (DEFAULT) |
| Rich Embed | `rich-embed` | `["description"]` | No |
| Compact Card | `compact-card` | `[]` | Yes |
| Media Gallery | `media-gallery` | `["image"]` | No |

**Note:** Compact Card has `requiredFields: []` so it should also be selectable with empty feeds. Verify this is intentional or if it should require fields.

### Files to Modify

```
services/backend-api/client/src/
├── features/
│   ├── feedConnections/components/AddConnectionDialog/
│   │   ├── DiscordTextChannelConnectionDialogContent.tsx    # Add empty feed handling
│   │   ├── DiscordForumChannelConnectionDialogContent.tsx   # Add empty feed handling
│   │   └── DiscordApplicationWebhookConnectionDialogContent.tsx # Add empty feed handling
│   └── templates/components/
│       ├── TemplateGalleryModal/index.tsx  # Add info banner for empty feed
│       └── TemplateCard/index.tsx          # Verify disabled state with badge
```

### Previous Story Intelligence (from 2.1 and 2.2)

**Patterns Established:**
- Step-based dialog with `ConnectionCreationStep` enum
- Articles fetched via `useUserFeedArticles` hook with `disabled` flag
- Feed fields extracted: `Object.keys(articles[0]).filter(...)`
- Template compatibility checked via `isTemplateCompatible` function
- Auto-selection of first article in `useEffect`

**Testing Patterns:**
- Tests are co-located: `ComponentName.test.tsx`
- Use `data-testid` for test selectors
- MSW for API mocking in tests

### Git Intelligence (Recent Commits)

```
00d39cf4e Implement 1-5   (Story 1.5 accessibility)
cffa7e2d2 Implement 1-3, 1-4  (TemplateCard, TemplateGalleryModal)
a5aa1087a Implement task 1-2   (DiscordMessageDisplay)
a62779f13 Add templates        (Template types and constants)
```

**Code patterns to follow:**
- Arrow function components with `React.FC<Props>` type
- Chakra UI for all styling
- `data-testid` attributes for testing
- ESLint rules: newline before return, padding around blocks

### Testing Strategy

**Unit Tests:**
- `isEmptyFeed` derived correctly from articles
- Auto-selection of default template when feed is empty
- Info banner renders when `articles.length === 0`

**Integration Tests:**
- Full empty feed flow: Server Channel → Template (only default available) → Submit
- Verify disabled templates cannot be clicked
- Verify connection created with default template

**Mock Setup for Empty Feed:**
```typescript
// MSW handler for empty feed
rest.get('/api/user-feeds/:feedId/articles', (req, res, ctx) => {
  return res(ctx.json({ result: { articles: [] } }));
});
```

### Accessibility Considerations

1. **Info banner** must be announced to screen readers:
   - Use Chakra's `Alert` component which has proper ARIA role

2. **Disabled templates** must announce their state:
   - `aria-disabled="true"` on disabled cards
   - Screen reader should announce "Needs articles" badge content

3. **Auto-selection** should be announced:
   - Live region update when default template is auto-selected

### Project Structure Notes

- Files are in `services/backend-api/client/src/`
- Use `@/` path alias for imports from `src/`
- Components follow feature-based organization: `features/{featureName}/components/`

### References

- [Epics: Story 2.3] `_bmad-output/planning-artifacts/epics.md:467-501`
- [PRD: FR19] Empty feeds: default only selectable
- [PRD: FR20] Empty feeds: others greyed out
- [PRD: FR21] Empty feeds: proceed and return later
- [Project Context] `docs/project-context.md` (TypeScript rules, component patterns)
- [Story 2.1] `_bmad-output/implementation-artifacts/2-1-template-selection-step-in-connection-flow.md`
- [Story 2.2] `_bmad-output/implementation-artifacts/2-2-one-click-template-application.md`

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
