---
stepsCompleted: [1, 2, 3, 4]
status: complete
completedAt: '2025-12-14'
inputDocuments:
  - docs/prd.md
  - docs/architecture.md
  - docs/ux-design-specification.md
---

# MonitoRSS-templates - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for MonitoRSS-templates, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Users can view a gallery of pre-designed message templates displayed as a visual grid
FR2: Users can see a preview of how each template will render with their feed's content
FR3: Users can select an article from their feed to use as preview sample data
FR4: Users can apply a template to their connection with a single click
FR5: Users can see which template is currently selected/active
FR6: System displays loading indicator while fetching template preview
FR7: Users are presented with template selection as part of the connection creation flow
FR8: Connection only becomes active after user completes template selection step (or skips)
FR9: Users can skip template selection to use the default template
FR10: Users are shown confirmation that delivery will be automatic after setup
FR11: Users can access the template gallery from within the message builder UI
FR12: Users can apply a template to an existing connection
FR13: Selecting a template populates the message builder form fields with template settings
FR14: Users can modify template settings after applying (template is a starting point)
FR15: Users are informed that changes won't overwrite settings until they explicitly save
FR16: Users can discard changes to restore their previous configuration
FR17: Users can send a test article to Discord after selecting a template
FR18: Users are informed that test send is optional and delivery will be automatic going forward
FR19: Users with empty feeds can select only the default template
FR20: Users with empty feeds see other templates greyed out with explanatory message
FR21: Users with empty feeds can proceed with default template and return later
FR22: System provides a default template that works with any feed (safe, never fails)
FR23: Users who skip template selection automatically receive the default template
FR24: Users can navigate the template gallery using keyboard controls
FR25: Screen reader users receive appropriate labels and announcements for template selection
FR26: Focus is properly managed when opening/closing the template gallery

### NonFunctional Requirements

NFR1: Template gallery UI loads without blocking the connection creation flow
NFR2: Only the currently selected template preview is rendered (not all templates simultaneously)
NFR3: Preview fetch is triggered immediately on template/article selection change
NFR4: Loading indicators provide feedback during preview network requests
NFR5: UI interactions (selection, navigation) remain responsive during preview loading
NFR6: Template gallery meets WCAG 2.1 AA compliance
NFR7: All template selection functionality is operable via keyboard
NFR8: Screen readers can identify templates, selection state, and preview content
NFR9: Focus indicators are clearly visible during keyboard navigation
NFR10: Loading states are announced to assistive technologies
NFR11: Template gallery adapts to mobile, tablet, and desktop screen sizes
NFR12: Touch targets for template selection meet minimum size guidelines (44x44px)
NFR13: Template preview reuses existing message preview API and component
NFR14: Template application uses existing connection/message builder data structures
NFR15: No changes required to Discord delivery infrastructure

### Additional Requirements

**From Architecture:**
- No starter template required - brownfield project extending existing React 18 + Chakra UI codebase
- Templates stored as TypeScript constants in frontend code (no backend changes for MVP)
- Template interface must support both V1 (Legacy embeds) and V2 (component-based) message formats
- New feature module structure at `src/features/templates/`
- Extract shared `DiscordMessageDisplay` component from existing `DiscordMessagePreview`
- Form integration via `form.setValue('messageComponent', template.messageComponent)`
- Minimum 4 pre-designed templates required at launch
- Template declares `requiredFields` array for feed capability filtering

