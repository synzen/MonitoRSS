# Story 1.5: Accessible Template Selection

Status: ready-for-dev

## Dependencies

- Story 1.1: Template Types and Constants (provides Template interface and TEMPLATES array)
- Story 1.2: Shared Discord Message Display Component (for preview rendering)
- Story 1.3: Template Card Component (provides TemplateCard with radio button integration)
- Story 1.4: Template Gallery Modal (provides TemplateGalleryModal component to enhance)

## Story

As a user with accessibility needs,
I want the template gallery to be fully navigable via keyboard and compatible with screen readers,
So that I can select templates regardless of how I interact with my computer.

## Why Accessibility Matters

This story ensures the Template Gallery feature meets WCAG 2.1 AA compliance requirements. Per NFR6 from the PRD and the UX specification, accessibility is not optional - it's a core requirement. Users with visual impairments, motor disabilities, or those who prefer keyboard navigation must have an equivalent experience to mouse/touch users.

Key accessibility personas:
- **Screen reader users**: Need proper ARIA labels, announcements, and semantic HTML
- **Keyboard-only users**: Need logical tab order, arrow key navigation, and visible focus indicators
- **Low vision users**: Need sufficient color contrast and non-color-dependent state indicators

**Integration Note:** This story enhances the `TemplateGalleryModal` component created in Story 1.4. The modal's structure (fieldset, grid, preview panel) was designed with accessibility in mind from the start. Story 1.5 verifies and completes the accessibility implementation by:
- Confirming radio button semantics are correct
- Adding ARIA attributes for dynamic content (preview updates)
- Testing with real assistive technology

## Prerequisites Check

Before starting Story 1.5, verify the following are complete:

- [ ] **Story 1.1:** `Template` interface and `TEMPLATES` array exist at `src/features/templates/constants/templates.ts`
- [ ] **Story 1.2:** `DiscordMessageDisplay` component exists at `src/components/DiscordMessageDisplay/index.tsx`
- [ ] **Story 1.3:** `TemplateCard` component uses `useRadio` hook and accepts `UseRadioProps`
- [ ] **Story 1.4:** `TemplateGalleryModal` component wraps template grid in fieldset with visually hidden legend

If any prerequisite is incomplete, pause and complete that story first.

## Acceptance Criteria

1. **Given** the template gallery uses a radio button group pattern
   **When** the HTML is rendered
   **Then** it contains a fieldset with visually hidden radio inputs and template cards as styled labels

2. **Given** the template gallery modal is open
   **When** I press Tab
   **Then** focus moves through the interactive elements in logical order (template group, article selector, action buttons)

3. **Given** focus is on the template selection area
   **When** I press Arrow keys (Up/Down/Left/Right)
   **Then** focus moves between template options following radio button navigation conventions

4. **Given** focus is on a template option
   **When** I press Enter or Space
   **Then** that template becomes selected

5. **Given** a template is focused via keyboard
   **When** I view the template card
   **Then** a visible focus indicator (focus ring) is displayed around the card

6. **Given** a screen reader is active
   **When** focus enters the template selection area
   **Then** the screen reader announces the fieldset legend ("Choose a template") and current selection state

7. **Given** a screen reader is active and I navigate to a template
   **When** the template is announced
   **Then** it includes the template name and selection state (e.g., "Rich Embed, selected" or "Minimal Card, not selected")

8. **Given** the template gallery modal opens
   **When** I am using a keyboard
   **Then** focus is trapped within the modal until it is closed

9. **Given** the template gallery modal is closed
   **When** focus returns to the page
   **Then** focus is restored to the element that triggered the modal to open

10. **Given** the preview is loading
    **When** a screen reader is active
    **Then** the loading state is announced via aria-busy or aria-live region

11. **Given** a screen reader is active and I select a different template
    **When** the preview finishes loading with new content
    **Then** an aria-live region announces that the preview has updated (e.g., "Preview updated for Rich Embed template")

12. **Given** the preview panel container
    **When** it is rendered
    **Then** it has an accessible name (e.g., aria-label="Template preview") so screen reader users understand its purpose

## Tasks / Subtasks

