# Story 2.4: Test Send and Completion

Status: ready-for-dev

## Dependencies

- **Epic 1 (Completed):** Template Gallery Foundation - All components from Epic 1 are implemented:
  - Story 1.1: `Template` interface, `TEMPLATES` array, `DEFAULT_TEMPLATE`
  - Story 1.2: `DiscordMessageDisplay` component
  - Story 1.3: `TemplateCard` with radio button integration
  - Story 1.4: `TemplateGalleryModal` component
  - Story 1.5: Accessibility features verified
- **Story 2.1 (Complete):** Template Selection Step in Connection Flow - provides step-based dialog architecture
- **Story 2.2 (Ready):** One-Click Template Application - provides template application logic
- **Story 2.3 (Ready):** Empty Feed Handling - provides empty feed detection and default template auto-selection

## Story

As a new user,
I want to send test articles to Discord and iterate on my template choice before finalizing,
So that I can verify my template looks good in Discord and know that delivery will happen automatically.

## Business Context

This story completes the "3 minute setup" experience for new users. After selecting a template (Epic 2, Stories 2.1-2.3), users can now **test** their choice before committing. The opt-out pattern ("Send Test" as primary action) encourages verification without blocking users who want to skip testing.

**Target Persona: Alex** - the community manager who wants to see the result in Discord before going live.

**Key UX Principles:**
- Test sending is **optional** but **encouraged** (opt-out pattern)
- Multiple test sends allowed - iterate until satisfied
- Inline feedback (Alert components) - no toasts
- Clear completion messaging about automatic delivery

## Acceptance Criteria

1. **Given** I have selected a template in the connection creation flow
   **When** I view the action buttons
   **Then** I see "Send Test" (primary) and "Save" (secondary) as separate actions, plus "Skip" and "Customize manually"

2. **Given** I click "Send Test"
   **When** the action is processing
   **Then** the button shows a loading state with "Sending..." text and spinner

3. **Given** I click "Send Test"
   **When** the test article is successfully sent to Discord
   **Then** an inline success Alert appears below the preview (not a toast) confirming delivery, and the modal remains open

4. **Given** the test send succeeds
   **When** I view the modal
   **Then** I can still select a different template, change the preview article, and send another test

5. **Given** I have sent a test and want to try a different template
   **When** I select a different template and click "Send Test" again
   **Then** a new test is sent with the updated template

6. **Given** the test send fails
   **When** I view the error state
   **Then** an inline error Alert appears with a friendly message and a "Retry" button

7. **Given** the test send fails
   **When** I want to try a different approach
   **Then** I can select a different template or click "Customize manually" to access the full editor

8. **Given** I have sent one or more tests and am satisfied with the result
   **When** I click "Save"
   **Then** the connection is created with my selected template and the modal closes

9. **Given** I click "Save" without sending a test first
   **When** the connection is created
   **Then** it works normally (test send is optional, not required)

10. **Given** the connection is saved successfully
    **When** I see the completion state
    **Then** a confirmation message appears: "You're all set! New articles will be delivered automatically to #channel-name."

11. **Given** I want to skip template selection entirely
    **When** I click "Skip"
    **Then** the default template is applied, no test is sent, and the connection is created