**From UX Design:**
- Modal gallery layout with side-by-side preview (desktop) / stacked below (mobile)
- Radio button group pattern with visually hidden inputs for accessible template selection
- "Needs articles" badge on disabled templates for empty feeds
- Inline feedback using Alert components (no toasts)
- Button hierarchy: Primary action right, Secondary center, Tertiary (link style) left
- Minimum 44x44px touch targets for mobile accessibility
- Full-screen modal on mobile devices (<768px viewport)
- TemplateCard component with Default, Hover, Selected, and Disabled states
- Loading states use Chakra Skeleton components
- "Send Test & Save" as primary action in connection flow (opt-out pattern)
- "Use this template" as primary action in message builder context

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 1 | View gallery as visual grid |
| FR2 | Epic 1 | See preview with feed content |
| FR3 | Epic 1 | Select article for preview |
| FR4 | Epic 2 | One-click template application |
| FR5 | Epic 1 | See which template is selected |
| FR6 | Epic 1 | Loading indicator for preview |
| FR7 | Epic 2 | Template selection in connection flow |
| FR8 | Epic 2 | Connection active after template step |
| FR9 | Epic 2 | Skip to use default template |
| FR10 | Epic 2 | Confirmation of automatic delivery |
| FR11 | Epic 3 | Access gallery from message builder |
| FR12 | Epic 3 | Apply template to existing connection |
| FR13 | Epic 3 | Template populates form fields |
| FR14 | Epic 3 | Modify settings after applying |
| FR15 | Epic 3 | "Changes not saved until Save" messaging |
| FR16 | Epic 3 | Discard changes option |
| FR17 | Epic 2 | Test send after template selection |
| FR18 | Epic 2 | Test send optional messaging |
| FR19 | Epic 2 | Empty feeds: default only selectable |
| FR20 | Epic 2 | Empty feeds: others greyed out |
| FR21 | Epic 2 | Empty feeds: proceed and return later |
| FR22 | Epic 1 | Default template that never fails |
| FR23 | Epic 2 | Skip = default template applied |
| FR24 | Epic 1 | Keyboard navigation |
| FR25 | Epic 1 | Screen reader support |
| FR26 | Epic 1 | Focus management |

## Epic List

### Epic 1: Template Gallery Foundation

**Goal:** Users can browse and preview professionally-designed templates that show exactly how their messages will look in Discord.

**FRs covered:** FR1, FR2, FR3, FR5, FR6, FR22, FR24, FR25, FR26

**User Value:**
- View a visual grid of pre-designed templates
- See live previews rendered with actual feed content
- Select different articles to preview how templates adapt
- Navigate the gallery via keyboard with screen reader support
- Have confidence in a "default" template that always works

**Implementation Notes:**
- Creates the core `src/features/templates/` module
- Extracts shared `DiscordMessageDisplay` component
- Implements `TemplateCard` with all states (default, hover, selected, disabled)
- Establishes accessibility patterns (radio button group)

---

### Epic 2: New User Onboarding Flow

**Goal:** New users can select a template during connection creation and immediately see it working in Discord - the "3 minute setup" experience.

**FRs covered:** FR4, FR7, FR8, FR9, FR10, FR17, FR18, FR19, FR20, FR21, FR23

**User Value:**
- See template gallery as part of connection creation flow
- Apply a template with a single click
- Send a test article to Discord to validate their choice
- Skip template selection and get sensible defaults
- Proceed even with empty feeds (default template only)
- See clear confirmation that delivery will be automatic

**Implementation Notes:**
- Integrates gallery into `AddConnectionDialog` flow
- Implements empty feed handling (disabled templates with "Needs articles" badge)
- Adds test send integration with inline feedback
- Creates the opt-out test send pattern ("Send Test & Save" as primary)

---

### Epic 3: Existing User Template Access

**Goal:** Existing users can discover and apply templates to improve their existing connections without starting over.

**FRs covered:** FR11, FR12, FR13, FR14, FR15, FR16

**User Value:**
- Access templates from the message builder UI
- Apply a template to populate form fields
- Further customize the template settings if desired
- Discard changes to restore previous configuration
- See clear messaging that changes aren't saved until they click Save

**Implementation Notes:**
- Adds "Templates" button to message builder page
- Implements form field population from template
- Adds "Discard changes" functionality
- Uses existing save/test patterns from message builder

---

## Epic 1: Template Gallery Foundation

Users can browse and preview professionally-designed templates that show exactly how their messages will look in Discord.

