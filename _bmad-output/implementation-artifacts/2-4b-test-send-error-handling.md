# Story 2.4b: Enhanced Test Send Error Handling in Template Gallery

Status: ready

## Agent Prompt

You are implementing enhanced error handling for the "Send to Discord" test functionality in the Template Gallery Modal. Currently, when the API returns a non-success status like `BAD_PAYLOAD` with HTTP 200, the UI incorrectly shows "Article sent to Discord successfully!" because it only checks for HTTP errors, not the `status` field in the response.

**Your task:** Implement a full-width error state panel that replaces the modal content when a test send fails, showing detailed error information consistent with the existing app pattern in `SendTestArticleContext.tsx`.

**Key files to reference:**
- `services/backend-api/client/src/contexts/SendTestArticleContext.tsx` - The existing pattern for handling all status types with `getMessageByStatus()` function
- `services/backend-api/client/src/features/templates/components/TemplateGalleryModal/index.tsx` - The modal to modify
- `services/backend-api/client/src/features/feedConnections/hooks/useTestSendFlow.tsx` - The hook that calls the API
- `services/backend-api/client/src/features/templates/types/TestSendFeedback.ts` - Type to extend
- `services/backend-api/client/src/types/SendTestArticleResult.ts` - Status enums and result schema

**Critical constraints:**
- Arrow function components only (ESLint enforced)
- Chakra UI for all styling
- Use `@/*` path aliases
- Follow existing patterns in the codebase

## Dependencies

- Story 2.4 (Complete): Test Send and Completion - provides the test send infrastructure

## Story

As a user testing a template in the Template Gallery,
I want to see detailed error information when my test send fails,
So that I can understand what went wrong and make an informed decision about whether to use the template anyway.

## Business Context

The Template Gallery is part of the "3 minute setup" experience. When users test templates, they need clear feedback about failures—especially for `BAD_PAYLOAD` errors caused by missing placeholder content. The existing app handles this well in `SendTestArticleContext.tsx`, but the Template Gallery currently only shows a generic success/error message.

**Key UX Decision:** When an error occurs, the modal content is replaced with a full-width error panel (not a modal-on-modal). This is a state change within the same container, providing full real estate for technical details.

**Important Warning:** Users must be informed that using a template with errors may cause their connection to be disabled when real articles fail to send.

## Acceptance Criteria

1. **Given** the test send returns a non-success status (e.g., `BAD_PAYLOAD`, `MISSING_CHANNEL`, etc.)
   **When** I view the Template Gallery Modal
   **Then** the modal content is replaced with a full-width error panel

