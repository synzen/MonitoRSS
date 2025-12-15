---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
status: 'complete'
completedAt: '2025-12-14'
inputDocuments:
  - docs/prd.md
  - docs/ux-design-specification.md
  - docs/index.md
  - docs/architecture-overview.md
  - docs/development-guide.md
  - docs/technology-stack.md
  - docs/source-tree-analysis.md
  - docs/analysis/research/technical-template-systems-research-2025-12-13.md
workflowType: 'architecture'
lastStep: 1
project_name: 'MonitoRSS-templates'
user_name: 'Admin'
date: '2025-12-14'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

The PRD defines 26 functional requirements across 7 categories:

| Category | FRs | Architectural Impact |
|----------|-----|---------------------|
| Template Gallery | FR1-FR6 | New UI component; preview rendering; state management |
| Connection Creation Flow | FR7-FR10 | Flow modification; step insertion; default handling |
| Message Builder Integration | FR11-FR16 | UI extension; form population; change tracking |
| Test Send | FR17-FR18 | Existing capability; messaging enhancement |
| Empty Feed Handling | FR19-FR21 | Conditional UI states; graceful degradation |
| Default Template | FR22-FR23 | Fallback configuration; storage |
| Accessibility | FR24-FR26 | Keyboard navigation; ARIA; focus management |

**Non-Functional Requirements:**

| NFR | Requirement | Architectural Driver |
|-----|-------------|---------------------|
| Performance | Gallery loads without blocking; single preview renders | Lazy loading; conditional rendering |
| Accessibility | WCAG 2.1 AA compliance | Semantic HTML; ARIA; focus management |
| Responsive | Mobile/tablet/desktop support; 44x44px touch targets | Chakra UI responsive props; adaptive layout |
| Integration | Reuse existing preview API and data structures | No new backend APIs for MVP |

**Scale & Complexity:**

- Primary domain: Frontend web application (React SPA)
- Complexity level: Low-Medium
- Estimated architectural components: 3-5 new React components

### Technical Constraints & Dependencies

**Must Reuse:**
- Existing Discord embed preview component
- Existing message builder form structure
- Existing connection creation flow
- Existing article selector component
- Chakra UI design system

**Must Integrate With:**
- MongoDB feed/connection data model
- Existing preview API endpoint
- Existing test send functionality

**Cannot Change:**
- Discord delivery infrastructure
- Backend feed processing logic
- Existing placeholder system

### Cross-Cutting Concerns Identified

1. **State Management** - Template selection state, preview data, form population
2. **Accessibility** - Keyboard navigation, screen reader support across all new components
3. **Responsive Design** - Consistent breakpoint behavior across gallery and preview
4. **Error Handling** - Inline feedback pattern, loading states, empty state handling
5. **Component Reuse** - Preview component integration, form field population

## Starter Template Evaluation

### Primary Technology Domain

**Brownfield Extension** - This feature extends an existing React 18 + Chakra UI application with established conventions.

### Starter Template Decision

**Decision:** No starter template required - integrating into existing codebase.

**Rationale:**
- MonitoRSS Control Panel has established architecture patterns
- Frontend stack is fixed: React 18, Chakra UI, Vite, TanStack Query
- Backend stack is fixed: NestJS, Fastify, MongoDB
- All tooling (TypeScript, Vitest, ESLint, Prettier) already configured
- Feature module pattern already established in `services/backend-api/client/src/features/`

### Architectural Decisions Already Made (Inherited)

**Language & Runtime:**
- TypeScript 5.x with strict mode
- Node.js 20.x runtime
- Vite 6.x build tooling

**UI Framework:**
- React 18 with functional components and hooks
- Chakra UI 2.x component library
- Framer Motion 5.x for animations

**State & Data:**
- TanStack Query 4.x for server state
- react-hook-form 7.x for form handling
- Yup for form validation

**Testing:**
- Vitest for unit testing
- Testing Library for component testing
- MSW for API mocking