### Story 1.1: Template Types and Constants

**As a** developer,
**I want** a well-defined Template interface and a set of pre-designed templates,
**So that** the template gallery has professional content to display and a safe default that always works.

**Acceptance Criteria:**

**Given** the feature module structure exists at `src/features/templates/`
**When** I import from `@/features/templates`
**Then** I have access to a `Template` interface with: id, name, description, thumbnail (optional), requiredFields array, and messageComponent (supporting V1 and V2 formats)

**Given** the templates constant file exists
**When** I access the templates array
**Then** there are at least 4 pre-designed templates available

**Given** one template is designated as the default
**When** I check its requiredFields array
**Then** it is empty (requires no specific feed fields, safe for any feed)

**Given** any template in the array
**When** I inspect its messageComponent
**Then** it contains a valid MessageComponentRoot structure (V1 Legacy or V2 format)

**Given** templates need thumbnails for the gallery
**When** I access a template's thumbnail property
**Then** it contains a reference to a static preview image or is undefined (preview will be generated dynamically)

### Story 1.2: Shared Discord Message Display Component

**As a** developer,
**I want** a stateless Discord message display component extracted from the existing preview code,
**So that** both the message builder and template gallery can render Discord-style previews consistently.

**Acceptance Criteria:**

**Given** the existing `DiscordMessagePreview` component in the message builder
**When** I extract the rendering logic into `src/components/DiscordMessageDisplay/index.tsx`
**Then** the new component accepts props only (no internal data fetching or context usage)

**Given** a `DiscordMessageDisplay` component
**When** I pass it preview data from the preview API response
**Then** it renders the Discord embed/message visually matching the current preview output

**Given** the preview data contains a V1 (Legacy embed) format
**When** `DiscordMessageDisplay` renders it
**Then** it displays the embed with title, description, color, thumbnail, fields, footer, and timestamp as appropriate

**Given** the preview data contains a V2 (component-based) format
**When** `DiscordMessageDisplay` renders it
**Then** it displays the component structure correctly (buttons, action rows, etc.)

**Given** the existing `DiscordMessagePreview` in the message builder
**When** it is refactored to use `DiscordMessageDisplay`
**Then** the message builder preview continues to work exactly as before (no visual or behavioral changes)

**Given** `DiscordMessageDisplay` receives no data or empty data
**When** it renders
**Then** it displays an appropriate empty state or placeholder

### Story 1.3: Template Card Component

**As a** user,
**I want** to see each template as a visually distinct card with clear selection states,
**So that** I can easily browse templates and understand which one is selected.

**Acceptance Criteria:**

**Given** a `TemplateCard` component at `src/features/templates/components/TemplateCard/index.tsx`
**When** it receives a template object as props
**Then** it displays the template name and a visual thumbnail/preview representation

**Given** a template card in its default state
**When** I view it
**Then** it has a subtle border and pointer cursor indicating it's interactive

**Given** a template card
**When** I hover over it with my mouse
**Then** it shows a highlighted border and slight elevation/shadow

**Given** a template card that is currently selected
**When** I view it
**Then** it displays a primary color border and a checkmark indicator showing selection

**Given** a template card that is disabled (for empty feeds)
**When** I view it
**Then** it appears greyed out with a "Needs articles" badge and shows a not-allowed cursor

**Given** a disabled template card
**When** I click on it
**Then** nothing happens (click is ignored)

**Given** any template card
**When** rendered on a mobile device
**Then** it maintains a minimum touch target size of 44x44px

### Story 1.4: Template Gallery Modal

**As a** user,
**I want** a modal that displays all available templates in a grid with a live preview panel,
**So that** I can browse templates visually and see exactly how my messages will look.

**Acceptance Criteria:**

**Given** the `TemplateGalleryModal` component at `src/features/templates/components/TemplateGalleryModal/index.tsx`
**When** it is opened
**Then** it displays a modal with title "Choose a Template", a close button, template grid, and preview panel