2. **Given** I see the error panel
   **When** I look at the content
   **Then** I see:
   - Error headline with icon (❌ Test Failed - Discord Couldn't Process This Message)
   - User-friendly explanation of what went wrong
   - Collapsible "Technical Details" section with API request payload and Discord's response
   - Warning about connection disabling risk
   - "Try Another Template" and "Use Anyway - I understand" action buttons
   - The modal footer (Back/Skip/Save) is hidden to reduce button clutter
   - The modal's standard [X] close button remains for dismissal

3. **Given** the error panel is showing
   **When** I click "Try Another Template"
   **Then** the error panel is dismissed and I return to the template gallery view

4. **Given** the error panel is showing
   **When** I click "Use Anyway - I understand"
   **Then** the template is saved despite the error (same as clicking Save)

5. **Given** the error panel is showing
   **When** I click the modal's [X] close button
   **Then** the entire modal is closed (standard modal behavior)

6. **Given** a test send succeeds (status === "SUCCESS")
   **When** I view the feedback
   **Then** I see the existing inline success Alert (no change to success flow)

7. **Given** the error panel has focus
   **When** I use keyboard navigation
   **Then** Tab cycles through interactive elements and Escape closes the modal (standard modal behavior)

8. **Given** a screen reader user views the error panel
   **When** the panel appears
   **Then** it is announced as an alert dialog with proper ARIA attributes

## Technical Design

### 1. Extend TestSendFeedback Type

```typescript
// services/backend-api/client/src/features/templates/types/TestSendFeedback.ts
import { SendTestArticleDeliveryStatus } from "@/types";

export interface TestSendFeedback {
  status: "success" | "error";
  message: string;
  // New fields for detailed error display:
  deliveryStatus?: SendTestArticleDeliveryStatus;
  apiPayload?: Record<string, unknown>;
  apiResponse?: Record<string, unknown>;
}
```

### 2. Update useTestSendFlow Hook

Modify `handleTestSend` to properly check `result.status` and populate the extended feedback:

```typescript
// In useTestSendFlow.tsx handleTestSend callback
const result = await sendTestArticleDirectMutation.mutateAsync({...});

// Check the actual delivery status, not just HTTP success
if (result.result.status === SendTestArticleDeliveryStatus.Success) {
  setTestSendFeedback({
    status: "success",
    message: "Article sent to Discord successfully!",
  });
} else {
  // Map status to user-friendly message (reuse pattern from SendTestArticleContext)
  const errorMessage = getErrorMessageByStatus(result.result.status);
  setTestSendFeedback({
    status: "error",
    message: errorMessage,
    deliveryStatus: result.result.status,
    apiPayload: result.result.apiPayload,
    apiResponse: result.result.apiResponse,
  });
}
```

### 3. Create TestSendErrorPanel Component

New component: `services/backend-api/client/src/features/templates/components/TestSendErrorPanel/index.tsx`

```typescript
interface TestSendErrorPanelProps {
  feedback: TestSendFeedback;
  onTryAnother: () => void;    // Returns to gallery view
  onUseAnyway: () => void;     // Saves despite error
  isUseAnywayLoading?: boolean;
}
```

Key features:
- `role="region"` with `aria-labelledby` pointing to heading (not alertdialog since we're inside a modal already)
- Side-by-side layout for apiPayload and apiResponse using Chakra Grid
- Collapsible technical details (collapsed by default) using Chakra Collapse
- Warning callout using Chakra Alert with `status="warning"`
- **NO dismiss [X] button** - the modal's standard close button handles dismissal
- **NO focus trap** - the parent modal already provides focus management
- **NO Escape handler** - the parent modal already handles Escape key

### 4. Update TemplateGalleryModal

Conditional rendering based on error state. **Key UX improvement:** Hide the modal footer when error panel is showing to reduce button clutter (from 7+ buttons to 4):

```typescript
const isShowingErrorPanel = testSendFeedback?.status === "error" && testSendFeedback.deliveryStatus;

<ModalBody>
  {isShowingErrorPanel ? (
    <TestSendErrorPanel
      feedback={testSendFeedback}
      onTryAnother={handleClearFeedback}  // Returns to gallery
      onUseAnyway={handleSave}            // Same as Save button
      isUseAnywayLoading={isSaveLoading}
    />
  ) : (
    // Existing template grid + preview layout
    <Grid templateColumns={{ base: "1fr", lg: "1fr 400px" }} gap={6}>
      ...
    </Grid>
  )}
</ModalBody>

{/* Hide footer when error panel is showing - error panel has its own action buttons */}
{!isShowingErrorPanel && (
  <ModalFooter>
    ...
  </ModalFooter>
)}
```

### 5. Error Messages by Status

Reuse the translation keys from SendTestArticleContext:

| Status | User-Friendly Message |
|--------|----------------------|
| `BAD_PAYLOAD` | "Discord couldn't process this message. The template may have placeholders that couldn't be filled with the article's data." |
| `MISSING_CHANNEL` | "The Discord channel could not be found. It may have been deleted." |
| `MISSING_APPLICATION_PERMISSION` | "The bot doesn't have permission to send messages to this channel." |
| `TOO_MANY_REQUESTS` | "Discord is rate limiting requests. Please wait a moment and try again." |
| `THIRD_PARTY_INTERNAL_ERROR` | "Discord encountered an internal error. Please try again later." |
| Default | "Failed to send test article. Please try again." |

### 6. Warning Text

```
⚠️ Using this template may disable your connection

If an article fails to send due to this error, the connection will be
automatically disabled to prevent repeated failures.
```

## Tasks

### Frontend Tasks

- [ ] **Task 1: Extend TestSendFeedback Type**
  - [ ] Add `deliveryStatus`, `apiPayload`, `apiResponse` fields
  - [ ] Import `SendTestArticleDeliveryStatus` enum

- [ ] **Task 2: Update useTestSendFlow Hook**
  - [ ] Import `SendTestArticleDeliveryStatus` from `@/types`
  - [ ] Check `result.result.status` instead of assuming success
  - [ ] Populate extended feedback fields on error
  - [ ] Add helper function `getErrorMessageByStatus()` (can extract from SendTestArticleContext pattern)

- [ ] **Task 3: Create TestSendErrorPanel Component**
  - [ ] Create `features/templates/components/TestSendErrorPanel/index.tsx`
  - [ ] Implement full-width error panel layout
  - [ ] Add collapsible "Technical Details" section with side-by-side API payload/response (collapsed by default)
  - [ ] Add warning callout about connection disabling
  - [ ] Add "Try Another Template" and "Use Anyway - I understand" buttons (NO dismiss [X] - modal handles that)
  - [ ] Implement ARIA attributes (`role="region"`, `aria-labelledby` - NOT alertdialog since inside modal)
  - [ ] Export from `features/templates/components/index.ts`

- [ ] **Task 4: Update TemplateGalleryModal**
  - [ ] Import TestSendErrorPanel
  - [ ] Add conditional rendering for error state
  - [ ] Hide ModalFooter when error panel is showing (reduces buttons from 7+ to 4)
  - [ ] Wire up `onClearTestSendFeedback` to "Try Another Template" button
  - [ ] Wire up `onSave` to "Use Anyway" button

- [ ] **Task 5: Write Unit Tests for TestSendErrorPanel**
  - [ ] Test renders error headline with icon
  - [ ] Test renders user-friendly message
  - [ ] Test renders API payload and response in collapsible section
  - [ ] Test collapsible section is collapsed by default
  - [ ] Test renders warning callout
  - [ ] Test "Try Another Template" calls onTryAnother
  - [ ] Test "Use Anyway - I understand" calls onUseAnyway
  - [ ] Test has correct ARIA attributes (role="region", aria-labelledby)

- [ ] **Task 6: Write Unit Tests for useTestSendFlow Changes**
  - [ ] Test SUCCESS status sets success feedback
  - [ ] Test BAD_PAYLOAD status sets error feedback with details
  - [ ] Test MISSING_CHANNEL status sets appropriate error
  - [ ] Test feedback includes apiPayload and apiResponse when present

- [ ] **Task 7: Update TemplateGalleryModal Tests**
  - [ ] Test error panel renders when testSendFeedback has deliveryStatus
  - [ ] Test error panel does NOT render for success feedback
  - [ ] Test ModalFooter is hidden when error panel is showing
  - [ ] Test "Try Another Template" clears feedback and shows gallery
  - [ ] Test "Use Anyway" triggers save flow

## Files to Create/Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `features/templates/types/TestSendFeedback.ts` | Modify | Add deliveryStatus, apiPayload, apiResponse fields |
| `features/templates/types/index.ts` | Modify | Re-export if needed |
| `features/feedConnections/hooks/useTestSendFlow.tsx` | Modify | Check result.status, populate extended feedback |
| `features/templates/components/TestSendErrorPanel/index.tsx` | Create | New error panel component |
| `features/templates/components/TestSendErrorPanel/TestSendErrorPanel.test.tsx` | Create | Unit tests |
| `features/templates/components/index.ts` | Modify | Export TestSendErrorPanel |
| `features/templates/components/TemplateGalleryModal/index.tsx` | Modify | Conditional render error panel |
| `features/templates/components/TemplateGalleryModal/TemplateGalleryModal.test.tsx` | Modify | Add error panel tests |

## Visual Design Reference

### Error Panel Layout (Simplified - 4 interactive elements)

The error panel replaces modal body content and hides the footer. Only 4 interactive elements remain:
1. Modal [X] close button (standard)
2. Technical Details toggle (collapsed by default)
3. "Try Another Template" button
4. "Use Anyway - I understand" button

```
┌─ Choose a Template ───────────────────────────────────────────────────[X]┐
│                                                                          │
│  ❌  Test Failed - Discord Couldn't Process This Message                 │
│                                                                          │
│  The template has placeholders that couldn't be filled with the test     │
│  article's data.                                                         │
│                                                                          │
│  ▶ Technical Details (collapsed by default)                              │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ ⚠️  Using this template may disable your connection.              │  │
│  │     If an article fails to send, the connection will be           │  │
│  │     automatically disabled to prevent repeated failures.          │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│          [ ← Try Another Template ]    [ Use Anyway - I understand ]     │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────── │
│                        (Footer hidden during error state)                │
└──────────────────────────────────────────────────────────────────────────┘
```

When "Technical Details" is expanded:
```
│  ▼ Technical Details                                                     │
│  ┌─────────────────────────────────┐  ┌────────────────────────────────┐ │
│  │ Request Sent to Discord         │  │ Discord's Response             │ │
│  │ ─────────────────────────────── │  │ ────────────────────────────── │ │
│  │ {                               │  │ {                              │ │
│  │   "content": "",                │  │   "code": 50006,               │ │
│  │   "embeds": [...]               │  │   "message": "Cannot send..."  │ │
│  │ }                               │  │ }                              │ │
│  └─────────────────────────────────┘  └────────────────────────────────┘ │
```

## Accessibility Requirements

1. **ARIA Attributes:**
   - `role="region"` on the error panel container (not alertdialog - we're inside a modal)
   - `aria-labelledby` pointing to the heading ID
   - `aria-describedby` pointing to the description text

2. **Focus Management:**
   - When error panel appears, focus moves to the heading
   - Parent modal handles focus trapping (no custom trap needed)
   - When modal closes, focus returns per standard modal behavior

3. **Keyboard Navigation:**
   - Tab cycles through: Technical Details toggle → Try Another → Use Anyway
   - Escape closes the modal (standard modal behavior)
   - Enter/Space activates buttons

4. **Screen Reader Announcements:**
   - Error panel heading is focused and announced when it appears
   - All text content is accessible
   - Button purposes are clear

## Dev Notes

### Reuse Existing Patterns

The `SendTestArticleContext.tsx` file already has:
- `getMessageByStatus()` function mapping status to messages
- Modal-based error display with apiPayload/apiResponse
- Translation keys for all error messages

Consider extracting `getMessageByStatus()` to a shared utility or duplicating the logic for the Template Gallery context.

### Translation Keys Available

```
features.feedConnections.components.sendTestArticleButton.alertTitleFailure
features.feedConnections.components.sendTestArticleButton.alertDescriptionBadPayload
features.feedConnections.components.sendTestArticleButton.alertDescriptionMissingChannel
features.feedConnections.components.sendTestArticleButton.alertDescriptionMissingApplicationPermission
features.feedConnections.components.sendTestArticleButton.alertDescriptionTooManyRequests
features.feedConnections.components.sendTestArticleButton.alertDescriptionThirdPartyInternalError
features.feedConnections.components.sendTestArticleButton.apiPayload
features.feedConnections.components.sendTestArticleButton.apiResponse
```

## References

- [Story 2.4] `_bmad-output/implementation-artifacts/2-4-test-send-and-completion.md`
- [SendTestArticleContext] `services/backend-api/client/src/contexts/SendTestArticleContext.tsx`
- [SendTestArticleResult Types] `services/backend-api/client/src/types/SendTestArticleResult.ts`
- [UX Design Discussion] Documented in conversation with UX Designer agent