12. **Given** I have an empty feed
    **When** I view the action buttons
    **Then** "Send Test" is disabled or hidden (can't test without articles), and "Save" is the primary action

## Tasks / Subtasks

- [ ] **Task 1: Add Test Send Button to Template Gallery Modal** (AC: #1, #12)
  - [ ] Add `onTestSend` callback prop to `TemplateGalleryModal` interface
  - [ ] Add `isTestSendLoading` prop for loading state
  - [ ] Add `testSendResult` prop for success/error feedback
  - [ ] Render "Send Test" button as primary action when articles available
  - [ ] Render "Save" as secondary when test send available
  - [ ] Disable/hide "Send Test" when `articles.length === 0`
  - [ ] When empty feed, "Save" becomes primary action

- [ ] **Task 2: Implement Test Send Handler in Connection Dialog** (AC: #2, #3, #5)
  - [ ] Create test send handler function in `DiscordTextChannelConnectionDialogContent`
  - [ ] Use `useCreateConnectionTestArticle` hook for test send mutation
  - [ ] Handle the two-step process: create connection first (if needed), then send test
  - [ ] **CRITICAL:** Test send requires an existing connection - must create connection before test
  - [ ] Store `newConnectionId` after initial creation for subsequent test sends
  - [ ] Track test send loading state for button spinner
  - [ ] Send test using currently selected template and article

- [ ] **Task 3: Add Inline Feedback Display** (AC: #3, #6)
  - [ ] Add `testSendFeedback` state to track success/error messages
  - [ ] Display inline Alert below preview panel in TemplateGalleryModal
  - [ ] Success: `<Alert status="success">` with "Article sent to Discord successfully!"
  - [ ] Error: `<Alert status="error">` with error message and "Retry" button
  - [ ] Clear feedback when template or article selection changes
  - [ ] Use Chakra UI Alert component (not toasts)

- [ ] **Task 4: Support Multiple Test Sends (Iterate Flow)** (AC: #4, #5)
  - [ ] After successful test send, keep modal open
  - [ ] Allow template switching after test send
  - [ ] Allow article switching after test send
  - [ ] Track whether connection was already created for subsequent tests
  - [ ] Each new test send uses current template/article selection

- [ ] **Task 5: Implement Save Button Behavior** (AC: #8, #9, #10)
  - [ ] "Save" applies selected template and closes modal
  - [ ] If connection was already created (from test send), just apply template update and close
  - [ ] If connection not yet created, create with template and close
  - [ ] Display success message after save: "You're all set! New articles will be delivered automatically."
  - [ ] Include channel name in success message if available

- [ ] **Task 6: Handle Skip Flow** (AC: #11)
  - [ ] "Skip" applies DEFAULT_TEMPLATE (existing behavior from Story 2.2)
  - [ ] No test send triggered on skip
  - [ ] Creates connection immediately with default template
  - [ ] Closes modal after successful creation

- [ ] **Task 7: Handle Error States** (AC: #6, #7)
  - [ ] Display friendly error message for test send failures
  - [ ] Add "Retry" button in error Alert
  - [ ] Allow template/article change after error
  - [ ] Allow "Customize manually" escape hatch after error
  - [ ] Clear error state when user takes corrective action

- [ ] **Task 8: Update Button Hierarchy Layout** (AC: #1)
  - [ ] When articles available (can test):
    - "Customize manually" (tertiary/link) - left
    - "Skip" (tertiary) - center-left
    - "Save" (secondary/outline) - center-right
    - "Send Test" (primary/blue) - right
  - [ ] When no articles (empty feed):
    - "Customize manually" (tertiary/link) - left
    - "Skip" (secondary/outline) - center
    - "Save" (primary/blue) - right
  - [ ] Ensure proper spacing using HStack with `justifyContent="space-between"`

- [ ] **Task 9: Apply Changes to Forum and Webhook Dialogs** (AC: all)
  - [ ] Update `DiscordForumChannelConnectionDialogContent.tsx` with test send pattern
  - [ ] Update `DiscordApplicationWebhookConnectionDialogContent.tsx` with test send pattern
  - [ ] Ensure consistent UX across all connection types

- [ ] **Task 10: Write Tests** (AC: all)
  - [ ] Test "Send Test" button appears when articles available
  - [ ] Test "Send Test" is disabled/hidden for empty feeds
  - [ ] Test loading state during test send
  - [ ] Test success Alert appears after successful test
  - [ ] Test error Alert appears after failed test
  - [ ] Test can send multiple tests with different templates
  - [ ] Test "Save" creates connection without requiring test first
  - [ ] Test "Skip" creates connection with default template
  - [ ] Test button hierarchy layout

- [ ] **Task 11: Manual Testing and Verification** (AC: all)
  - [ ] Test complete flow: Select template → Send Test → Success → Save
  - [ ] Test iterate flow: Send Test → Change template → Send Test again → Save
  - [ ] Test error recovery: Send Test → Error → Change template → Send Test → Success
  - [ ] Test skip flow with no test send
  - [ ] Test empty feed flow (no Send Test button)
  - [ ] Verify inline Alerts display correctly
  - [ ] Verify success message with channel name

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

2. **Chakra UI for All Styling** - No custom CSS. Use Chakra's `Alert` component for inline feedback:
   ```typescript
   import { Alert, AlertIcon, AlertDescription, Button, HStack } from "@chakra-ui/react";

   // Success feedback
   <Alert status="success" mt={4} borderRadius="md">
     <AlertIcon />
     <AlertDescription>Article sent to Discord successfully!</AlertDescription>
   </Alert>

   // Error feedback with retry
   <Alert status="error" mt={4} borderRadius="md">
     <AlertIcon />
     <HStack justifyContent="space-between" flex={1}>
       <AlertDescription>Failed to send test article. Please try again.</AlertDescription>
       <Button size="sm" variant="outline" onClick={handleRetry}>Retry</Button>
     </HStack>
   </Alert>
   ```

3. **Path Aliases** - Use `@/*` for imports from `src/*`

4. **Inline Feedback Only** - Do NOT use toast notifications for test send results. Use inline Alert components.

5. **Test Send Requires Connection** - The test article API requires an existing `connectionId`. You MUST create the connection first before sending a test.

### Existing Hook Reference

**Test Send Hook (`useCreateConnectionTestArticle`):**
```typescript
// Location: src/features/feedConnections/hooks/useCreateConnectionTestArticle.tsx
interface CreateConnectionTestArticleInput {
  connectionType: FeedConnectionType;
  previewInput: CreateDiscordChannelConnectionPreviewInput;
}

export const useCreateConnectionTestArticle = () => {
  return useMutation<
    CreateConnectionTestArticleOutput,
    ApiAdapterError,
    CreateConnectionTestArticleInput
  >((details) => {
    const method = methodsByType[details.connectionType];
    return method(details.previewInput);
  });
};
```

**API Endpoint:**
```typescript
// Location: src/features/feedConnections/api/createDiscordChannelConnectionTestArticle.ts
// POST /api/v1/user-feeds/${feedId}/connections/discord-channels/${connectionId}/test
// Requires: feedId, connectionId, data.article.id
```

**Key Imports:**
```typescript
import { useCreateConnectionTestArticle } from "@/features/feedConnections/hooks";
import { FeedConnectionType } from "@/types";
```

### Two-Phase Connection Creation for Test Send

The test send API requires an existing connection. Implementation pattern:

```typescript
// State to track if connection was already created
const [createdConnectionId, setCreatedConnectionId] = useState<string | undefined>();

const handleTestSend = async () => {
  let connectionIdToUse = createdConnectionId;

  // If no connection exists yet, create it first
  if (!connectionIdToUse) {
    const createResult = await mutateAsync({
      feedId,
      details: {
        name,
        channelId: threadId || inputChannelId,
        threadCreationMethod: createThreadMethod === DiscordCreateChannelThreadMethod.New
          ? "new-thread"
          : undefined,
      },
    });

    connectionIdToUse = createResult?.result?.id;
    setCreatedConnectionId(connectionIdToUse);

    // Apply template to new connection
    if (connectionIdToUse) {
      const templateToApply = selectedTemplateId
        ? getTemplateById(selectedTemplateId) || DEFAULT_TEMPLATE
        : DEFAULT_TEMPLATE;
      const templateData = convertTemplateToUpdateDetails(templateToApply);

      await updateMutateAsync({
        feedId,
        connectionId: connectionIdToUse,
        details: templateData,
      });
    }
  }

  // Now send test article
  if (connectionIdToUse && selectedArticleId) {
    await testArticleMutation.mutateAsync({
      connectionType: FeedConnectionType.DiscordChannel,
      previewInput: {
        feedId,
        connectionId: connectionIdToUse,
        data: {
          article: { id: selectedArticleId },
        },
      },
    });
    // Show success feedback
    setTestSendFeedback({ status: "success", message: "Article sent to Discord successfully!" });
  }
};
```

### Button Layout Implementation

**With Articles (can test):**
```typescript
<ModalFooter>
  <HStack w="100%" justifyContent="space-between">
    <HStack>
      <Button variant="link" colorScheme="gray" onClick={onCustomizeManually}>
        Customize manually
      </Button>
      <Button variant="ghost" onClick={onSkip}>
        Skip
      </Button>
    </HStack>
    <HStack>
      <Button variant="outline" onClick={onSave} isLoading={isSaving}>
        Save
      </Button>
      <Button
        colorScheme="blue"
        onClick={onTestSend}
        isLoading={isTestSending}
        isDisabled={!selectedTemplateId || !selectedArticleId}
      >
        {isTestSending ? "Sending..." : "Send Test"}
      </Button>
    </HStack>
  </HStack>
</ModalFooter>
```

**Without Articles (empty feed):**
```typescript
<ModalFooter>
  <HStack w="100%" justifyContent="space-between">
    <Button variant="link" colorScheme="gray" onClick={onCustomizeManually}>
      Customize manually
    </Button>
    <HStack>
      <Button variant="outline" onClick={onSkip}>
        Skip
      </Button>
      <Button colorScheme="blue" onClick={onSave} isLoading={isSaving}>
        Save
      </Button>
    </HStack>
  </HStack>
</ModalFooter>
```

### TemplateGalleryModal Props Extension

Add these new props to `TemplateGalleryModalProps`:

```typescript
interface TemplateGalleryModalProps {
  // ... existing props ...

  // Test send functionality
  onTestSend?: () => void;
  isTestSendLoading?: boolean;
  testSendFeedback?: {
    status: "success" | "error";
    message: string;
  } | null;
  onClearTestFeedback?: () => void;
  hasArticles?: boolean;  // Determines if test send is available

  // Save action (separate from primary for test send flow)
  onSave?: () => void;
  isSaveLoading?: boolean;
}
```

### Inline Feedback Placement

Add feedback display in `TemplateGalleryModal` below the preview:

```typescript
// Inside ModalBody, after preview Box
{testSendFeedback && (
  <Box mt={4}>
    {testSendFeedback.status === "success" && (
      <Alert status="success" borderRadius="md">
        <AlertIcon />
        <AlertDescription>{testSendFeedback.message}</AlertDescription>
      </Alert>
    )}
    {testSendFeedback.status === "error" && (
      <Alert status="error" borderRadius="md">
        <AlertIcon />
        <HStack justifyContent="space-between" flex={1}>
          <AlertDescription>{testSendFeedback.message}</AlertDescription>
          <Button size="sm" variant="outline" onClick={onTestSend}>
            Retry
          </Button>
        </HStack>
      </Alert>
    )}
  </Box>
)}
```

### Clear Feedback on Selection Change

Clear test send feedback when user changes template or article:

```typescript
// In connection dialog
useEffect(() => {
  setTestSendFeedback(null);
}, [selectedTemplateId, selectedArticleId]);
```

### Success Message with Channel Name

After save, display confirmation with channel details:

```typescript
createSuccessAlert({
  title: "You're all set!",
  description: `New articles will be delivered automatically to ${channelName || "your channel"}.`,
});
```

### Files to Modify

```
services/backend-api/client/src/
├── features/
│   ├── feedConnections/components/AddConnectionDialog/
│   │   ├── DiscordTextChannelConnectionDialogContent.tsx    # Add test send logic
│   │   ├── DiscordForumChannelConnectionDialogContent.tsx   # Add test send pattern
│   │   └── DiscordApplicationWebhookConnectionDialogContent.tsx # Add test send pattern
│   └── templates/components/
│       └── TemplateGalleryModal/index.tsx  # Add test send props and feedback display
```

### Previous Story Intelligence (from 2.1, 2.2, 2.3)

**Patterns Established:**
- Step-based dialog with `ConnectionCreationStep` enum
- Template state management: `selectedTemplateId`, `selectedArticleId`
- Articles fetched via `useUserFeedArticles` hook with `disabled` flag
- Feed fields extracted: `Object.keys(articles[0]).filter(...)`
- Template applied via `convertTemplateToUpdateDetails` function
- Two-phase creation: create connection, then update with template

**Template Application Flow (working):**
1. Create connection with basic details
2. Get `newConnectionId` from result
3. Build template data via `convertTemplateToUpdateDetails`
4. Update connection with template data via `updateMutateAsync`

**Empty Feed Detection (from 2.3):**
- `isEmptyFeed = articles.length === 0`
- When empty, auto-select DEFAULT_TEMPLATE
- Disable non-default templates

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
- Test send button renders when articles available
- Test send button disabled/hidden for empty feed
- Test loading state displayed during test send
- Feedback Alert renders with correct status
- Clear feedback on selection change

**Integration Tests:**
- Full test send flow: create connection → send test → success feedback
- Multiple test sends with different templates
- Error handling and retry functionality
- Save without test send
- Skip flow
- Empty feed flow

**Mock Setup for Test Send:**
```typescript
// MSW handler for test article
rest.post('/api/v1/user-feeds/:feedId/connections/discord-channels/:connectionId/test', (req, res, ctx) => {
  return res(ctx.json({
    result: {
      status: "success",
      apiPayload: { /* ... */ },
    }
  }));
});

// Error case
rest.post('/api/v1/user-feeds/:feedId/connections/discord-channels/:connectionId/test', (req, res, ctx) => {
  return res(ctx.status(500), ctx.json({
    message: "Failed to send test article",
  }));
});
```

### Accessibility Considerations

1. **Loading State Announcement:**
   - Use `aria-busy="true"` on button during loading
   - Screen reader announces "Sending..." button text

2. **Feedback Announcement:**
   - Alert components have implicit role="alert"
   - Success/error messages announced immediately
   - Use aria-live="polite" for non-critical updates

3. **Focus Management:**
   - After test send completes, focus remains on button (don't shift focus)
   - After error, focus on retry button is acceptable
   - Modal focus trapping maintained throughout

4. **Button State Accessibility:**
   - Disabled "Send Test" button announced with `aria-disabled`
   - Loading button includes spinner and "Sending..." text

### Available Templates Reference

From `src/features/templates/constants/templates.ts`:

| Template | ID | requiredFields | Compatible with Empty Feed? |
|----------|-----|---------------|----------------------------|
| Simple Text | `simple-text` | `[]` | Yes (DEFAULT) |
| Rich Embed | `rich-embed` | `["description"]` | No |
| Compact Card | `compact-card` | `[]` | Yes |
| Media Gallery | `media-gallery` | `["image"]` | No |

### Project Structure Notes

- Files are in `services/backend-api/client/src/`
- Use `@/` path alias for imports from `src/`
- Components follow feature-based organization: `features/{featureName}/components/`
- Hooks are in `features/{featureName}/hooks/`

### References

- [Epics: Story 2.4] `_bmad-output/planning-artifacts/epics.md:502-558`
- [PRD: FR17] Test send after template selection
- [PRD: FR18] Test send optional messaging
- [UX: Button Hierarchy] docs/ux-design-specification.md:747-750
- [Project Context] `docs/project-context.md` (TypeScript rules, component patterns)
- [Story 2.1] `_bmad-output/implementation-artifacts/2-1-template-selection-step-in-connection-flow.md`
- [Story 2.2] `_bmad-output/implementation-artifacts/2-2-one-click-template-application.md`
- [Story 2.3] `_bmad-output/implementation-artifacts/2-3-empty-feed-handling.md`
- [Test Article Hook] `src/features/feedConnections/hooks/useCreateConnectionTestArticle.tsx`
- [Test Article API] `src/features/feedConnections/api/createDiscordChannelConnectionTestArticle.ts`

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