**Given** the gallery modal is open on desktop (1024px+)
**When** I view the layout
**Then** the template grid appears on the left and the preview panel on the right (side-by-side)

**Given** the gallery modal is open on mobile (<768px)
**When** I view the layout
**Then** the modal is full-screen with the preview panel stacked below the template grid

**Given** the gallery modal is open
**When** I view the template grid
**Then** it displays templates in a responsive grid (3 columns desktop, 2 tablet, 1 mobile)

**Given** the gallery modal with feed articles available
**When** I click on a template card
**Then** the template becomes selected and the preview panel updates to show how that template renders with the current article

**Given** the gallery modal
**When** I want to preview with a different article
**Then** I can access an article selector (reusing existing component) to change the preview sample data

**Given** the preview is loading after template/article selection change
**When** I view the preview panel
**Then** a Skeleton loading state is displayed until the preview loads

**Given** the gallery modal
**When** I click the X button, press ESC, or click outside the modal
**Then** the modal closes without applying changes

### Story 1.5: Accessible Template Selection

**As a** user with accessibility needs,
**I want** the template gallery to be fully navigable via keyboard and compatible with screen readers,
**So that** I can select templates regardless of how I interact with my computer.

**Acceptance Criteria:**

**Given** the template gallery uses a radio button group pattern
**When** the HTML is rendered
**Then** it contains a fieldset with visually hidden radio inputs and template cards as styled labels

**Given** the template gallery modal is open
**When** I press Tab
**Then** focus moves through the interactive elements in logical order (template group, article selector, action buttons)

**Given** focus is on the template selection area
**When** I press Arrow keys (Up/Down/Left/Right)
**Then** focus moves between template options following radio button navigation conventions

**Given** focus is on a template option
**When** I press Enter or Space
**Then** that template becomes selected

**Given** a template is focused via keyboard
**When** I view the template card
**Then** a visible focus indicator (focus ring) is displayed around the card

**Given** a screen reader is active
**When** focus enters the template selection area
**Then** the screen reader announces the fieldset legend ("Choose a template") and current selection state

**Given** a screen reader is active and I navigate to a template
**When** the template is announced
**Then** it includes the template name and selection state (e.g., "Rich Embed, selected" or "Minimal Card, not selected")

**Given** the template gallery modal opens
**When** I am using a keyboard
**Then** focus is trapped within the modal until it is closed

**Given** the template gallery modal is closed
**When** focus returns to the page
**Then** focus is restored to the element that triggered the modal to open

**Given** the preview is loading
**When** a screen reader is active
**Then** the loading state is announced via aria-busy or aria-live region

**Given** a screen reader is active and I select a different template
**When** the preview finishes loading with new content
**Then** an aria-live region announces that the preview has updated (e.g., "Preview updated for Rich Embed template")

**Given** the preview panel container
**When** it is rendered
**Then** it has an accessible name (e.g., aria-label="Template preview") so screen reader users understand its purpose

---

## Epic 2: New User Onboarding Flow

New users can select a template during connection creation and immediately see it working in Discord - the "3 minute setup" experience.

### Story 2.1: Template Selection Step in Connection Flow

**As a** new user creating a connection,
**I want** to be presented with template selection as part of the connection setup,
**So that** I can choose how my messages will look before my connection goes live.

**Acceptance Criteria:**

**Given** I am creating a new connection in the AddConnectionDialog
**When** I complete the Discord channel selection step
**Then** I am presented with the template selection step before the connection is finalized

**Given** I am on the template selection step
**When** the step loads
**Then** the Template Gallery Modal opens automatically with my feed's articles available for preview

**Given** I am on the template selection step
**When** I view the modal
**Then** only templates compatible with my feed's available fields are enabled (based on requiredFields matching)

**Given** I am on the template selection step
**When** I have not yet completed this step
**Then** my connection is not active and no articles will be delivered