- [ ] **Task 1: Verify fieldset/legend structure** (AC: #1, #6)
  - [ ] **Verify (Story 1.4):** Confirm `TemplateGalleryModal` uses `<Box as="fieldset">` or native `<fieldset>` wrapper around template grid
  - [ ] **Verify (Story 1.4):** Confirm visually hidden `<legend>Choose a template</legend>` exists using `<VisuallyHidden as="legend">`
  - [ ] **Verify (Story 1.4):** Confirm fieldset is the direct parent of the template radio group (grid container)
  - [ ] **Test (New):** Use NVDA to verify screen reader announces "Choose a template" when entering radio group

- [ ] **Task 2: Verify radio button semantics from TemplateCard** (AC: #1, #3, #4, #7)
  - [ ] Confirm each TemplateCard renders visually hidden `<input type="radio">` from `useRadio`
  - [ ] Confirm `Box as="label"` wraps the radio input and visual card
  - [ ] Verify arrow key navigation works between cards (native radio behavior)
  - [ ] Verify Space/Enter selects the focused template
  - [ ] Verify screen reader announces: "[Template Name], radio button, [X] of [Y], [checked/not checked]"

- [ ] **Task 3: Implement visible focus indicators** (AC: #5)
  - [ ] Verify TemplateCard has `_focus={{ boxShadow: "outline" }}` or equivalent
  - [ ] Ensure focus ring has sufficient contrast (3:1 minimum per WCAG)
  - [ ] Test focus visibility in both light and dark modes (if applicable)
  - [ ] Ensure focus ring is visible on all states (default, selected, disabled)

- [ ] **Task 4: Implement logical tab order** (AC: #2)
  - [ ] Verify tab order: Modal close button -> Template radio group -> Article selector -> Footer buttons
  - [ ] Ensure tab does not get trapped in unexpected locations
  - [ ] Within radio group, Tab exits to next element (arrow keys navigate within)
  - [ ] Add `tabIndex` attributes only where necessary to correct order

- [ ] **Task 5: Implement focus trap in modal** (AC: #8, #9)
  - [ ] Verify Chakra Modal's built-in focus trap is active
  - [ ] Test that Tab at last element wraps to first element
  - [ ] Test that Shift+Tab at first element wraps to last element
  - [ ] Verify focus returns to trigger element when modal closes
  - [ ] Use `finalFocusRef` prop on Modal if needed to ensure correct return

- [ ] **Task 6: Implement preview loading announcements** (AC: #10)
  - [ ] **Location:** Preview panel in `TemplateGalleryModal` component (Story 1.4, line 356-386)
  - [ ] **Verify (Story 1.4):** Confirm `aria-busy` is passed from modal's preview hook to preview panel container
  - [ ] **Enhance:** Add `aria-busy="true"` to preview container when `isPreviewLoading` is true
  - [ ] **Enhance:** Remove `aria-busy` when loading completes
  - [ ] Note: Preview API is called by `TemplateGalleryModal` (Story 1.4), not by accessibility code

- [ ] **Task 7: Implement preview update announcements** (AC: #11)
  - [ ] **Location:** Add aria-live region to `TemplateGalleryModal` component (NOT TemplateCard)
  - [ ] The live region should be a sibling of the preview panel, visually hidden
  - [ ] Create an `aria-live="polite"` region for preview status announcements
  - [ ] When preview loads successfully, update live region with message:
    ```typescript
    // In TemplateGalleryModal - Example implementation
    const [announceMessage, setAnnounceMessage] = useState("");

    // Debounce to avoid rapid template changes spamming announcements
    useEffect(() => {
      if (!isPreviewLoading && previewData && selectedTemplateId) {
        const template = templates.find(t => t.id === selectedTemplateId);
        setAnnounceMessage(`Preview updated for ${template?.name} template`);
        // Clear after announcement
        const timer = setTimeout(() => setAnnounceMessage(""), 1000);
        return () => clearTimeout(timer);
      }
    }, [isPreviewLoading, previewData, selectedTemplateId]);
    ```
  - [ ] Ensure live region is visually hidden using `<VisuallyHidden>` from Chakra

- [ ] **Task 8: Add accessible name to preview panel** (AC: #12)
  - [ ] **Verify (Story 1.4):** Confirm preview panel exists in `TemplateGalleryModal` (line 356-386)
  - [ ] Add `aria-label="Template preview"` to the preview panel container
  - [ ] Add `role="region"` to preview container (recommended for landmark navigation)
  - [ ] Alternatively use `aria-labelledby` pointing to a heading within the panel
  - [ ] Ensure heading/label text is descriptive and unique on the page

- [ ] **Task 9: Verify disabled template accessibility** (AC: #7)
  - [ ] **Verify (Story 1.3):** Confirm `aria-disabled="true"` comes from native radio input (via `useRadio` hook)
  - [ ] Verify screen reader announces disabled state (e.g., "Simple Text, radio button, 1 of 4, unavailable")
  - [ ] Ensure disabled templates are still announced but clearly marked as unavailable
  - [ ] Test that disabled templates are skipped during arrow key navigation (native radio behavior)
  - [ ] Test that Tab key skips disabled radio inputs entirely (moves to next focusable element)
  - [ ] Test that disabled templates cannot be selected via Enter/Space

- [ ] **Task 10: Verify color contrast compliance** (AC: #5)
  - [ ] Verify text-to-background contrast meets 4.5:1 ratio (normal text)
  - [ ] Verify large text contrast meets 3:1 ratio
  - [ ] Verify UI component contrast meets 3:1 ratio (borders, focus rings)
  - [ ] **Specifically test disabled template text contrast** (opacity 0.5 reduces effective contrast)
  - [ ] If disabled text fails contrast, consider alternative styling (e.g., gray.500 without opacity)
  - [ ] Use browser DevTools or axe-core to audit contrast

- [ ] **Task 11: Implement non-color state indicators** (AC: #5)
  - [ ] Confirm selected state uses checkmark icon (not just blue border)
  - [ ] Confirm disabled state uses "Needs articles" badge (not just opacity)
  - [ ] Verify states are distinguishable in grayscale/colorblind modes

- [ ] **Task 12: Create accessibility test suite** (AC: all)
  - [ ] Add unit tests for keyboard navigation (arrow keys, Enter, Space)
  - [ ] Add unit tests for focus management (trap, return)
  - [ ] Add integration tests using @testing-library/react with accessibility matchers
  - [ ] Document manual testing checklist for screen reader verification

- [ ] **Task 13: Export and verify** (AC: all)
  - [ ] Run TypeScript type check: `npm run type-check`
  - [ ] Run automated accessibility audit: `npm run test` with axe-core
  - [ ] Perform manual screen reader testing (NVDA or VoiceOver)
  - [ ] Perform manual keyboard-only navigation testing

## Dev Notes

### Critical Architecture Constraints

**MUST FOLLOW - These are non-negotiable:**

1. **No Custom ARIA if Native Works**: Prefer native HTML semantics over custom ARIA. The radio button pattern from `useRadio` provides most accessibility features automatically.
2. **Chakra UI Accessibility**: Chakra components (Modal, useRadioGroup) have built-in accessibility. Enhance, don't replace.
3. **WCAG 2.1 AA Compliance**: This is the target compliance level per PRD NFR6.
4. **Test with Real Assistive Technology**: Automated tests are insufficient. Manual testing with NVDA/VoiceOver required.

### Radio Button Group Pattern (UX Spec Reference)

Per docs/ux-design-specification.md:862-890, the template gallery uses native radio button semantics:

```html
<fieldset>
  <legend class="visually-hidden">Choose a template</legend>

  <input type="radio" name="template" id="template-1" class="visually-hidden" />
  <label for="template-1">
    <!-- TemplateCard visual content -->
  </label>

  <input type="radio" name="template" id="template-2" class="visually-hidden" />
  <label for="template-2">
    <!-- TemplateCard visual content -->
  </label>
</fieldset>
```

**Benefits of this pattern:**
- Native keyboard navigation (arrow keys between options)
- Built-in screen reader support
- No custom ARIA attributes needed for basic functionality
- Form-compatible if needed

### Chakra useRadio Hook Reference

From Story 1.3, TemplateCard uses `useRadio`:

```typescript
import { useRadio, UseRadioProps } from "@chakra-ui/react";

export const TemplateCard = (props: TemplateCardProps) => {
  const { template, disabledReason, testId, ...radioProps } = props;
  const { getInputProps, getCheckboxProps, state } = useRadio(radioProps);

  const input = getInputProps();
  const checkbox = getCheckboxProps();
  const { isChecked, isDisabled } = state;

  return (
    <Box as="label" data-testid={testId}>
      {/* Visually hidden native radio input */}
      <input {...input} />

      {/* Visual card representation */}
      <Box {...checkbox} /* styling props */ >
        {/* Template content */}
      </Box>
    </Box>
  );
};
```

The `useRadio` hook:
- Generates accessible input props (`getInputProps`)
- Provides state (`isChecked`, `isDisabled`, `isFocused`)
- Handles keyboard events automatically
- Works with `useRadioGroup` for group management

### Focus Ring Implementation

Chakra's focus ring should be visible and high-contrast:

```typescript
<Box
  {...checkbox}
  _focus={{
    boxShadow: "outline",  // Chakra's built-in focus ring
    // Or custom: boxShadow: "0 0 0 3px rgba(66, 153, 225, 0.6)"
  }}
  // ...other props
>
```

The focus ring must:
- Have at least 3:1 contrast ratio against background
- Be visible on all card states (default, hover, selected, disabled)
- Not be removed or hidden by other styles

### Live Region Implementation

For dynamic content announcements:

```typescript
// In TemplateGalleryModal
const [statusMessage, setStatusMessage] = useState("");

// Update when preview loads
useEffect(() => {
  if (!isPreviewLoading && previewData && selectedTemplateId) {
    const template = templates.find(t => t.id === selectedTemplateId);
    if (template) {
      setStatusMessage(`Preview updated for ${template.name} template`);
    }
  }
}, [isPreviewLoading, previewData, selectedTemplateId]);

// Clear message after announcement
useEffect(() => {
  if (statusMessage) {
    const timer = setTimeout(() => setStatusMessage(""), 1000);
    return () => clearTimeout(timer);
  }
}, [statusMessage]);

// Render live region (visually hidden)
<VisuallyHidden>
  <div aria-live="polite" aria-atomic="true">
    {statusMessage}
  </div>
</VisuallyHidden>
```

**Important live region rules:**
- `aria-live="polite"` waits for user to finish current activity
- `aria-atomic="true"` reads entire content, not just changes
- Message must change to trigger announcement
- Keep messages brief and informative

### Preview Panel Accessibility

```typescript
<Box
  bg="gray.900"
  borderRadius="md"
  p={4}
  minH={{ base: "200px", lg: "400px" }}
  aria-label="Template preview"
  aria-busy={isPreviewLoading}
  role="region"
>
  {/* Preview content */}
</Box>
```

Attributes:
- `aria-label="Template preview"` - Names the region for screen readers
- `aria-busy="true/false"` - Indicates loading state
- `role="region"` - Makes it a landmark (optional, use sparingly)

### Modal Focus Management

Chakra Modal handles focus management automatically:

```typescript
<Modal
  isOpen={isOpen}
  onClose={onClose}
  // Focus first interactive element on open (default behavior)
  // Trap focus within modal (default behavior)
  // Return focus to trigger on close (default behavior)

  // Override if needed:
  initialFocusRef={firstFocusRef}  // Custom initial focus
  finalFocusRef={triggerRef}       // Custom return focus
>
```

Verify these behaviors work correctly:
1. Opening modal moves focus inside
2. Tab cycles through modal elements only
3. Closing modal returns focus to trigger

### Color Contrast Reference

| Element | Foreground | Background | Ratio | Requirement |
|---------|------------|------------|-------|-------------|
| Card text (white) | #FFFFFF | gray.800 (#2D3748) | ~11:1 | Pass (4.5:1) |
| Secondary text (gray.400) | #A0AEC0 | gray.800 (#2D3748) | ~4.7:1 | Pass (4.5:1) |
| Focus ring (blue.400) | #4299E1 | gray.800 (#2D3748) | ~4.3:1 | Pass (3:1 UI) |
| Disabled text (opacity 0.5) | ~#909CA7 effective | gray.800 (#2D3748) | ~3.5:1 | Verify meets 4.5:1 or use alternative |
| Selected border (blue.500) | #3182CE | gray.800 (#2D3748) | ~4.1:1 | Pass (3:1 UI) |

**Use tools to verify:**
- Chrome DevTools color contrast checker
- axe DevTools browser extension
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/

### Previous Story Intelligence

**From Story 1.3 (Template Card Component):**
- TemplateCard extends `UseRadioProps` and works with `useRadioGroup`
- Uses `Box as="label"` with hidden input pattern
- Has `_focus`, `_checked`, `_disabled` pseudo-props
- Focus ring: `_focus={{ boxShadow: "outline" }}`
- Disabled state: `aria-disabled` from native radio input

**From Story 1.4 (Template Gallery Modal):**
- Uses `useRadioGroup` for template selection management
- Has `<fieldset>` with `<VisuallyHidden as="legend">`
- Preview panel has `aria-label` and `aria-busy`
- Modal uses Chakra's built-in focus management

### Testing Strategy

**Automated Testing (Unit/Integration):**

```typescript
// Example: Testing keyboard navigation
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplateGalleryModal } from "./TemplateGalleryModal";

describe("TemplateGalleryModal Accessibility", () => {
  it("navigates templates with arrow keys", async () => {
    const user = userEvent.setup();
    render(<TemplateGalleryModal {...props} />);

    const firstTemplate = screen.getByRole("radio", { name: /simple text/i });
    await user.click(firstTemplate);

    // Arrow right should move to next template
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /rich embed/i })).toHaveFocus();
  });

  it("traps focus within modal", async () => {
    const user = userEvent.setup();
    render(<TemplateGalleryModal {...props} />);

    const closeButton = screen.getByRole("button", { name: /close/i });
    const lastButton = screen.getByRole("button", { name: /primary action/i });

    await user.click(lastButton);
    await user.tab();

    // Focus should wrap to beginning of modal
    expect(closeButton).toHaveFocus();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<TemplateGalleryModal {...props} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

**Manual Testing Checklist:**

| Test | NVDA | VoiceOver | Keyboard |
|------|------|-----------|----------|
| Modal title announced on open | | | N/A |
| Fieldset legend announced | | | N/A |
| Template name + state announced | | | N/A |
| Arrow keys navigate templates | N/A | N/A | |
| Space/Enter selects template | N/A | N/A | |
| Tab moves between sections | N/A | N/A | |
| Focus ring visible on focus | N/A | N/A | |
| Preview loading announced | | | N/A |
| Preview update announced | | | N/A |
| Modal focus trap works | N/A | N/A | |
| Focus returns on close | N/A | N/A | |
| Disabled templates announced | | | |

### Screen Reader Testing Guide (Required)

**IMPORTANT:** Automated tests (axe-core) catch ~30% of accessibility issues. Manual screen reader testing is **mandatory** before marking this story complete.

**Testing Environment:**
- **Windows:** NVDA (free, open-source) - Primary testing target
- **Mac:** VoiceOver (built-in) - Secondary verification
- **Browser:** Chrome or Firefox (ensure compatibility with screen reader)

**Step-by-Step Test Script:**
1. Open template gallery modal
2. Enable screen reader (NVDA: Ctrl+Alt+N)
3. Navigate to modal with Tab key
4. **Expected:** "Choose a template, radio group" announced
5. Press Down arrow key to navigate templates
6. **Expected:** "[Template name], radio button, 1 of 5, not checked" announced
7. Press Space to select template
8. **Expected:** "[Template name], radio button, 1 of 5, checked" announced
9. Navigate to preview panel with Tab
10. **Expected:** "Template preview, region" announced (if role="region" used)
11. Wait for preview to load
12. **Expected:** aria-live region announces "Preview updated for [Template name] template"

**Troubleshooting:**
- If radio group not announced: Check fieldset/legend structure
- If "checked" state not announced: Verify native radio input exists
- If template name cut off: Check for aria-label on radio input

### Dependencies to Import

```typescript
// Chakra UI
import {
  VisuallyHidden,
  // Other imports from Story 1.4
} from "@chakra-ui/react";

// Testing utilities
import { axe, toHaveNoViolations } from "jest-axe";
expect.extend(toHaveNoViolations);
```

### File Modifications

This story primarily enhances existing components from Stories 1.3 and 1.4:

```
services/backend-api/client/src/features/templates/
├── components/
│   ├── TemplateCard/
│   │   └── index.tsx          # Verify/enhance focus indicators
│   └── TemplateGalleryModal/
│       └── index.tsx          # Add live regions, verify ARIA attributes
└── __tests__/
    └── accessibility.test.tsx # NEW - Accessibility test suite
```

### Existing Pattern Reference

The codebase likely has existing accessibility patterns:

1. **RadioCardGroup**: `src/components/RadioCardGroup/index.tsx` - Uses similar radio pattern
2. **Modal usage**: Search for existing modals with focus management
3. **Form accessibility**: Look for fieldset/legend patterns in forms

### Performance Considerations

- Live regions should update minimally to avoid announcement spam
- Focus management should not cause unnecessary re-renders
- Use `useCallback` for handlers passed to ARIA-related components

### Common Accessibility Mistakes to Avoid

1. **Don't use `div` with `role="radio"`** - Use native `<input type="radio">`
   - **Why:** Native radios provide keyboard navigation (arrow keys), form compatibility, and screen reader semantics automatically

2. **Don't hide focus indicators** - Always visible for keyboard users
   - **Why:** Violates WCAG 2.1 Success Criterion 2.4.7 (Focus Visible)

3. **Don't rely on color alone** - Use icons, badges, and text
   - **Why:** Violates WCAG 2.1 Success Criterion 1.4.1 (Use of Color) - affects colorblind users

4. **Don't over-announce** - Too many live region updates is annoying
   - **Why:** Screen reader users report frustration with "chatty" interfaces that announce every minor change

5. **Don't forget disabled state** - Disabled elements still need to be announced
   - **Why:** Users need to know an option exists but is unavailable (vs. hidden entirely)

6. **Don't skip testing** - Automated tests miss real-world issues
   - **Why:** Automated tools catch ~30% of accessibility issues; manual testing with assistive tech catches the other 70%

7. **Don't use `aria-label` to override native radio semantics** (Story 1.5 specific)
   - **Why:** Native radio inputs already announce correctly; adding aria-label can cause double-announcement or confusion

### References

- [Architecture: Accessibility Pattern] docs/architecture.md:329-339
- [UX: Accessibility Strategy] docs/ux-design-specification.md:862-909
- [UX: Radio Button Implementation] docs/ux-design-specification.md:875-889
- [PRD: FR24] docs/prd.md - Keyboard navigation
- [PRD: FR25] docs/prd.md - Screen reader support
- [PRD: FR26] docs/prd.md - Focus management
- [PRD: NFR6] docs/prd.md - WCAG 2.1 AA compliance
- [PRD: NFR7] docs/prd.md - Keyboard operable
- [PRD: NFR8] docs/prd.md - Screen reader identification
- [PRD: NFR9] docs/prd.md - Focus indicators visible
- [PRD: NFR10] docs/prd.md - Loading states announced
- [Epics: Story 1.5] docs/epics.md:329-383
- [Project Context: Accessibility Requirements] docs/project_context.md:169-175
- [Chakra UI Accessibility](https://chakra-ui.com/docs/components/visually-hidden)
- [WCAG 2.1 AA Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WAI-ARIA Authoring Practices: Radio Group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)

## Verification Checklist

Before marking this story complete, verify:

**Semantic HTML:**
- [ ] Template grid uses `<fieldset>` with visually hidden `<legend>`
- [ ] Each template has native `<input type="radio">` (visually hidden)
- [ ] Template cards are `<label>` elements wrapping their radio input

**Keyboard Navigation:**
- [ ] Tab moves between major sections (templates, article selector, buttons)
- [ ] Arrow keys navigate within template radio group
- [ ] Enter/Space selects the focused template
- [ ] Tab cycles within modal (focus trap)
- [ ] Focus returns to trigger element on modal close

**Focus Indicators:**
- [ ] Focus ring visible on all template cards when focused
- [ ] Focus ring has 3:1 contrast ratio minimum
- [ ] Focus visible on all interactive elements in modal

**Screen Reader:**
- [ ] "Choose a template" legend announced when entering radio group
- [ ] Each template announces: name, radio button, position, checked state
- [ ] Disabled templates announce disabled state
- [ ] Preview loading state announced via aria-busy
- [ ] Preview updates announced via aria-live region

**Color Contrast:**
- [ ] All text meets 4.5:1 contrast ratio
- [ ] UI components meet 3:1 contrast ratio
- [ ] Selected state distinguishable without color (checkmark icon)
- [ ] Disabled state distinguishable without color (badge)

**Testing:**
- [ ] Automated axe-core tests pass
- [ ] Manual NVDA testing completed
- [ ] Manual VoiceOver testing completed (if Mac available)
- [ ] Keyboard-only navigation test completed

**Epic Acceptance Criteria Coverage:**
- [x] FR24: Keyboard navigation (AC #2, #3, #4)
- [x] FR25: Screen reader support (AC #6, #7, #10, #11, #12)
- [x] FR26: Focus management (AC #8, #9)
- [x] NFR6: WCAG 2.1 AA compliance (All ACs)
- [x] NFR7: Keyboard operable (AC #2, #3, #4)
- [x] NFR8: Screen reader identification (AC #6, #7)
- [x] NFR9: Focus indicators visible (AC #5)
- [x] NFR10: Loading states announced (AC #10, #11)

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