### Integration Points for New Feature

New template gallery code will integrate at:

**Page-Level Integration:**
- `src/pages/MessageBuilder/` - Add "Templates" button, integrate gallery modal

**Feature-Level Integration:**
- `src/features/feedConnections/components/AddConnectionDialog/` - Add template selection step to connection creation flow
- `src/features/feedConnections/` - Extend hooks/types for template application

**Reusable Components:**
- `src/pages/MessageBuilder/DiscordMessagePreview.tsx` - Reuse for template preview
- `src/pages/MessageBuilder/ArticleSelectionDialog.tsx` - Reuse for preview article selection

**New Feature Module (if needed):**
- `src/features/templates/` - Template data types, API hooks (if templates are stored server-side)

## Core Architectural Decisions

### Decision Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Template Storage | Frontend constants | Small fixed set (4+); no backend changes for MVP; simplest implementation |
| Template Application | Direct form state mutation | Matches UX spec; "Discard changes" handles revert; follows existing form patterns |
| Preview Rendering | Reuse existing preview API | PRD NFR13 requirement; guarantees preview matches Discord output |
| Feed Capability Detection | Template-declared required fields | Explicit; easy to maintain; enables clear "why disabled" messaging |

### Decision Details

#### Template Storage Strategy

**Decision:** Templates defined as TypeScript constants in frontend code.

**Structure:**
```typescript
interface Template {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  requiredFields: string[];
  messageComponent: MessageComponentRoot;  // Supports both V1 (Legacy) and V2 formats
}
```

**Note:** Templates store full `MessageComponentRoot` structures, supporting both Legacy (V1) embed-based messages and V2 component-based messages. The `messageComponent.type` indicates the format (`ComponentType.LegacyRoot` or `ComponentType.V2Root`).

**Rationale:**
- PRD specifies 4+ pre-designed templates - small, fixed set
- No requirement for dynamic template management in MVP
- Templates update with normal deployments
- User-saved templates (Post-MVP Phase 2) would introduce backend storage

#### Template Application Strategy

**Decision:** Selecting a template directly mutates react-hook-form state.

**Behavior:**
- Template selection calls `form.setValue('messageComponent', template.messageComponent)`
- Previous `messageComponent` stored for "Discard changes" functionality
- Replaces entire message structure (may switch between V1 and V2 formats)

**Rationale:**
- UX spec: "Selecting a template populates the message builder form fields"
- Matches existing form manipulation patterns in codebase
- "Discard changes" provides safety net per UX requirements

#### Preview Rendering Strategy

**Decision:** Reuse existing preview API endpoint.

**Behavior:**
- Template selection triggers preview API call with template config
- Same endpoint used by message builder today
- Article selector determines which article provides preview data

**Rationale:**
- PRD NFR13: "Template preview reuses existing message preview API"
- Guarantees preview fidelity with actual Discord output
- No new backend endpoints required

#### Feed Capability Detection

**Decision:** Each template declares required fields; filter against available article fields.

**Implementation:**
```typescript
const compatibleTemplates = templates.filter(template =>
  template.requiredFields.every(field => articleFields.includes(field))
);
```

**Rationale:**
- Articles already fetched before gallery opens
- Explicit requirements are maintainable and debuggable
- Enables clear UX for why templates are disabled

### Deferred Decisions (Post-MVP)

| Decision | Defer Until | Reason |
|----------|-------------|--------|
| User template storage | Phase 2 | Requires backend API + MongoDB schema |
| Template sharing/marketplace | Phase 3 | Requires user content moderation |
| Template categories/filtering | Phase 2 | Not needed with 4 templates |

## Implementation Patterns & Consistency Rules

### Patterns Inherited from Existing Codebase

All new code must follow these established patterns extracted from the MonitoRSS Control Panel.

#### Naming Conventions

