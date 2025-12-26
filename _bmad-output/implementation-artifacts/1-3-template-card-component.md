# Story 1.3: Template Card Component

Status: done

## Dependencies

- Story 1.1: Template Types and Constants (provides Template interface and TEMPLATES array)
- Story 1.2: Shared Discord Message Display Component (for potential thumbnail preview rendering)

## Story

As a user,
I want to see each template as a visually distinct card with clear selection states,
So that I can easily browse templates and understand which one is selected.

## Acceptance Criteria

1. **Given** a `TemplateCard` component at `src/features/templates/components/TemplateCard/index.tsx`
   **When** it receives a template object as props
   **Then** it displays the template name and a visual thumbnail/preview representation

2. **Given** a template card in its default state
   **When** I view it
   **Then** it has a subtle border and pointer cursor indicating it's interactive

3. **Given** a template card
   **When** I hover over it with my mouse
   **Then** it shows a highlighted border and slight elevation/shadow

4. **Given** a template card that is currently selected
   **When** I view it
   **Then** it displays a primary color border and a checkmark indicator showing selection

5. **Given** a template card that is disabled (for empty feeds)
   **When** I view it
   **Then** it appears greyed out with a "Needs articles" badge and shows a not-allowed cursor

6. **Given** a disabled template card
   **When** I click on it
   **Then** nothing happens (click is ignored)

7. **Given** any template card
   **When** rendered on a mobile device
   **Then** it maintains a minimum touch target size of 44x44px

## Tasks / Subtasks

