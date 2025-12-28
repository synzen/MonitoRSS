# Story 3.1: Templates Button in Message Builder

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
  - Story 2.2: One-click template application
  - Story 2.3: Empty feed handling
  - Story 2.4: Test send and completion

## Story

As an existing user editing a connection,
I want to access the template gallery from the message builder,
So that I can discover and apply templates to improve my existing connection's formatting.

## Business Context

This story enables **existing users** to discover and leverage the template system. The message builder is where power users customize message formats - adding a "Templates" button provides a discovery path and a quick way to start from a professionally-designed template.

**Target Persona: Sam** - the existing MonitoRSS user who knows the tool works but hasn't invested time in customization.

**Key UX Principles:**
- Templates are a **starting point**, not a locked configuration
- Clear messaging that changes aren't saved until explicit Save
- Easy comparison between current format and template preview
- No disruption to existing message builder workflow

## Acceptance Criteria

1. **Given** I am on the message builder page for an existing connection
   **When** I view the UI
   **Then** I see a "Templates" button prominently placed (but not competing with primary actions)

2. **Given** I click the "Templates" button
   **When** the action completes
   **Then** the Template Gallery Modal opens with my feed's articles available for preview

3. **Given** the Template Gallery Modal opens from the message builder
   **When** I view the templates
   **Then** only templates compatible with my feed's available fields are enabled (same filtering as connection creation)

4. **Given** my existing connection already has a message configuration
   **When** the gallery opens
   **Then** no template is pre-selected (user is browsing, not editing current selection)

5. **Given** the Template Gallery Modal is open
   **When** I click Cancel, X, or press ESC
   **Then** the modal closes and my message builder form is unchanged

6. **Given** the Template Gallery Modal opens from the message builder
   **When** I view the preview area
   **Then** it shows two previews: "Current" (my existing message format) and "Template Preview" (the selected template, or empty state if none selected)

7. **Given** I select a template in the gallery
   **When** the preview updates
   **Then** I can visually compare my current format side-by-side with how the selected template would look

8. **Given** no template is selected yet
   **When** I view the "Template Preview" section
   **Then** it displays a prompt like "Select a template to compare"

9. **Given** I am browsing templates in the modal
   **When** I want to see how a template looks with different content
   **Then** I can use the article selector to change the preview sample data (both previews update)

## Tasks / Subtasks