| Category | Convention | Example |
|----------|------------|---------|
| Components | PascalCase | `TemplateGalleryModal`, `TemplateCard` |
| Files | PascalCase for components | `TemplateGalleryModal/index.tsx` |
| Hooks | `use` + verb + noun | `useTemplateSelection`, `useApplyTemplate` |
| Types | PascalCase | `Template`, `TemplateCardProps` |
| Constants | SCREAMING_SNAKE_CASE for values | `DEFAULT_TEMPLATE_ID` |

#### Feature Module Structure

New template code follows existing feature module pattern:

```
src/features/templates/
├── components/
│   ├── index.ts
│   ├── TemplateGalleryModal/
│   │   └── index.tsx
│   ├── TemplateCard/
│   │   └── index.tsx
│   └── TemplatePreview/
│       └── index.tsx
├── constants/
│   ├── index.ts
│   └── templates.ts
├── types/
│   ├── index.ts
│   └── Template.ts
├── hooks/
│   ├── index.ts
│   └── useTemplateSelection.tsx
└── index.ts
```

#### Preview Component Architecture

Extract shared rendering logic to enable reuse between MessageBuilder and Template Gallery:

```
src/components/DiscordMessageDisplay/
└── index.tsx                    # Stateless renderer - props only, handles V1 and V2

src/pages/MessageBuilder/
└── MessageBuilderPreview.tsx    # Renamed from DiscordMessagePreview

src/features/templates/components/
└── TemplatePreview/
    └── index.tsx                # Uses DiscordMessageDisplay
```

**Component Responsibilities:**

| Component | Fetches Data? | Uses Context? | Renders UI? |
|-----------|---------------|---------------|-------------|
| `DiscordMessageDisplay` | No | No | Yes - handles both V1 embeds and V2 components |
| `MessageBuilderPreview` | Yes | Yes (form, connection) | No - delegates |
| `TemplatePreview` | Yes | Minimal (article only) | No - delegates |

**Preview Flow:**
1. Template selected → `template.messageComponent` passed to `convertMessageBuilderStateToConnectionPreviewInput()`
2. Preview API called with converted payload
3. `DiscordMessageDisplay` renders the result (handles both V1 and V2 formats)

#### Form Integration Pattern

Template application replaces entire message component:

```typescript
const applyTemplate = (template: Template, form: UseFormReturn) => {
  // Store previous state for "Discard changes"
  const previousState = form.getValues('messageComponent');

  // Apply template (replaces entire structure, may switch V1 ↔ V2)
  form.setValue('messageComponent', template.messageComponent);

  return previousState;  // For revert functionality
};
```

#### Modal Pattern

Follow existing Chakra Modal structure:
- `Modal` > `ModalOverlay` > `ModalContent`
- `ModalHeader` with title + `ModalCloseButton`
- `ModalBody` for gallery content
- `ModalFooter` with action buttons (Cancel left, Primary right)

#### Accessibility Pattern

Template selection uses radio button group pattern per UX spec:
- Visually hidden radio inputs
- Template cards as styled labels
- Arrow key navigation between options
- Focus indicators on keyboard navigation

#### Loading/Error Pattern

- Use existing `<InlineErrorAlert>` for errors
- Chakra `Skeleton` for loading states
- `isLoading` prop on buttons during async operations

### Enforcement Guidelines

**All new template gallery code MUST:**
1. Use existing Chakra UI components (no custom CSS except for template card states)
2. Follow react-hook-form patterns for form integration
3. Use TanStack Query for any data fetching
4. Include proper ARIA attributes for accessibility
5. Use existing `InlineErrorAlert` component for errors
6. Follow barrel export pattern (`index.ts` re-exports)
7. Support both V1 (Legacy) and V2 message formats in preview rendering

## Project Structure & Boundaries

### New Files for Template Gallery Feature