- [x] **Task 1: Create TemplateCard component structure** (AC: #1)
  - [x] Create directory: `services/backend-api/client/src/features/templates/components/TemplateCard/`
  - [x] Create `index.tsx` file
  - [x] Define `TemplateCardProps` interface with required props
  - [x] Update `components/index.ts` barrel export to include TemplateCard

- [x] **Task 2: Implement base card visual structure** (AC: #1, #7)
  - [x] Use Chakra UI `Box as="label"` as the card container (styled label for radio input)
  - [x] Include visually hidden radio input using Chakra's `useRadio` hook or `VisuallyHidden`
  - [x] Display template name using `Text` with `fontWeight="medium"`
  - [x] Display template description using `Text` with smaller font size
  - [x] Create visual thumbnail area (Box with fixed aspect ratio)
  - [x] Ensure minimum dimensions of 44x44px for touch targets

- [x] **Task 3: Implement default state styling** (AC: #2)
  - [x] Apply subtle border: `borderWidth="1px"`, `borderColor="gray.600"`
  - [x] Set `borderRadius="md"` for rounded corners
  - [x] Add `cursor="pointer"` for interactivity hint
  - [x] Use dark theme background: `bg="gray.800"`

- [x] **Task 4: Implement hover state** (AC: #3)
  - [x] Add `_hover` pseudo-prop with highlighted border color: `borderColor="blue.400"`
  - [x] Add slight elevation on hover: `boxShadow="md"`
  - [x] Add subtle background change: `bg="gray.700"`
  - [x] Ensure smooth transition with `transition="all 0.2s"`

- [x] **Task 5: Implement selected state** (AC: #4)
  - [x] Add `isSelected` prop to component interface
  - [x] Apply primary color border when selected: `borderColor="blue.500"`, `borderWidth="2px"`
  - [x] Display checkmark indicator using Chakra Icon (CheckCircleIcon)
  - [x] Position checkmark in top-right corner with `position="absolute"`
  - [x] Use blue background tint: `bg="blue.900"`

- [x] **Task 6: Implement disabled state** (AC: #5, #6)
  - [x] Add `isDisabled` prop to component interface
  - [x] Add optional `disabledReason` prop (default: "Needs articles")
  - [x] Apply greyed-out styling: `opacity={0.5}`
  - [x] Change cursor to `cursor="not-allowed"`
  - [x] Display Badge with disabled reason in top-left corner
  - [x] Use Chakra Badge with `colorScheme="gray"`
  - [x] Prevent click events when disabled (no onClick callback)

- [x] **Task 7: Implement radio input integration** (AC: #6)
  - [x] Use Chakra's `useRadio` hook to get input and checkbox props
  - [x] Include visually hidden `<input {...getInputProps()} />` inside label
  - [x] Use `getCheckboxProps()` spread on the visual Box container
  - [x] Native radio handles click, selection, and keyboard navigation automatically
  - [x] Disabled state handled via `isDisabled` prop passed to useRadio

- [x] **Task 8: Add accessibility attributes** (AC: #4, #5)
  - [x] Native radio input provides built-in accessibility (no custom ARIA needed)
  - [x] Ensure focus ring visible via `_focus={{ boxShadow: "outline" }}`
  - [x] Add descriptive text for screen readers via label content
  - [x] Disabled radios automatically get `aria-disabled` from native input
  - [x] Selected state announced via native radio `checked` attribute

- [x] **Task 9: Export and integrate** (AC: #1)
  - [x] Export TemplateCard from `components/index.ts`
  - [x] Export from feature barrel file `src/features/templates/index.ts`
  - [x] Verify TypeScript compiles without errors

## Dev Notes

### Critical Architecture Constraints

**MUST FOLLOW - These are non-negotiable:**

1. **Component Location**: `services/backend-api/client/src/features/templates/components/TemplateCard/index.tsx`
2. **Import Template Type**: Import `Template` from `../../types` (relative path within feature module)
3. **Chakra UI Only**: Use only Chakra UI components - no custom CSS files
4. **Barrel Exports**: Export via `components/index.ts` → `features/templates/index.ts`
5. **Dark Theme**: Use Discord/MonitoRSS dark theme colors (gray.700, gray.800, blue.500, etc.)

### Props Interface Design

The TemplateCard is designed to work with Chakra's `useRadio` hook, receiving props from `useRadioGroup` in the parent.

```typescript
import { UseRadioProps } from "@chakra-ui/react";
import { Template } from '../../types';

interface TemplateCardProps extends UseRadioProps {
  /** The template data to display */
  template: Template;
  /** Reason for disabled state, displayed as badge (default: "Needs articles") */
  disabledReason?: string;
  /** Optional test ID for testing */
  testId?: string;
}

// Note: isChecked and isDisabled come from UseRadioProps (spread from useRadioGroup)
// The parent RadioGroup controls selection via value/onChange
```

**Why UseRadioProps?**
- `isChecked` - Comes from RadioGroup state (replaces manual `isSelected`)
- `isDisabled` - Passed from parent based on feed compatibility
- Native radio input handles keyboard navigation (arrow keys between options)
- Native radio input announces selection state to screen readers
- No custom ARIA attributes needed - browser handles accessibility

### Visual State Reference Table

| State | Border | Background | Cursor | Additional |
|-------|--------|------------|--------|------------|
| **Default** | 1px gray.600 | gray.800 | pointer | - |
| **Hover** | 1px blue.400 | gray.700 | pointer | boxShadow: md |
| **Selected** | 2px blue.500 | blue.900 | pointer | CheckCircle icon |
| **Disabled** | 1px gray.600 | gray.800 | not-allowed | opacity: 0.5, Badge |
| **Focus** | - | - | - | boxShadow: outline |

### Component Structure

Uses Chakra's `useRadio` hook for proper radio button semantics with styled card visuals:

```tsx
import { useRadio, UseRadioProps } from "@chakra-ui/react";

export const TemplateCard = (props: TemplateCardProps) => {
  const { template, disabledReason, testId, ...radioProps } = props;
  const { getInputProps, getCheckboxProps, state } = useRadio(radioProps);

  const input = getInputProps();
  const checkbox = getCheckboxProps();

  // Destructure state for cleaner conditionals
  const { isChecked, isDisabled } = state;

  return (
    <Box as="label" data-testid={testId}>
      {/* Visually hidden native radio input - provides all accessibility */}
      <input {...input} />

      {/* Visual card representation */}
      <Box
        {...checkbox}
        position="relative"
        borderWidth={isChecked ? "2px" : "1px"}
        borderColor={isChecked ? "blue.500" : "gray.600"}
        borderRadius="md"
        bg={isChecked ? "blue.900" : "gray.800"}
        p={4}
        cursor={isDisabled ? "not-allowed" : "pointer"}
        opacity={isDisabled ? 0.5 : 1}
        transition="all 0.2s"
        minH="120px"
        minW="44px"  // Touch target minimum
        _hover={!isDisabled && !isChecked ? {
          borderColor: "blue.400",
          bg: "gray.700",
          boxShadow: "md"
        } : undefined}
        _focus={{
          boxShadow: "outline"
        }}
        _checked={{
          borderColor: "blue.500",
          borderWidth: "2px",
          bg: "blue.900"
        }}
        _disabled={{
          opacity: 0.5,
          cursor: "not-allowed"
        }}
      >
        {/* Disabled Badge - Top Left */}
        {isDisabled && (
          <Badge
            position="absolute"
            top={2}
            left={2}
            colorScheme="gray"
            fontSize="xs"
          >
            {disabledReason || "Needs articles"}
          </Badge>
        )}

        {/* Selected Indicator - Top Right */}
        {isChecked && (
          <Icon
            as={CheckCircleIcon}
            position="absolute"
            top={2}
            right={2}
            color="blue.400"
            boxSize={5}
            aria-hidden="true"
          />
        )}

        {/* Thumbnail Preview Area */}
        <Box
          bg="gray.900"
          borderRadius="sm"
          h="60px"
          mb={3}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          {template.thumbnail ? (
            <Image src={template.thumbnail} alt="" maxH="100%" />
          ) : (
            <Icon as={ViewIcon} color="gray.500" boxSize={6} aria-hidden="true" />
          )}
        </Box>

        {/* Template Info */}
        <VStack align="start" spacing={1}>
          <Text fontWeight="medium" fontSize="sm" color="white" noOfLines={1}>
            {template.name}
          </Text>
          <Text fontSize="xs" color="gray.400" noOfLines={2}>
            {template.description}
          </Text>
        </VStack>
      </Box>
    </Box>
  );
};
```

**Key Points:**
- `Box as="label"` wraps the hidden input and visual card
- Hidden `<input {...input} />` provides native radio semantics
- `{...checkbox}` spread on visual Box connects it to radio state
- `_checked` pseudo-prop handles selected styling (Chakra convention)
- `_disabled` pseudo-prop handles disabled styling
- No manual `onClick` needed - native radio handles selection
- Arrow key navigation works automatically within RadioGroup parent

### Color Palette Reference

Based on existing MonitoRSS patterns:

| Use Case | Light Value | Dark Value |
|----------|-------------|------------|
| Card Background | gray.800 | gray.800 |
| Card Background (Hover) | gray.700 | gray.700 |
| Card Background (Selected) | blue.900 | blue.900 |
| Border (Default) | gray.600 | gray.600 |
| Border (Hover) | blue.400 | blue.400 |
| Border (Selected) | blue.500 | blue.500 |
| Text Primary | white | white |
| Text Secondary | gray.400 | gray.400 |
| Checkmark | blue.400 | blue.400 |
| Badge Background | gray.700 | gray.700 |

### Accessibility Requirements (WCAG 2.1 AA)

Per UX spec and web research:

1. **Color Contrast**: 4.5:1 minimum for text, 3:1 for UI components
2. **Touch Target**: Minimum 44x44px (UX spec) or 24x24px (WCAG AA minimum)
3. **Focus Indicator**: Visible focus ring (boxShadow: outline)
4. **State Communication**: Don't rely solely on color - use icons (checkmark) and badges
5. **ARIA Attributes**:
   - `aria-selected` for selection state
   - `aria-disabled` for disabled state
   - `aria-label` for full context in screen readers

### Existing Pattern Reference

The codebase has a `RadioCardGroup` component at `src/components/RadioCardGroup/index.tsx` that uses `useRadio` and `useRadioGroup` hooks. The TemplateCard will be designed to work with this pattern when integrated into the gallery modal (Story 1.4).

Key patterns from RadioCardGroup:
- Uses `Box as="label"` with hidden input
- `_checked` pseudo-prop for selected state
- `_focus` pseudo-prop for focus ring
- `cursor="pointer"` for interactivity

### Integration with Radio Button Group (Story 1.4)

When used in the Template Gallery Modal, TemplateCard works with `useRadioGroup`:

```tsx
// Future usage in TemplateGalleryModal (Story 1.4)
import { useRadioGroup, SimpleGrid } from "@chakra-ui/react";
import { TemplateCard } from "@/features/templates";

const TemplateGallery = ({ templates, feedFields, onSelect }) => {
  const { getRootProps, getRadioProps } = useRadioGroup({
    name: "template",
    defaultValue: "default",
    onChange: onSelect,
  });

  const group = getRootProps();

  return (
    <fieldset>
      <legend className="visually-hidden">Choose a template</legend>
      <SimpleGrid {...group} columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
        {templates.map((template) => {
          const radio = getRadioProps({
            value: template.id,
            isDisabled: !isTemplateCompatible(template, feedFields),
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
    </fieldset>
  );
};
```

**Key Integration Points:**
- `useRadioGroup` manages selection state centrally
- `getRadioProps({ value, isDisabled })` generates props for each card
- Spread `{...radio}` passes `isChecked`, `isDisabled`, `onChange`, etc.
- `<fieldset>` + `<legend>` provides accessible grouping per UX spec
- Arrow keys navigate between cards automatically (native radio behavior)

### File Structure to Create

```
services/backend-api/client/src/features/templates/
├── index.ts                           # Update to export components
├── components/
│   ├── index.ts                       # Update to export TemplateCard
│   └── TemplateCard/
│       └── index.tsx                  # NEW - main component file
├── types/
│   └── ...                            # Existing from Story 1.1
├── constants/
│   └── ...                            # Existing from Story 1.1
└── hooks/
    └── index.ts                       # Existing placeholder
```

### Dependencies to Import

```typescript
// Chakra UI
import {
  Box,
  VStack,
  Text,
  Badge,
  Icon,
  Image,
  useRadio,
  UseRadioProps,
} from "@chakra-ui/react";
import { CheckCircleIcon, ViewIcon } from "@chakra-ui/icons";

// Internal types
import { Template } from "../../types";
```

**Note:** `useColorModeValue` is NOT needed - Discord preview is always dark theme. Use hardcoded dark theme colors.

### Testing Checklist

Manual testing scenarios (test within a RadioGroup parent):

1. **Default State**: Card displays with subtle border, pointer cursor
2. **Hover State**: Border highlights blue, background lightens, shadow appears
3. **Selected State**: Blue border (2px), blue tint background, checkmark visible
4. **Disabled State**: Greyed out (opacity 0.5), badge visible, cursor not-allowed
5. **Click Behavior**: Clicking enabled card selects it (radio behavior)
6. **Keyboard Navigation**: Arrow keys move between cards, Space/Enter selects
7. **Screen Reader**: Announces "Template Name, radio button, X of Y, checked/not checked"
8. **Mobile**: Touch target is at least 44x44px, tap selects card
9. **Focus Ring**: Visible focus indicator when navigating with keyboard

### Potential Gotchas

1. **Pseudo-props with conditions**: `_hover` should not apply when disabled
   ```tsx
   _hover={!isDisabled && !isSelected ? { ... } : undefined}
   ```

2. **Border width transition**: Selected state uses 2px border which can cause layout shift
   - Solution: Use consistent padding to compensate or use `outline` instead

3. **Image loading**: Template thumbnails may fail to load
   - Solution: Always have fallback icon

4. **Text overflow**: Template names/descriptions may be too long
   - Solution: Use `noOfLines` prop for text truncation

5. **Click event bubbling**: Nested interactive elements could cause issues
   - Solution: This design has no nested interactives

### Performance Considerations

- Use `React.memo` to prevent unnecessary re-renders when parent state changes
- Thumbnail images should be small (< 50KB)
- Avoid inline function definitions in props when possible

```typescript
// Good - stable reference
const handleClick = useCallback(() => {
  if (!isDisabled && onClick) {
    onClick(template.id);
  }
}, [isDisabled, onClick, template.id]);

// Export with memo
export const TemplateCard = React.memo(TemplateCardComponent);
```

### Project Structure Notes

- Follows existing feature module pattern from `src/features/feedConnections/`
- All TypeScript with strict mode enabled
- Uses Chakra UI's built-in responsive props for mobile adaptation

### References

- [Architecture: Feature Module Structure] docs/architecture.md:248-271
- [Architecture: TemplateCard Component] docs/architecture.md:355-370
- [UX: TemplateCard States] docs/ux-design-specification.md:700-711
- [UX: Touch Targets] docs/ux-design-specification.md:423-424
- [UX: Accessibility] docs/ux-design-specification.md:863-890
- [Epics: Story 1.3] docs/epics.md:252-287
- [PRD: FR5] docs/prd.md:264 - "Users can see which template is currently selected"
- [PRD: FR20] docs/prd.md:291 - "Users with empty feeds see other templates greyed out"
- [Existing RadioCardGroup] services/backend-api/client/src/components/RadioCardGroup/index.tsx
- [Chakra UI Radio Card](https://chakra-ui.com/docs/components/radio-card)
- [WCAG 2.1 AA Radio Button Checklist](https://www.atomica11y.com/accessible-design/radio/)

## Verification Checklist

Before marking this story complete, verify:

- [x] TypeScript compiles without errors (`npx tsc --noEmit`)
- [x] TemplateCard is exported from `src/features/templates/index.ts`
- [x] Component extends `UseRadioProps` and works with `useRadioGroup`
- [x] All four visual states work (default, hover, checked, disabled)
- [x] Native radio input is visually hidden but accessible
- [x] Arrow keys navigate between cards in a RadioGroup
- [x] Focus ring visible on keyboard navigation
- [x] Screen reader announces radio button semantics (not just button)
- [x] Touch target is at least 44x44px on mobile
- [x] Badge displays "Needs articles" (or custom text) when disabled
- [x] Checkmark icon displays when checked
- [x] Text truncates properly for long template names/descriptions

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

- Created TemplateCard component at `services/backend-api/client/src/features/templates/components/TemplateCard/index.tsx`
- Component implements all visual states: default, hover, selected (checked), and disabled
- Uses Chakra UI's `useRadio` hook for native radio button semantics with styled card visuals
- Extends `UseRadioProps` interface for seamless integration with `useRadioGroup` parent
- All accessibility requirements met: focus ring, aria attributes via native radio, keyboard navigation
- Touch target minimum of 44x44px maintained for mobile accessibility
- Component wrapped with `React.memo` for performance optimization
- Added comprehensive test suite with 24 tests covering all acceptance criteria
- Installed `@testing-library/user-event` as dev dependency for interaction testing
- Tests cover: rendering, radio input behavior, hover state, selected state, disabled state, keyboard navigation, and accessibility
- All tests in the codebase pass (no regressions)
- TypeScript compiles without errors
- ESLint passes on new files (pre-existing issues in other files not related to this story)

**Code Review Fixes Applied (2025-12-26):**
- Added `displayName` to React.memo wrapped component for better DevTools debugging
- Strengthened test for checkmark icon to verify it only appears when selected (counts icons: 2 when selected, 1 when not)
- Added hover state tests: verifies transition styles and pointer cursor
- Added test to verify checkmark icon is NOT shown when not selected
- Removed invalid Enter key test (native radio buttons only respond to Space key per browser standards)
- Deleted garbage `nul` files that were Windows artifacts from shell command errors
- Updated Verification Checklist to mark all items as verified

### File List

**New Files:**
- services/backend-api/client/src/features/templates/components/TemplateCard/index.tsx
- services/backend-api/client/src/features/templates/components/TemplateCard/TemplateCard.test.tsx

**Modified Files:**
- services/backend-api/client/src/features/templates/components/index.ts (updated barrel export)
- services/backend-api/client/src/features/templates/index.ts (added components export)
- services/backend-api/client/package.json (added @testing-library/user-event dev dependency)
- services/backend-api/client/package-lock.json (updated lock file)

## Change Log

- 2025-12-26: Story implementation complete - Created TemplateCard component with all visual states, radio input integration, accessibility features, and comprehensive test suite (21 tests)
- 2025-12-26: Code review complete - Fixed 6 issues (added displayName, strengthened tests, added hover/selected state tests, deleted garbage files, updated verification checklist). Test count now 24.