**Given** I complete the template selection step (by selecting a template or skipping)
**When** I proceed
**Then** the connection becomes active and articles will begin delivering automatically

**Given** the template gallery loads
**When** the UI renders
**Then** it does not block or delay the connection creation flow (NFR1)

**Given** I am on the template selection step
**When** my feed's available fields don't match any template's requiredFields (except the default)
**Then** only the default template is enabled, other templates show "Missing fields" badge, and an info banner explains: "Your feed has limited fields available. The default template works with any feed."

**Given** I am on the template selection step with limited feed fields
**When** only the default template is enabled
**Then** the default template is automatically selected and the preview panel shows exactly how it will render with my feed's content

**Given** the default template is selected
**When** I view the template card
**Then** it clearly indicates this is the "Default" template (e.g., labeled "Default" or "Safe Default") with a brief description like "Simple text format that works with any feed"

### Story 2.2: One-Click Template Application

**As a** new user,
**I want** to apply a template with a single click,
**So that** I can quickly choose how my messages look without complex configuration.

**Acceptance Criteria:**

**Given** I am in the template gallery during connection creation
**When** I click on an enabled template card
**Then** the template is selected with one click (no confirmation dialog required)

**Given** I have selected a template
**When** the template is applied to my connection
**Then** the connection's messageComponent is set to the template's messageComponent structure

**Given** I am in the template gallery
**When** I click the "Skip" button (secondary action)
**Then** the default template is automatically applied to my connection

**Given** I skip template selection
**When** my connection is created
**Then** it uses the default template settings (FR23 - skip = default applied)

**Given** I have selected a template
**When** I want to change my mind before finalizing
**Then** I can click a different template to switch my selection (no penalty, no extra steps)

**Given** the template gallery modal footer
**When** I view the action buttons
**Then** they follow the button hierarchy: "Customize manually" (tertiary/link) on left, "Skip" (secondary) in center-right, primary action on right

### Story 2.3: Empty Feed Handling

**As a** user with a feed that has no articles yet,
**I want** to still be able to complete connection setup with a safe default,
**So that** I'm not blocked from setting up my connection while waiting for feed content.

**Acceptance Criteria:**

**Given** I am on the template selection step
**When** my feed has no articles available
**Then** the default template is the only selectable option

**Given** I am on the template selection step with an empty feed
**When** I view the template gallery
**Then** all templates except the default are displayed but visually greyed out/disabled

**Given** a template is disabled due to empty feed
**When** I view the template card
**Then** it displays a "Needs articles" badge explaining why it's unavailable

**Given** I am on the template selection step with an empty feed
**When** the gallery opens
**Then** an info banner at the top explains: "Some templates are unavailable until your feed has articles"

**Given** I am on the template selection step with an empty feed
**When** I view the default template
**Then** it is automatically selected and the preview shows a placeholder or sample rendering

**Given** I proceed with the default template on an empty feed
**When** my connection is created
**Then** I can return later via the message builder to change templates once articles are available (FR21)

**Given** I have an empty feed
**When** I click on a disabled template card
**Then** nothing happens (the click is ignored, no error shown)

### Story 2.4: Test Send and Completion

**As a** new user,
**I want** to send test articles to Discord and iterate on my template choice before finalizing,
**So that** I can verify my template looks good in Discord and know that delivery will happen automatically.

**Acceptance Criteria:**

**Given** I have selected a template in the connection creation flow
**When** I view the action buttons
**Then** I see "Send Test" (primary) and "Save" (secondary) as separate actions, plus "Skip" and "Customize manually"

**Given** I click "Send Test"
**When** the action is processing
**Then** the button shows a loading state with "Sending..." text and spinner

**Given** I click "Send Test"
**When** the test article is successfully sent to Discord
**Then** an inline success Alert appears below the preview (not a toast) confirming delivery, and the modal remains open

**Given** the test send succeeds
**When** I view the modal
**Then** I can still select a different template, change the preview article, and send another test