```
services/backend-api/client/src/
├── components/
│   └── DiscordMessageDisplay/
│       └── index.tsx                    # Stateless preview renderer (V1 + V2)
│
├── features/
│   └── templates/
│       ├── index.ts
│       ├── components/
│       │   ├── index.ts
│       │   ├── TemplateGalleryModal/
│       │   │   └── index.tsx
│       │   ├── TemplateCard/
│       │   │   └── index.tsx
│       │   └── TemplatePreview/
│       │       └── index.tsx
│       ├── constants/
│       │   ├── index.ts
│       │   └── templates.ts
│       ├── types/
│       │   ├── index.ts
│       │   └── Template.ts
│       └── hooks/
│           ├── index.ts
│           └── useTemplateSelection.tsx
│
└── pages/
    └── MessageBuilder/
        └── MessageBuilderPreview.tsx    # Renamed from DiscordMessagePreview.tsx
```

### Modified Existing Files

| File | Change |
|------|--------|
| `src/pages/MessageBuilder.tsx` | Add "Templates" button |
| `src/pages/MessageBuilder/DiscordMessagePreview.tsx` | Rename, refactor to use `DiscordMessageDisplay` |
| `src/features/feedConnections/components/AddConnectionDialog/*.tsx` | Add template selection step |

### Requirements to Structure Mapping

| Requirement Category | Location |
|---------------------|----------|
| FR1-FR6: Template Gallery | `src/features/templates/components/` |
| FR7-FR10: Connection Flow | `src/features/feedConnections/components/AddConnectionDialog/` |
| FR11-FR16: Message Builder | `src/pages/MessageBuilder/`, `src/features/templates/` |
| FR19-FR21: Empty Feed | `src/features/templates/components/TemplateGalleryModal/` |
| FR22-FR23: Default Template | `src/features/templates/constants/templates.ts` |
| FR24-FR26: Accessibility | All new components |

### Integration Boundaries

**Preview Data Flow:**
1. Template selected → `template.messageComponent`
2. Passed to `convertMessageBuilderStateToConnectionPreviewInput()`
3. Preview API called
4. `DiscordMessageDisplay` renders result

**Form Integration:**
- `TemplateGalleryModal` receives form context from parent
- Applies template via `form.setValue('messageComponent', template.messageComponent)`
- Parent stores previous state for "Discard changes"

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices work together without conflicts. Template storage as frontend constants integrates cleanly with React 18 and TypeScript. Form integration via `setValue` works with existing react-hook-form patterns. Preview rendering reuses established TanStack Query and API patterns.

**Pattern Consistency:**
Implementation patterns align with existing codebase conventions. Feature module structure, naming conventions, and component organization match established patterns in `src/features/feedConnections/`.

**Structure Alignment:**
Project structure supports all architectural decisions. New `src/features/templates/` follows existing feature module pattern. `DiscordMessageDisplay` extraction enables clean preview reuse.

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**
All 26 functional requirements across 7 categories are architecturally supported:
- Template Gallery (FR1-FR6): New feature module with gallery, card, and preview components
- Connection Flow (FR7-FR10): Integration into existing AddConnectionDialog
- Message Builder (FR11-FR16): Templates button and form integration
- Test Send (FR17-FR18): Uses existing functionality unchanged
- Empty Feed (FR19-FR21): Template filtering via requiredFields
- Default Template (FR22-FR23): Defined in templates.ts constants
- Accessibility (FR24-FR26): Radio button group pattern, ARIA, keyboard navigation

**Non-Functional Requirements Coverage:**
- Performance: Single preview rendering, TanStack Query caching
- Accessibility: WCAG 2.1 AA compliance via Chakra UI and semantic HTML
- Responsive: Chakra UI responsive props
- Integration: Reuses existing preview API, no new backend endpoints

### Implementation Readiness Validation ✅

**Decision Completeness:**
All critical decisions documented with versions and rationale. Template interface specified with full `MessageComponentRoot` support for V1 and V2 formats.

**Structure Completeness:**
Complete file structure defined. All new and modified files identified with specific locations and changes.

**Pattern Completeness:**
Naming, modal, form integration, and preview patterns fully specified with examples.

