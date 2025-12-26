# Story 1.4: Template Gallery Modal

Status: done

## Dependencies

- Story 1.1: Template Types and Constants (provides Template interface and TEMPLATES array)
- Story 1.2: Shared Discord Message Display Component (for preview rendering in preview panel)
- Story 1.3: Template Card Component (provides TemplateCard with radio button integration)

## Story

As a user,
I want a modal that displays all available templates in a grid with a live preview panel,
So that I can browse templates visually and see exactly how my messages will look.

## Acceptance Criteria

1. **Given** the `TemplateGalleryModal` component at `src/features/templates/components/TemplateGalleryModal/index.tsx`
   **When** it is opened
   **Then** it displays a modal with title "Choose a Template", a close button, template grid, and preview panel

2. **Given** the gallery modal is open on desktop (1024px+)
   **When** I view the layout
   **Then** the template grid appears on the left and the preview panel on the right (side-by-side)

3. **Given** the gallery modal is open on mobile (<768px)
   **When** I view the layout
   **Then** the modal is full-screen with the preview panel stacked below the template grid

4. **Given** the gallery modal is open
   **When** I view the template grid
   **Then** it displays templates in a responsive grid (3 columns desktop, 2 tablet, 1 mobile)

5. **Given** the gallery modal with feed articles available
   **When** I click on a template card
   **Then** the template becomes selected and the preview panel updates to show how that template renders with the current article

6. **Given** the gallery modal
   **When** I want to preview with a different article
   **Then** I can access an article selector (reusing existing component) to change the preview sample data

7. **Given** the preview is loading after template/article selection change
   **When** I view the preview panel
   **Then** a Skeleton loading state is displayed until the preview loads

8. **Given** the gallery modal
   **When** I click the X button, press ESC, or click outside the modal
   **Then** the modal closes without applying changes

## Tasks / Subtasks

