---
project_name: 'MonitoRSS-templates'
user_name: 'Admin'
date: '2025-12-14'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules']
status: 'complete'
rule_count: 35
optimized_for_llm: true
---

# Project Context for AI Agents

_Critical rules and patterns for implementing code in the MonitoRSS Control Panel. Focus on unobvious details._

---

## Technology Stack & Versions

| Category | Technology | Version | Notes |
|----------|------------|---------|-------|
| Runtime | React | ^18.2.0 | Functional components only |
| Language | TypeScript | ^5.4.5 | Strict mode enabled |
| UI Framework | Chakra UI | ^2.7.0 | Primary component library |
| Build | Vite | ^6.1.1 | With SWC plugin |
| State | TanStack Query | ^4.16.1 | Server state management |
| Forms | react-hook-form | ^7.46.1 | With yup validation |
| Routing | react-router-dom | ^6.2.1 | - |
| Testing | Vitest | ^3.0.6 | With happy-dom |
| Mocking | MSW | ^2.7.1 | API mocking |

---

## Critical Implementation Rules

### TypeScript Rules

- **Strict mode is ON** - All code must pass strict type checking
- **Path aliases** - Use `@/*` for imports from `src/*` (e.g., `import { X } from '@/components'`)
- **No `any`** - Avoid `any` type; use `unknown` and narrow with type guards
- **Unused variables** - Prefix with `_` if intentionally unused (e.g., `_unusedParam`)

### React & Chakra UI Rules

- **Arrow function components ONLY** - ESLint enforces `namedComponents: "arrow-function"`
  ```typescript
  // Correct
  export const MyComponent: React.FC<Props> = ({ prop }) => { ... }

  // Wrong - will fail ESLint
  export function MyComponent({ prop }: Props) { ... }
  ```
- **No React import needed** - Using `react-jsx` transform
- **Chakra UI for all styling** - No custom CSS unless absolutely necessary
- **Use Chakra's responsive props** - `{{ base: 'sm', md: 'lg' }}` syntax

### Form Patterns

- **react-hook-form + yup** - Always use together
- **Controller for Chakra inputs** - Wrap complex inputs in `<Controller>`
- **Form mode: `all`** - Use `mode: "all"` for real-time validation
- **Inline errors** - Use `<FormErrorMessage>` and `<InlineErrorAlert>`

### State Management

- **TanStack Query for server state** - All API data fetching
- **Query key pattern** - Array format: `["resource-name", { params }]`
- **Keep previous data** - Use `keepPreviousData: true` for preview queries

### Component Organization

- **Feature modules** - `src/features/{featureName}/` with:
  - `components/` - UI components
  - `hooks/` - Custom hooks (`use{Name}.tsx`)
  - `api/` - API functions
  - `types/` - TypeScript types
  - `constants/` - Constants
  - `index.ts` - Barrel exports
- **Page components** - `src/pages/{PageName}/` can have co-located components
- **Shared components** - `src/components/` for truly shared UI

### Modal Pattern

```typescript
<Modal isOpen={isOpen} onClose={onClose} closeOnOverlayClick={!isSubmitting}>
  <ModalOverlay />
  <ModalContent>
    <ModalHeader>Title</ModalHeader>
    <ModalCloseButton />
    <ModalBody>...</ModalBody>
    <ModalFooter>
      <HStack>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button colorScheme="blue" isLoading={isSubmitting}>Save</Button>
      </HStack>
    </ModalFooter>
  </ModalContent>
</Modal>
```

### Testing Rules

- **Vitest with happy-dom** - Not jsdom
- **Testing Library** - Use `@testing-library/react`
- **MSW for API mocking** - Worker in `public/` directory
- **Test file naming** - `.test.tsx` or `.spec.tsx` co-located with source

### ESLint Rules (Enforced)

- **Newline before return** - Required blank line before `return`
- **Padding around blocks** - Blank lines before/after block statements
- **No unused imports** - Auto-removed on save
- **No prop spreading disabled** - `{...props}` is allowed
- **Import extensions** - Never include `.ts`/`.tsx` extensions

---

## Template Gallery Feature Rules

_Specific rules for the Template Gallery implementation (from architecture.md)_

### Template Interface

```typescript
interface Template {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  requiredFields: string[];
  messageComponent: MessageComponentRoot;  // V1 or V2 format
}
```

### V1 vs V2 Message Formats

- **V1 (Legacy)** - `ComponentType.LegacyRoot` with embeds, text content
- **V2 (Components)** - `ComponentType.V2Root` with Section, Container, MediaGallery
- **Templates can be either format** - Check `messageComponent.type`
- **Switching formats** - Selecting template replaces entire `messageComponent`

### Preview Component Architecture

- **`DiscordMessageDisplay`** - Stateless renderer (props only), handles V1 and V2
- **`MessageBuilderPreview`** - Smart wrapper for MessageBuilder page (uses context)
- **`TemplatePreview`** - Smart wrapper for template gallery (minimal context)

### Template Application

```typescript
// Apply template to form
form.setValue('messageComponent', template.messageComponent);

// Store previous for "Discard changes"
const previousState = form.getValues('messageComponent');
```

---

## Critical Don't-Miss Rules

### Anti-Patterns to Avoid

- **DON'T use function declarations for components** - Arrow functions only
- **DON'T add custom CSS** - Use Chakra UI props and theme
- **DON'T create new API endpoints** - MVP is frontend-only
- **DON'T use `useState` for server data** - Use TanStack Query
- **DON'T forget barrel exports** - Every folder needs `index.ts`

### Accessibility Requirements

- **WCAG 2.1 AA compliance** - Required for all new components
- **Keyboard navigation** - All interactive elements must be focusable
- **ARIA labels** - Use `aria-labelledby`, `aria-describedby` appropriately
- **Focus management** - Use `initialFocusRef` in modals
- **44x44px touch targets** - Minimum for mobile

### Error Handling

- **Use `<InlineErrorAlert>`** - Not toast notifications for form errors
- **`ApiAdapterError` type** - Use for API error handling
- **Skeleton loading** - Use Chakra `<Skeleton>` for loading states