- [x] **Task 1: Add Templates Button to Message Builder Top Bar** (AC: #1)
  - [x] Add "Templates" button to top bar HStack in `MessageBuilder.tsx` (after "Take Tour", before Discard/Save)
  - [x] Use `variant="outline"` `colorScheme="gray"` `size="sm"` (matching "Take Tour" style)
  - [x] Use `HiTemplate` icon from `react-icons/hi`
  - [x] Add `data-tour-target="templates-button"` for future tour integration
  - [x] Create `templatesButtonRef` with `useRef` for focus management
  - [x] Use `useDisclosure` hook for modal open/close state

- [x] **Task 2: Fetch Articles for Template Gallery** (AC: #2, #3)
  - [x] Add `useUserFeedArticles` hook call with `limit: 10` for gallery dropdown
  - [x] Include `selectProperties: ["id", "title", "description", "link", "image"]`
  - [x] Include `formatOptions` from `useUserFeedConnectionContext`
  - [x] Disable fetch when modal is closed (`disabled: !isTemplatesOpen`)
  - [x] Extract `feedFields` from first article for template compatibility

- [x] **Task 3: Integrate TemplateGalleryModal** (AC: #2, #3, #4, #5)
  - [x] Import `TemplateGalleryModal` from `@/features/templates/components`
  - [x] Import `TEMPLATES` from `@/features/templates/constants`
  - [x] Pass `isOpen={isTemplatesOpen}` and `onClose={onCloseTemplates}`
  - [x] Pass `finalFocusRef={templatesButtonRef}` for focus return
  - [x] Pass `feedId`, `connectionId`, `userFeed`, `connection` from context
  - [x] Pass `selectedTemplateId={undefined}` (no pre-selection)
  - [x] Pass `articles` and `feedFields` from Task 2

- [x] **Task 4: Add Modal Title Customization** (AC: #2)
  - [x] Add `modalTitle?: string` prop to `TemplateGalleryModalProps` interface
  - [x] Update ModalHeader to use `{modalTitle || "Choose a Template"}`
  - [x] Pass `modalTitle="Browse Templates"` from MessageBuilder

- [x] **Task 5: Implement Dual Preview Mode - Layout** (AC: #6, #8)
  - [x] Add `showComparisonPreview?: boolean` prop to `TemplateGalleryModalProps`
  - [x] Add `currentMessageComponent?: MessageComponentRoot` prop
  - [x] When `showComparisonPreview=true`, change Grid layout to accommodate two previews
  - [x] Desktop: Templates grid left, dual preview column right
  - [x] Mobile: Templates grid, then stacked previews below
  - [x] Add "Current Format" and "Template Preview" section labels

- [x] **Task 6: Implement Dual Preview Mode - Current Format Preview** (AC: #6, #7)
  - [x] Add second `useQuery` for current format preview (similar to template preview)
  - [x] Use `convertMessageBuilderStateToConnectionPreviewInput` with `currentMessageComponent`
  - [x] Render current format using `DiscordMessageDisplay`
  - [x] Show loading skeleton while fetching

- [x] **Task 7: Implement Dual Preview Mode - Template Preview** (AC: #7, #8)
  - [x] When no template selected, show placeholder: "Select a template to compare"
  - [x] When template selected, render with `DiscordMessageDisplay`
  - [x] Both previews use same `selectedArticleId` for fair comparison

- [x] **Task 8: Article Selector Updates Both Previews** (AC: #9)
  - [x] Single article selector controls both previews
  - [x] When article changes, both preview queries refetch
  - [x] Clear any cached preview data on article change

- [x] **Task 9: Write Tests** (AC: all)
  - [x] Test Templates button renders in top bar
  - [x] Test clicking button opens modal
  - [x] Test modal displays templates with correct filtering
  - [x] Test no template pre-selected
  - [x] Test modal closes on ESC/X/outside click without form changes
  - [x] Test dual preview shows Current and Template sections
  - [x] Test placeholder shows when no template selected
  - [x] Test article selector updates both previews
  - [x] Test focus returns to Templates button on close

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

### Button Implementation

Add Templates button in `MessageBuilder.tsx` between "Take Tour" and Discard/Save buttons (around line 362):

```typescript
import { HiTemplate } from "react-icons/hi";

// In MessageBuilderContent component
const templatesButtonRef = useRef<HTMLButtonElement>(null);
const {
  isOpen: isTemplatesOpen,
  onOpen: onOpenTemplates,
  onClose: onCloseTemplates,
} = useDisclosure();

// In JSX, after "Take Tour" button
<Button
  ref={templatesButtonRef}
  variant="outline"
  colorScheme="gray"
  size="sm"
  onClick={onOpenTemplates}
  leftIcon={<HiTemplate />}
  data-tour-target="templates-button"
>
  Templates
</Button>
```

### Article Fetching for Gallery

MessageBuilder context fetches only 1 article. For the gallery dropdown, fetch separately:

```typescript
import { useUserFeedArticles } from "@/features/feed/hooks";

// Fetch articles for template gallery (only when modal open)
const { data: galleryArticlesData } = useUserFeedArticles({
  feedId,
  data: {
    skip: 0,
    limit: 10,
    selectProperties: ["id", "title", "description", "link", "image"],
    formatOptions: {
      dateFormat: userFeed?.formatOptions?.dateFormat,
      dateTimezone: userFeed?.formatOptions?.dateTimezone,
      disableImageLinkPreviews: false,
      formatTables: false,
      ignoreNewLines: false,
      stripImages: false,
    },
  },
  disabled: !isTemplatesOpen,
});

const galleryArticles = galleryArticlesData?.result?.articles || [];
const feedFields = galleryArticles.length > 0
  ? Object.keys(galleryArticles[0]).filter(
      (key) => key !== "id" && key !== "idHash" &&
        (galleryArticles[0] as Record<string, unknown>)[key] !== undefined
    )
  : [];
```

### Context Data Access

```typescript
import { useParams } from "react-router-dom";
import { useFormContext } from "react-hook-form";
import { useUserFeedConnectionContext } from "@/contexts/UserFeedConnectionContext";

const { feedId, connectionId } = useParams<RouteParams>();
const { userFeed, connection } = useUserFeedConnectionContext();
const { watch } = useFormContext<MessageBuilderFormState>();
const currentMessageComponent = watch("messageComponent");
```

### TemplateGalleryModal Props Extension

Add these props to `TemplateGalleryModalProps` in `src/features/templates/components/TemplateGalleryModal/index.tsx`:

```typescript
export interface TemplateGalleryModalProps {
  // ... existing props ...

  // Message builder context props
  modalTitle?: string;  // Override "Choose a Template"
  showComparisonPreview?: boolean;  // Enable dual preview mode
  currentMessageComponent?: MessageComponentRoot;  // For current format preview
}
```

Update ModalHeader:
```typescript
<ModalHeader id="template-gallery-modal-header" color="white">
  {modalTitle || "Choose a Template"}
</ModalHeader>
```

### Dual Preview Layout

When `showComparisonPreview=true`, modify the preview GridItem:

```typescript
<GridItem>
  <Box bg="gray.900" borderRadius="md" p={4} minH={{ base: "200px", lg: "400px" }}>
    {/* Article Selector - shared between both previews */}
    {articles.length > 0 && (
      <FormControl mb={4}>
        <FormLabel fontSize="xs" color="gray.400">Preview article</FormLabel>
        <Select value={selectedArticleId} onChange={(e) => onArticleChange(e.target.value)} ... />
      </FormControl>
    )}

    {/* Dual Preview - Stacked Vertically */}
    <VStack spacing={4} align="stretch">
      {/* Current Format Preview */}
      <Box>
        <Text fontSize="sm" fontWeight="semibold" color="gray.400" mb={2}>
          Current Format
        </Text>
        {isCurrentLoading ? (
          <Skeleton height="200px" borderRadius="md" />
        ) : (
          <DiscordMessageDisplay messages={currentPreviewMessages} maxHeight={200} />
        )}
      </Box>

      {/* Template Preview */}
      <Box>
        <Text fontSize="sm" fontWeight="semibold" color="gray.400" mb={2}>
          Template Preview
        </Text>
        {!selectedTemplateId ? (
          <Box p={8} textAlign="center" bg="gray.800" borderRadius="md" color="gray.500">
            Select a template to compare
          </Box>
        ) : isTemplateLoading ? (
          <Skeleton height="200px" borderRadius="md" />
        ) : (
          <DiscordMessageDisplay messages={templatePreviewMessages} maxHeight={200} />
        )}
      </Box>
    </VStack>
  </Box>
</GridItem>
```

### Current Format Preview Query

Add a second query for the current format preview:

```typescript
import convertMessageBuilderStateToConnectionPreviewInput from "@/pages/MessageBuilder/utils/convertMessageBuilderStateToConnectionPreviewInput";

const useCurrentFormatPreview = ({
  currentMessageComponent,
  articleId,
  feedId,
  connectionId,
  userFeed,
  connection,
  enabled,
}: {
  currentMessageComponent?: MessageComponentRoot;
  articleId?: string;
  feedId: string;
  connectionId?: string;
  userFeed?: UserFeed;
  connection?: FeedDiscordChannelConnection;
  enabled: boolean;
}) => {
  return useQuery({
    queryKey: ["current-format-preview", articleId, feedId, connectionId],
    queryFn: async () => {
      if (!currentMessageComponent || !articleId || !connectionId || !userFeed || !connection) {
        return null;
      }

      const previewInputData = convertMessageBuilderStateToConnectionPreviewInput(
        userFeed,
        connection,
        currentMessageComponent
      );

      const input: CreateDiscordChannelConnectionPreviewInput = {
        feedId,
        connectionId,
        data: {
          article: { id: articleId },
          ...previewInputData,
        },
      };

      return createDiscordChannelConnectionPreview(input);
    },
    enabled: enabled && !!currentMessageComponent && !!articleId && !!connectionId,
    staleTime: 30000,
  });
};
```

### Modal Integration in MessageBuilder

```typescript
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
  onPrimaryAction={handleApplyTemplate}  // Story 3.2 implementation
  secondaryActionLabel="Cancel"
  onSecondaryAction={onCloseTemplates}
/>
```

### Files to Modify

```
services/backend-api/client/src/
├── pages/
│   └── MessageBuilder.tsx  # Add Templates button + modal integration
├── features/
│   └── templates/components/
│       └── TemplateGalleryModal/
│           └── index.tsx  # Add modalTitle, showComparisonPreview, currentMessageComponent props
```

### Key Utilities Reference

- `convertMessageBuilderStateToConnectionPreviewInput` - Converts form state to preview API input (existing in `src/pages/MessageBuilder/utils/`)
- `convertTemplateToUpdateDetails` - Converts template to update API format (exported from `useConnectionTemplateSelection.tsx`, needed for Story 3.2)
- `isTemplateCompatible` - Already exported from `TemplateGalleryModal` for filtering

### Git Intelligence

```
00d39cf4e Implement 1-5   (Story 1.5 accessibility)
cffa7e2d2 Implement 1-3, 1-4  (TemplateCard, TemplateGalleryModal)
a5aa1087a Implement task 1-2   (DiscordMessageDisplay)
a62779f13 Add templates        (Template types and constants)
```

### Accessibility

1. **Focus Management:**
   - Use `finalFocusRef={templatesButtonRef}` on Modal
   - Chakra handles focus trap automatically

2. **Keyboard Navigation:**
   - Templates button focusable via Tab
   - ESC closes modal
   - Modal follows Epic 1 accessibility patterns

3. **Screen Reader:**
   - Button has clear "Templates" label
   - Modal has `aria-labelledby` pointing to header
   - Preview sections have descriptive labels

### Testing Strategy

**Unit Tests:**
- Templates button renders and opens modal
- Modal receives correct props
- Dual preview renders both sections
- Placeholder shows when no template selected

**Integration Tests:**
- Full flow: Click Templates → Browse → Close → Form unchanged
- Article selector updates both previews
- Template filtering works correctly

### References

- [Epics: Story 3.1] `_bmad-output/planning-artifacts/epics.md:560-608`
- [PRD: FR11] Access gallery from message builder
- [UX: Journey 2] Existing User Template Access - `docs/ux-design-specification.md:562-609`
- [Project Context] `docs/project-context.md`
- [TemplateGalleryModal] `src/features/templates/components/TemplateGalleryModal/index.tsx`
- [MessageBuilder] `src/pages/MessageBuilder.tsx`
- [useConnectionTemplateSelection] `src/features/feedConnections/hooks/useConnectionTemplateSelection.tsx`
- [convertMessageBuilderStateToConnectionPreviewInput] `src/pages/MessageBuilder/utils/convertMessageBuilderStateToConnectionPreviewInput.ts`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

N/A

### Completion Notes List

- Implemented Templates button in Message Builder top bar
- Added article fetching for template gallery
- Integrated TemplateGalleryModal with dual preview mode
- Added modalTitle customization
- Implemented Current Format and Template Preview sections
- Article selector updates both previews simultaneously

### File List

- `services/backend-api/client/src/pages/MessageBuilder.tsx` - Added Templates button, useDisclosure for modal, article fetching, TemplateGalleryModal integration
- `services/backend-api/client/src/features/templates/components/TemplateGalleryModal/index.tsx` - Added modalTitle, showComparisonPreview, currentMessageComponent props; implemented dual preview mode with Current Format and Template Preview sections
- `services/backend-api/client/src/features/templates/components/TemplateGalleryModal/TemplateGalleryModal.test.tsx` - Added tests for dual preview mode, modal title customization, placeholder states