- [x] **Task 1: Create TemplateGalleryModal component structure** (AC: #1)
  - [x] Create directory: `services/backend-api/client/src/features/templates/components/TemplateGalleryModal/`
  - [x] Create `index.tsx` file
  - [x] Define `TemplateGalleryModalProps` interface with required props
  - [x] Update `components/index.ts` barrel export to include TemplateGalleryModal

- [x] **Task 2: Implement modal container using Chakra Modal** (AC: #1, #8)
  - [x] Use Chakra `Modal` component with `isOpen` and `onClose` props
  - [x] Set modal size: `size={{ base: "full", lg: "6xl" }}` (full-screen mobile, 6xl desktop)
  - [x] Add `ModalOverlay` with default dimmed background
  - [x] Configure `closeOnOverlayClick={true}` and `closeOnEsc={true}`
  - [x] Implement `isCentered={true}` for desktop positioning

- [x] **Task 3: Implement ModalHeader** (AC: #1)
  - [x] Add `ModalHeader` with text "Choose a Template"
  - [x] Add `ModalCloseButton` in top-right corner
  - [x] Use consistent typography with existing MonitoRSS modals

- [x] **Task 4: Implement responsive layout for ModalBody** (AC: #2, #3)
  - [x] Use Chakra `Grid` or `Flex` with responsive direction
  - [x] Desktop (lg+): `gridTemplateColumns="1fr 400px"` (gallery left, preview right)
  - [x] Tablet/Mobile (<lg): `gridTemplateColumns="1fr"` (stacked vertically)
  - [x] Set `gap={6}` between grid and preview sections
  - [x] Enable scrolling within ModalBody for long content

- [x] **Task 5: Implement template selection grid using RadioGroup** (AC: #4, #5)
  - [x] Use Chakra `useRadioGroup` hook for selection state management
  - [x] Wrap grid in `<fieldset>` with visually hidden `<legend>Choose a template</legend>`
  - [x] Use `SimpleGrid` with responsive columns: `columns={{ base: 1, md: 2, lg: 3 }}`
  - [x] Map over templates array and render `TemplateCard` for each
  - [x] Pass `getRadioProps({ value: template.id, isDisabled })` to each TemplateCard
  - [x] Implement `onChange` handler to update selected template state

- [x] **Task 6: Implement feed capability filtering** (AC: #5)
  - [x] Accept `feedFields: string[]` prop for available article fields
  - [x] Create `isTemplateCompatible(template: Template, feedFields: string[]): boolean` utility
  - [x] Mark templates as disabled if `template.requiredFields` not satisfied by feedFields
  - [x] Pass `isDisabled` to TemplateCard via `getRadioProps`

- [x] **Task 7: Implement preview panel** (AC: #5, #7)
  - [x] Create preview panel Box with `minHeight={{ base: "200px", lg: "auto" }}`
  - [x] Use `DiscordMessageDisplay` component (from Story 1.2) for rendering
  - [x] Pass preview data from API response to DiscordMessageDisplay
  - [x] Show Skeleton loading state while preview is fetching
  - [x] Display placeholder message when no template selected: "Select a template to preview"

- [x] **Task 8: Implement preview API integration** (AC: #5, #7)
  - [x] Use existing preview API endpoint for generating template preview
  - [x] Create preview hook or use existing `useConnectionPreview` pattern
  - [x] Trigger preview fetch when template or article selection changes
  - [x] Handle loading, success, and error states
  - [x] Convert template.messageComponent to preview API payload using `convertMessageBuilderStateToConnectionPreviewInput`

- [x] **Task 9: Implement article selector integration** (AC: #6)
  - [x] Accept `articles` prop with available articles for preview
  - [x] Accept `selectedArticleId` and `onArticleChange` props for controlled selection
  - [x] Add article selector UI above or near preview panel
  - [x] Reuse existing article selector component or pattern from MessageBuilder
  - [x] Update preview when article selection changes

- [x] **Task 10: Implement ModalFooter with action buttons** (AC: #8)
  - [x] Add `ModalFooter` with button layout
  - [x] Follow button hierarchy: Tertiary left, Secondary center-right, Primary right
  - [x] Add placeholder buttons (actual actions will be context-dependent in Stories 2.1/3.1)
  - [x] Example layout: `[Customize manually]  [Cancel]  [Primary Action]`
  - [x] Style "Customize manually" as link/ghost variant
  - [x] Style "Cancel" as outline/secondary variant

- [x] **Task 11: Add focus management and accessibility** (AC: #8)
  - [x] Chakra Modal handles focus trap automatically
  - [x] Chakra Modal handles focus return on close automatically
  - [x] Add `aria-labelledby` pointing to modal header
  - [x] Ensure template grid fieldset is properly announced
  - [x] Add `aria-busy="true"` to preview panel during loading
  - [x] Add `aria-live="polite"` region for preview updates

- [x] **Task 12: Export and integrate** (AC: #1)
  - [x] Export TemplateGalleryModal from `components/index.ts`
  - [x] Export from feature barrel file `src/features/templates/index.ts`
  - [x] Export utility functions (isTemplateCompatible) from appropriate location
  - [x] Verify TypeScript compiles without errors

## Dev Notes

### Critical Architecture Constraints

**MUST FOLLOW - These are non-negotiable:**

1. **Component Location**: `services/backend-api/client/src/features/templates/components/TemplateGalleryModal/index.tsx`
2. **Chakra UI Only**: Use only Chakra UI components - no custom CSS files
3. **Barrel Exports**: Export via `components/index.ts` -> `features/templates/index.ts`
4. **Dark Theme**: Use Discord/MonitoRSS dark theme colors
5. **Reuse Existing Components**: Use TemplateCard (Story 1.3), DiscordMessageDisplay (Story 1.2)
6. **Reuse Existing Patterns**: Follow existing modal patterns in MonitoRSS codebase
7. **Radio Button Group Pattern**: Use native radio semantics per UX spec for accessibility

### Props Interface Design

```typescript
import { Template } from "../../types";

interface TemplateGalleryModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Available templates to display */
  templates: Template[];
  /** Currently selected template ID (controlled) */
  selectedTemplateId?: string;
  /** Callback when template selection changes */
  onTemplateSelect: (templateId: string) => void;
  /** Available fields from the feed (for compatibility filtering) */
  feedFields: string[];
  /** Available articles for preview selection */
  articles: Array<{ id: string; title: string; [key: string]: unknown }>;
  /** Currently selected article ID for preview */
  selectedArticleId?: string;
  /** Callback when article selection changes */
  onArticleChange: (articleId: string) => void;
  /** Connection ID for preview API (if applicable) */
  connectionId?: string;
  /** Feed ID for preview API */
  feedId: string;
  /** Primary action button label (context-dependent) */
  primaryActionLabel?: string;
  /** Primary action callback */
  onPrimaryAction?: (selectedTemplateId: string) => void;
  /** Whether primary action is loading */
  isPrimaryActionLoading?: boolean;
  /** Secondary action label (default: "Cancel") */
  secondaryActionLabel?: string;
  /** Secondary action callback (default: onClose) */
  onSecondaryAction?: () => void;
  /** Tertiary action label (e.g., "Customize manually") */
  tertiaryActionLabel?: string;
  /** Tertiary action callback */
  onTertiaryAction?: () => void;
  /** Optional test ID */
  testId?: string;
}
```

### Modal Size and Responsive Behavior

Per UX specification (docs/ux-design-specification.md:498-503):

| Viewport | Modal Size | Grid Columns | Preview Position |
|----------|-----------|--------------|------------------|
| Desktop (1024px+) | XL/6xl | 3 columns | Side-by-side with grid |
| Tablet (768px-1023px) | Large | 2 columns | Side-by-side or stacked |
| Mobile (<768px) | Full-screen | 1 column | Stacked below grid |

```tsx
<Modal
  isOpen={isOpen}
  onClose={onClose}
  size={{ base: "full", md: "xl", lg: "6xl" }}
  isCentered
  scrollBehavior="inside"
>
```

### Layout Structure

Per UX specification (docs/ux-design-specification.md:468-503):

```
+-----------------------------------------------------------+
|  Choose a Template                              [X]       |
+-----------------------------------------------------------+
|                                                           |
|  +----------+  +----------+  +----------+                 |
|  | Template |  | Template |  | Template |   +----------+  |
|  |    1     |  |    2     |  |    3     |   |  Preview |  |
|  |          |  | Selected |  |          |   |          |  |
|  +----------+  +----------+  +----------+   |  Discord |  |
|                                             |   Embed  |  |
|  +----------+  +----------+  +----------+   |          |  |
|  | Template |  | Template |  | Default  |   |          |  |
|  |    4     |  |    5     |  | (safe)   |   +----------+  |
|  +----------+  +----------+  +----------+   [Article v]   |
|                                                           |
+-----------------------------------------------------------+
|  [Customize manually]     [Cancel]  [Primary Action]      |
+-----------------------------------------------------------+
```

### Component Structure

```tsx
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Grid,
  GridItem,
  SimpleGrid,
  Box,
  Button,
  Skeleton,
  Text,
  useRadioGroup,
  VisuallyHidden,
} from "@chakra-ui/react";
import { TemplateCard } from "../TemplateCard";
import { DiscordMessageDisplay } from "@/components/DiscordMessageDisplay";
import { Template } from "../../types";

export const TemplateGalleryModal = (props: TemplateGalleryModalProps) => {
  const {
    isOpen,
    onClose,
    templates,
    selectedTemplateId,
    onTemplateSelect,
    feedFields,
    articles,
    selectedArticleId,
    onArticleChange,
    feedId,
    connectionId,
    primaryActionLabel = "Use this template",
    onPrimaryAction,
    isPrimaryActionLoading,
    secondaryActionLabel = "Cancel",
    onSecondaryAction,
    tertiaryActionLabel,
    onTertiaryAction,
    testId,
  } = props;

  // Radio group for template selection
  const { getRootProps, getRadioProps } = useRadioGroup({
    name: "template-selection",
    value: selectedTemplateId,
    onChange: onTemplateSelect,
  });

  // Template compatibility check
  const isTemplateCompatible = (template: Template) => {
    return template.requiredFields.every((field) => feedFields.includes(field));
  };

  // Preview data hook (use existing pattern or TanStack Query)
  const { data: previewData, isLoading: isPreviewLoading } = useTemplatePreview({
    templateId: selectedTemplateId,
    articleId: selectedArticleId,
    feedId,
    connectionId,
    enabled: !!selectedTemplateId && !!selectedArticleId,
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={{ base: "full", md: "xl", lg: "6xl" }}
      isCentered
      scrollBehavior="inside"
      data-testid={testId}
    >
      <ModalOverlay />
      <ModalContent bg="gray.800" maxH={{ base: "100vh", lg: "90vh" }}>
        <ModalHeader color="white">Choose a Template</ModalHeader>
        <ModalCloseButton color="white" />

        <ModalBody>
          <Grid
            templateColumns={{ base: "1fr", lg: "1fr 400px" }}
            gap={6}
          >
            {/* Template Selection Grid */}
            <GridItem>
              <Box as="fieldset">
                <VisuallyHidden as="legend">Choose a template</VisuallyHidden>
                <SimpleGrid
                  {...getRootProps()}
                  columns={{ base: 1, md: 2, lg: 3 }}
                  spacing={4}
                >
                  {templates.map((template) => {
                    const radio = getRadioProps({
                      value: template.id,
                      isDisabled: !isTemplateCompatible(template),
                    });
                    return (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        disabledReason="Needs articles"
                        {...radio}
                      />
                    );
                  })}
                </SimpleGrid>
              </Box>
            </GridItem>

            {/* Preview Panel */}
            <GridItem>
              <Box
                bg="gray.900"
                borderRadius="md"
                p={4}
                minH={{ base: "200px", lg: "400px" }}
                aria-label="Template preview"
                aria-busy={isPreviewLoading}
              >
                <Text fontSize="sm" color="gray.400" mb={3}>
                  Preview
                </Text>

                {/* Article Selector */}
                <Box mb={4}>
                  {/* Reuse existing ArticleSelector or create simple select */}
                </Box>

                {/* Preview Content */}
                {isPreviewLoading ? (
                  <Skeleton height="300px" />
                ) : previewData ? (
                  <DiscordMessageDisplay data={previewData} />
                ) : (
                  <Text color="gray.500" textAlign="center" py={8}>
                    Select a template to preview
                  </Text>
                )}
              </Box>
            </GridItem>
          </Grid>
        </ModalBody>

        <ModalFooter>
          {/* Button Hierarchy: Tertiary (left) - Secondary - Primary (right) */}
          {tertiaryActionLabel && (
            <Button
              variant="link"
              colorScheme="gray"
              mr="auto"
              onClick={onTertiaryAction}
            >
              {tertiaryActionLabel}
            </Button>
          )}
          <Button
            variant="outline"
            mr={3}
            onClick={onSecondaryAction || onClose}
          >
            {secondaryActionLabel}
          </Button>
          {onPrimaryAction && (
            <Button
              colorScheme="blue"
              isLoading={isPrimaryActionLoading}
              isDisabled={!selectedTemplateId}
              onClick={() => selectedTemplateId && onPrimaryAction(selectedTemplateId)}
            >
              {primaryActionLabel}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
```

### Preview API Integration

The preview should use the existing preview API infrastructure. Key integration points:

1. **Convert template to preview payload**:
   ```typescript
   // Existing utility in codebase
   import { convertMessageBuilderStateToConnectionPreviewInput } from "@/utils/...";

   const previewPayload = convertMessageBuilderStateToConnectionPreviewInput({
     messageComponent: selectedTemplate.messageComponent,
     // ... other required fields
   });
   ```

2. **Use existing preview hook pattern** (reference existing message builder):
   ```typescript
   // Look for existing hook in:
   // src/features/feedConnections/hooks/useConnectionPreview.tsx
   // or similar
   ```

3. **TanStack Query pattern**:
   ```typescript
   import { useQuery } from "@tanstack/react-query";

   const useTemplatePreview = ({
     templateId,
     articleId,
     feedId,
     connectionId,
     enabled,
   }: UseTemplatePreviewParams) => {
     return useQuery({
       queryKey: ["template-preview", templateId, articleId, feedId],
       queryFn: () => fetchPreview({ templateId, articleId, feedId, connectionId }),
       enabled,
       staleTime: 30000, // 30 seconds
     });
   };
   ```

### Article Selector Integration

The modal should reuse the existing article selector component from the MessageBuilder:

```typescript
// Look for existing component in:
// src/pages/MessageBuilder/ArticleSelectionDialog.tsx
// or similar article picker component

// Simplified inline selector (if full dialog not needed):
<Select
  value={selectedArticleId}
  onChange={(e) => onArticleChange(e.target.value)}
  bg="gray.700"
  borderColor="gray.600"
>
  {articles.map((article) => (
    <option key={article.id} value={article.id}>
      {article.title}
    </option>
  ))}
</Select>
```

### Accessibility Implementation

Per UX specification (docs/ux-design-specification.md:863-890):

1. **Radio Button Group Pattern**:
   - `<fieldset>` wrapper with `<legend class="visually-hidden">Choose a template</legend>`
   - Native radio inputs are visually hidden
   - TemplateCard components are styled labels
   - Arrow key navigation works automatically

2. **Focus Management** (Chakra handles this):
   - Focus trapped within modal when open
   - Focus returns to trigger element on close
   - First focusable element receives focus on open

3. **Screen Reader Announcements**:
   - `aria-busy="true"` on preview panel during loading
   - `aria-live="polite"` region for preview updates (optional enhancement)
   - Native radio announces "Template Name, radio button, X of Y, checked/not checked"

4. **Focus Indicators**:
   - Chakra Modal provides visible focus ring
   - TemplateCard has `_focus={{ boxShadow: "outline" }}`

### Empty Feed Handling

When `feedFields` is empty or indicates no articles available:

1. All templates except default are disabled (`isDisabled: true`)
2. Each disabled card shows "Needs articles" badge (via TemplateCard)
3. Add info banner at top of modal:
   ```tsx
   {feedFields.length === 0 && (
     <Alert status="info" mb={4}>
       <AlertIcon />
       Some templates are unavailable until your feed has articles
     </Alert>
   )}
   ```
4. Default template (with empty `requiredFields`) remains selectable
5. Preview shows placeholder for default template

### State Management

The modal is designed as a **controlled component**:

| State | Managed By | Prop |
|-------|------------|------|
| Open/Close | Parent | `isOpen`, `onClose` |
| Selected Template | Parent | `selectedTemplateId`, `onTemplateSelect` |
| Selected Article | Parent | `selectedArticleId`, `onArticleChange` |
| Preview Data | Internal (TanStack Query) | N/A |
| Loading State | Internal (TanStack Query) | N/A |

Parent component manages selection state to enable context-specific behavior (connection flow vs message builder).

### File Structure to Create

```
services/backend-api/client/src/features/templates/
├── index.ts                           # Update to export new components
├── components/
│   ├── index.ts                       # Update to export TemplateGalleryModal
│   ├── TemplateCard/
│   │   └── index.tsx                  # Existing from Story 1.3
│   └── TemplateGalleryModal/
│       └── index.tsx                  # NEW - main component file
├── hooks/
│   ├── index.ts                       # Update to export useTemplatePreview
│   └── useTemplatePreview.tsx         # NEW - preview data fetching hook
├── utils/
│   ├── index.ts                       # NEW - utility exports
│   └── isTemplateCompatible.ts        # NEW - template compatibility check
├── types/
│   └── ...                            # Existing from Story 1.1
└── constants/
    └── ...                            # Existing from Story 1.1
```

### Dependencies to Import

```typescript
// Chakra UI
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Grid,
  GridItem,
  SimpleGrid,
  Box,
  Button,
  Skeleton,
  Text,
  Select,
  Alert,
  AlertIcon,
  VisuallyHidden,
  useRadioGroup,
} from "@chakra-ui/react";

// TanStack Query
import { useQuery } from "@tanstack/react-query";

// Internal components
import { TemplateCard } from "../TemplateCard";
import { DiscordMessageDisplay } from "@/components/DiscordMessageDisplay";

// Internal types
import { Template } from "../../types";
```

### Integration with Future Stories

This modal is designed to be reused in:

1. **Story 2.1: Template Selection Step in Connection Flow**
   - Opens during AddConnectionDialog flow
   - `primaryActionLabel`: "Send Test & Save" or "Save"
   - `tertiaryActionLabel`: "Customize manually"
   - `onPrimaryAction`: Apply template and close connection flow

2. **Story 3.1: Templates Button in Message Builder**
   - Opens from Message Builder page
   - `primaryActionLabel`: "Use this template"
   - `secondaryActionLabel`: "Cancel"
   - `onPrimaryAction`: Apply template to form fields

### Existing Patterns to Reference

Look at these existing components for patterns:

1. **Modal Patterns**:
   - `src/features/feedConnections/components/AddConnectionDialog/` - Multi-step modal flow
   - Search for `Modal` usage in existing code

2. **Preview Patterns**:
   - `src/pages/MessageBuilder/DiscordMessagePreview.tsx` - Preview rendering
   - Look for preview API hook usage

3. **Grid Layouts**:
   - `SimpleGrid` usage throughout the app
   - Responsive column patterns

4. **Radio Group**:
   - `src/components/RadioCardGroup/index.tsx` - Existing radio card pattern

### Testing Checklist

Manual testing scenarios:

1. **Modal Open/Close**: Opens with correct content, closes via X, ESC, overlay click
2. **Template Selection**: Clicking enabled template selects it, updates preview
3. **Disabled Templates**: Clicking disabled template does nothing, shows badge
4. **Preview Loading**: Shows skeleton while loading, then shows preview
5. **Article Selection**: Changing article updates preview
6. **Responsive Layout**: Desktop shows side-by-side, mobile shows stacked
7. **Keyboard Navigation**: Tab navigates to all interactive elements, arrows within grid
8. **Screen Reader**: Announces "Choose a template", announces selection changes
9. **Focus Management**: Focus trapped in modal, returns on close
10. **Button Actions**: Primary/Secondary/Tertiary buttons work as expected

### Performance Considerations

1. **Preview Caching**: Use TanStack Query's staleTime to avoid refetching same preview
2. **Lazy Loading**: Preview images in DiscordMessageDisplay should lazy load
3. **Template List**: Should be small (4-6 templates MVP), no virtualization needed
4. **Debounce**: Consider debouncing rapid template selection changes for preview API

### Project Structure Notes

- Follows existing feature module pattern from `src/features/feedConnections/`
- All TypeScript with strict mode enabled
- Uses Chakra UI's built-in responsive props for mobile adaptation
- Reuses existing preview API infrastructure

### Previous Story Intelligence

From Story 1.3 (Template Card Component):
- TemplateCard uses `useRadio` hook and accepts `UseRadioProps`
- TemplateCard expects to be wrapped in a parent using `useRadioGroup`
- Selected state handled via `_checked` pseudo-prop
- Disabled state handled via `isDisabled` prop from RadioGroup
- Focus ring via `_focus={{ boxShadow: "outline" }}`

From Story 1.2 (Discord Message Display):
- DiscordMessageDisplay is a stateless presenter component
- Accepts preview data as props (no internal data fetching)
- Handles both V1 (Legacy embeds) and V2 (component-based) formats
- Should be located at `src/components/DiscordMessageDisplay/index.tsx`

From Story 1.1 (Template Types and Constants):
- Template interface includes: id, name, description, thumbnail, requiredFields, messageComponent
- Templates stored in `src/features/templates/constants/templates.ts`
- Default template has empty `requiredFields` array (works with any feed)

### Git Intelligence

Recent commits show:
- UI styling work (code block, list, quote, anchor styling)
- Bug fixes (delivery records, timezone handling)
- Image fixes
- These don't directly impact template gallery, but suggest active UI development

### References

- [Architecture: Feature Module Structure] docs/architecture.md:248-271
- [Architecture: TemplateGalleryModal Component] docs/architecture.md:355-370
- [Architecture: Preview Component Architecture] docs/architecture.md:276-301
- [UX: Modal Gallery Layout] docs/ux-design-specification.md:449-503
- [UX: Responsive Strategy] docs/ux-design-specification.md:822-857
- [UX: Accessibility Strategy] docs/ux-design-specification.md:862-909
- [UX: Button Hierarchy] docs/ux-design-specification.md:747-758
- [UX: Feedback Patterns] docs/ux-design-specification.md:760-769
- [Epics: Story 1.4] docs/epics.md:288-328
- [PRD: FR1] docs/prd.md - Gallery as visual grid
- [PRD: FR2] docs/prd.md - Preview with feed content
- [PRD: FR3] docs/prd.md - Article selection for preview
- [PRD: FR6] docs/prd.md - Loading indicator for preview
- [PRD: NFR1] docs/prd.md - Gallery loads without blocking
- [PRD: NFR2] docs/prd.md - Single preview rendering

## Verification Checklist

Before marking this story complete, verify:

- [x] TypeScript compiles without errors (`npm run type-check`)
- [x] TemplateGalleryModal is exported from `src/features/templates/index.ts`
- [x] Modal opens and closes correctly via all methods (X, ESC, overlay, props)
- [x] Template grid displays using TemplateCard components
- [x] Template selection updates via RadioGroup (arrow keys work)
- [x] Preview panel shows DiscordMessageDisplay with fetched data
- [x] Preview shows Skeleton while loading
- [x] Preview updates when template or article selection changes
- [x] Disabled templates show "Needs articles" badge and are not selectable
- [x] Responsive layout works: side-by-side on desktop, stacked on mobile
- [x] Focus is trapped within modal
- [x] Screen reader announces modal title and radio group
- [x] Button hierarchy follows pattern: tertiary left, secondary center, primary right
- [x] Article selector is functional and updates preview
- [x] Empty feed state shows info banner and disables non-default templates

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Implemented TemplateGalleryModal component with full acceptance criteria coverage
- Component uses Chakra UI Modal, Grid, SimpleGrid, and useRadioGroup for accessible template selection
- Preview panel integrates with existing preview API via useQuery and convertMessageBuilderStateToConnectionPreviewInput
- Responsive layout: side-by-side on desktop (lg+), stacked on mobile/tablet
- 45 tests passing covering rendering, modal behavior, template selection, feed filtering, article selection, action buttons, accessibility, preview states, and error handling
- TypeScript compiles without errors
- Exported from features/templates/index.ts and components/index.ts
- Code review (2025-12-26): Added error state UI for preview API failures, added ESC key and overlay click tests, fixed act() warning in accessibility test

### File List

- `services/backend-api/client/src/features/templates/components/TemplateGalleryModal/index.tsx` - Main component with preview error handling
- `services/backend-api/client/src/features/templates/components/TemplateGalleryModal/TemplateGalleryModal.test.tsx` - Tests (45 tests)
- `services/backend-api/client/src/features/templates/components/index.ts` - Updated barrel export
- `services/backend-api/client/src/features/templates/index.ts` - Feature barrel export