### Gap Analysis Results

**Critical Gaps:** None

**Important Gaps:**
- Actual template content (4+ templates) to be defined during implementation
- Test file locations follow existing Vitest patterns

**Nice-to-Have:**
- i18n keys for template strings
- Analytics events (post-MVP)

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed (Low-Medium)
- [x] Technical constraints identified (brownfield, existing patterns)
- [x] Cross-cutting concerns mapped (accessibility, V1/V2 support)

**✅ Architectural Decisions**
- [x] Template storage strategy decided
- [x] Template application strategy decided
- [x] Preview rendering strategy decided
- [x] Feed capability detection decided
- [x] V1/V2 format support clarified

**✅ Implementation Patterns**
- [x] Naming conventions established
- [x] Feature module structure defined
- [x] Preview component architecture specified
- [x] Form integration pattern documented
- [x] Accessibility pattern documented

**✅ Project Structure**
- [x] New files and directories defined
- [x] Modified files identified
- [x] Requirements mapped to structure
- [x] Integration boundaries documented

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Leverages existing patterns and components
- Minimal backend changes (frontend-only MVP)
- Clear V1/V2 format support
- Well-defined component architecture with clean separation

**Areas for Future Enhancement:**
- User-saved templates (Phase 2 - requires backend)
- Template sharing/marketplace (Phase 3)
- Template categories/filtering (Phase 2)

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED ✅
**Total Steps Completed:** 8
**Date Completed:** 2025-12-14
**Document Location:** docs/architecture.md

### Final Architecture Deliverables

**Complete Architecture Document**
- All architectural decisions documented with specific versions
- Implementation patterns ensuring AI agent consistency
- Complete project structure with all files and directories
- Requirements to architecture mapping
- Validation confirming coherence and completeness

**Implementation Ready Foundation**
- 4 core architectural decisions made (storage, application, preview, capability detection)
- 7 implementation patterns defined (naming, structure, preview, form, modal, accessibility, loading)
- 5 new component areas specified
- 26 functional requirements fully supported

**AI Agent Implementation Guide**
- Technology stack with verified versions (React 18, Chakra UI, TanStack Query, react-hook-form)
- Consistency rules that prevent implementation conflicts
- Project structure with clear boundaries
- Integration patterns and communication standards

### Implementation Handoff

**For AI Agents:**
This architecture document is your complete guide for implementing the Template Gallery feature. Follow all decisions, patterns, and structures exactly as documented.

**First Implementation Priority:**
1. Extract `DiscordMessageDisplay` component from existing `DiscordMessagePreview`
2. Create `src/features/templates/` feature module structure
3. Implement `Template` type and template constants

**Development Sequence:**
1. Extract shared `DiscordMessageDisplay` renderer
2. Rename `DiscordMessagePreview` to `MessageBuilderPreview`
3. Create template feature module with types and constants
4. Implement `TemplateCard` component
5. Implement `TemplatePreview` component
6. Implement `TemplateGalleryModal` component
7. Integrate into MessageBuilder page
8. Integrate into AddConnectionDialog flow

### Quality Assurance Checklist

**✅ Architecture Coherence**
- [x] All decisions work together without conflicts
- [x] Technology choices are compatible
- [x] Patterns support the architectural decisions
- [x] Structure aligns with all choices

**✅ Requirements Coverage**
- [x] All functional requirements are supported
- [x] All non-functional requirements are addressed
- [x] Cross-cutting concerns are handled (V1/V2 formats, accessibility)
- [x] Integration points are defined

**✅ Implementation Readiness**
- [x] Decisions are specific and actionable
- [x] Patterns prevent agent conflicts
- [x] Structure is complete and unambiguous
- [x] Examples are provided for clarity

---

**Architecture Status:** READY FOR IMPLEMENTATION ✅

**Next Phase:** Begin implementation using the architectural decisions and patterns documented herein.

**Document Maintenance:** Update this architecture when major technical decisions are made during implementation.