**Given** I have sent a test and want to try a different template
**When** I select a different template and click "Send Test" again
**Then** a new test is sent with the updated template

**Given** the test send fails
**When** I view the error state
**Then** an inline error Alert appears with a friendly message and a "Retry" button

**Given** the test send fails
**When** I want to try a different approach
**Then** I can select a different template or click "Customize manually" to access the full editor

**Given** I have sent one or more tests and am satisfied with the result
**When** I click "Save"
**Then** the connection is created with my selected template and the modal closes

**Given** I click "Save" without sending a test first
**When** the connection is created
**Then** it works normally (test send is optional, not required)

**Given** the connection is saved successfully
**When** I see the completion state
**Then** a confirmation message appears: "You're all set! New articles will be delivered automatically to #channel-name."

**Given** I want to skip template selection entirely
**When** I click "Skip"
**Then** the default template is applied, no test is sent, and the connection is created

**Given** I have an empty feed
**When** I view the action buttons
**Then** "Send Test" is disabled or hidden (can't test without articles), and "Save" is the primary action

---

## Epic 3: Existing User Template Access

Existing users can discover and apply templates to improve their existing connections without starting over.

### Story 3.1: Templates Button in Message Builder

**As an** existing user editing a connection,
**I want** to access the template gallery from the message builder,
**So that** I can discover and apply templates to improve my existing connection's formatting.

**Acceptance Criteria:**

**Given** I am on the message builder page for an existing connection
**When** I view the UI
**Then** I see a "Templates" button prominently placed (but not competing with primary actions)

**Given** I click the "Templates" button
**When** the action completes
**Then** the Template Gallery Modal opens with my feed's articles available for preview

**Given** the Template Gallery Modal opens from the message builder
**When** I view the templates
**Then** only templates compatible with my feed's available fields are enabled (same filtering as connection creation)

**Given** my existing connection already has a message configuration
**When** the gallery opens
**Then** no template is pre-selected (user is browsing, not editing current selection)

**Given** the Template Gallery Modal is open
**When** I click Cancel, X, or press ESC
**Then** the modal closes and my message builder form is unchanged

**Given** the Template Gallery Modal opens from the message builder
**When** I view the preview area
**Then** it shows two previews: "Current" (my existing message format) and "Template Preview" (the selected template, or empty state if none selected)

**Given** I select a template in the gallery
**When** the preview updates
**Then** I can visually compare my current format side-by-side with how the selected template would look

**Given** no template is selected yet
**When** I view the "Template Preview" section
**Then** it displays a prompt like "Select a template to compare"

**Given** I am browsing templates in the modal
**When** I want to see how a template looks with different content
**Then** I can use the article selector to change the preview sample data (both previews update)

### Story 3.2: Apply Template to Existing Connection

**As an** existing user,
**I want** to apply a template to my connection and have it populate the message builder form,
**So that** I can use a template as a starting point and further customize if needed.

**Acceptance Criteria:**

**Given** I have selected a template in the gallery (from message builder context)
**When** I click "Use this template" (primary action)
**Then** the modal closes and the message builder form fields are populated with the template's settings

**Given** I apply a template
**When** the form is populated
**Then** the template's messageComponent replaces my current messageComponent in the form state

**Given** I apply a template
**When** I view the message builder form
**Then** I can see the template settings in the form fields and modify them if desired (FR14)

**Given** I apply a template and make additional modifications
**When** I view the form
**Then** my modifications are preserved in the form state (template is a starting point, not locked)

**Given** I apply a template
**When** I view the message builder preview
**Then** it reflects the applied template (and any subsequent modifications I've made)

**Given** I apply a template
**When** the form is updated
**Then** the form is marked as having unsaved changes (dirty state)

**Given** I apply a template to my message builder form
**When** the existing "Changes won't be saved until you click Save" message and "Discard changes" functionality are present
**Then** they work correctly with template-applied changes (discard reverts to pre-template state)
