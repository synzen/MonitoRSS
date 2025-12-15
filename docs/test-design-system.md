# System-Level Test Design

**Date:** 2025-12-14
**Author:** Admin
**Status:** Draft
**Feature:** Template Gallery and Guided Onboarding

---

## Testability Assessment

### Controllability: PASS

**Can we control system state for testing?**

| Aspect | Assessment | Evidence |
|--------|------------|----------|
| API Seeding | ✅ Supported | NestJS backend with MongoDB/PostgreSQL enables direct data seeding via API or database fixtures |
| Factory Patterns | ✅ Available | Existing test files use factory patterns (e.g., `createUser`, `createProduct` equivalent structures) |
| Database Reset | ✅ Supported | MongoDB-memory-server used for isolated testing; PostgreSQL with MikroORM supports transactions for test isolation |
| Mock External Services | ✅ Supported | nock for HTTP mocking, MSW 2.x for frontend API mocking |

**Template Gallery Specific:**
- Templates stored as frontend constants → no database seeding required for template data
- Template application via `form.setValue()` → controlled via react-hook-form in tests
- Preview API reuses existing endpoint → existing mock patterns apply

### Observability: PASS

**Can we inspect system state?**

| Aspect | Assessment | Evidence |
|--------|------------|----------|
| Logging | ✅ Configured | @monitorss/logger custom package, winston in discord-rest-listener |
| Error Tracking | ✅ Configured | Sentry integration for frontend error monitoring |
| Feature Flags | ✅ Available | Split.io integration for feature flag governance |
| Test Results | ✅ Deterministic | Vitest (frontend) and Jest (backend) provide clear pass/fail with coverage reporting |

**Template Gallery Specific:**
- TanStack Query provides request/response inspection in dev tools
- Chakra UI components expose test-friendly data attributes
- Loading/error states explicitly managed via React state → observable in tests

### Reliability: PASS

**Are tests isolated and reproducible?**

| Aspect | Assessment | Evidence |
|--------|------------|----------|
| Test Isolation | ✅ Supported | Each test can use fresh MongoDB-memory-server instance or PostgreSQL transaction |
| Parallel Execution | ✅ Supported | Jest supports parallel workers; frontend tests use isolated component mounts |
| Deterministic Data | ✅ Achievable | Factory functions with faker generate unique test data |
| Component Isolation | ✅ Supported | Testing Library enables isolated component testing with MSW mocks |

**Template Gallery Specific:**
- Templates are static constants → no state pollution between tests
- Form integration via react-hook-form → can be reset per test
- Preview rendering reuses existing stateless component → deterministic output

---

## Architecturally Significant Requirements (ASRs)

### Quality Requirements with Risk Assessment

| ASR ID | Requirement | Category | Probability | Impact | Score | Mitigation |
|--------|-------------|----------|-------------|--------|-------|------------|
| ASR-001 | Template gallery UI loads without blocking connection flow (NFR1) | PERF | 2 | 2 | 4 | Lazy loading, conditional rendering for single preview |
| ASR-002 | Preview renders using actual feed article data (FR2) | TECH | 2 | 2 | 4 | Reuse existing preview API; graceful empty state handling |
| ASR-003 | Template gallery meets WCAG 2.1 AA compliance (NFR6) | BUS | 1 | 3 | 3 | Radio button group pattern with ARIA; Chakra UI accessibility |
| ASR-004 | All template selection operable via keyboard (NFR7) | BUS | 1 | 2 | 2 | Standard keyboard navigation; focus management |
| ASR-005 | Default template works with any feed (FR22) | TECH | 1 | 3 | 3 | Pure text template with no requiredFields; tested against edge cases |
| ASR-006 | Template application uses existing data structures (NFR14) | TECH | 1 | 2 | 2 | Leverage existing MessageComponentRoot type (V1/V2 support) |
| ASR-007 | Form dirty state tracks template changes (FR15, FR16) | BUS | 2 | 2 | 4 | react-hook-form dirty tracking; discard restores previous state |

### High-Priority ASRs (Score ≥6)

**None identified.** All quality requirements have manageable risk scores (4 or below).

### Key Quality Drivers

1. **Accessibility** (FR24-FR26, NFR6-NFR10): Critical for inclusive user experience
2. **Performance** (NFR1-NFR5): Template gallery must not degrade connection creation flow
3. **Integration** (NFR13-NFR15): Must work seamlessly with existing preview API and form infrastructure

---

## Test Levels Strategy

### Recommended Test Distribution

Based on the architecture (React 18 + Chakra UI frontend, no backend changes for MVP):

| Level | Percentage | Rationale |
|-------|------------|-----------|
| Unit | 40% | Business logic in template filtering, form integration utilities |
| Component | 40% | UI components (TemplateCard, TemplateGalleryModal, TemplatePreview) |
| E2E | 20% | Critical user journeys (connection creation with template, message builder integration) |

### Test Level Allocation by Functionality

| Functionality | Unit | Component | E2E | Justification |
|---------------|------|-----------|-----|---------------|
| Template filtering (requiredFields) | ✅ | - | - | Pure function logic |
| Template constants/types | ✅ | - | - | Type validation, structure checks |
| TemplateCard states | - | ✅ | - | UI states (hover, selected, disabled) |
| TemplateGalleryModal | - | ✅ | - | Modal behavior, grid layout |
| TemplatePreview rendering | - | ✅ | - | Preview display with mocked data |
| Keyboard navigation | - | ✅ | - | ARIA compliance, focus management |
| Connection flow integration | - | - | ✅ | Full user journey |
| Message builder integration | - | - | ✅ | Existing connection enhancement |
| Empty feed handling | - | ✅ | - | Conditional UI states |

### Test Tooling

| Level | Tool | Notes |
|-------|------|-------|
| Unit | Vitest 3.x | Already configured in client |
| Component | Testing Library + Vitest | Component isolation with MSW mocks |
| E2E | Playwright (recommended) | Not currently configured; recommend adding for MVP |

---

## NFR Testing Approach

### Performance (NFR1-NFR5)

| Approach | Tool | Threshold | Evidence |
|----------|------|-----------|----------|
| Gallery load time | Playwright (E2E) | < 200ms perceived load | Time-to-interactive measurement |
| Single preview render | Component test | Only selected template renders | Mock verification |
| Preview API response | MSW mock timing | Loading indicator appears/disappears | UI state verification |

**Test Examples:**
- Verify gallery opens without blocking connection flow (no full page freeze)
- Verify only selected template triggers preview API call
- Verify loading indicators during preview fetch

### Accessibility (NFR6-NFR10)

| Approach | Tool | Standard | Evidence |
|----------|------|----------|----------|
| WCAG 2.1 AA compliance | axe-core + Jest/Vitest | No critical violations | Automated accessibility assertions |
| Keyboard navigation | Component tests | Arrow key navigation works | Keyboard event simulation |
| Screen reader | Manual + ARIA checks | Announcements correct | ARIA attribute verification |
| Focus management | Component tests | Focus trapped in modal | Focus state assertions |

**Test Examples:**
- axe-core integration in component tests
- Keyboard navigation through template grid
- Focus returns to trigger button when modal closes
- ARIA labels and announcements verified

### Responsiveness (NFR11-NFR12)

| Approach | Tool | Breakpoints | Evidence |
|----------|------|-------------|----------|
| Responsive layout | Playwright viewport tests | Mobile (<768px), Tablet (768-1023px), Desktop (1024px+) | Screenshot comparison |
| Touch targets | Component tests | 44x44px minimum | Computed style assertions |

**Test Examples:**
- Gallery renders correctly at each breakpoint
- Modal is full-screen on mobile
- Touch targets meet size requirements

### Integration (NFR13-NFR15)

| Approach | Tool | Validation | Evidence |
|----------|------|------------|----------|
| Preview API reuse | Component test with MSW | Same endpoint, same response format | API call verification |
| Form data structure | Unit test | MessageComponentRoot compatibility | Type assertions |
| No backend changes | N/A | Frontend-only feature | Architecture constraint |

---

## Test Environment Requirements

### Local Development

| Component | Requirement |
|-----------|-------------|
| Node.js | 20.x |
| Frontend | Vite dev server with MSW mocks |
| Backend (if needed) | Docker Compose with MongoDB, PostgreSQL |

### CI Pipeline

| Stage | Tool | Purpose |
|-------|------|---------|
| Unit/Component | Vitest | Fast feedback on component logic |
| E2E | Playwright (if added) | Full journey validation |
| Accessibility | axe-core | WCAG compliance verification |
| Coverage | Vitest coverage | ≥80% for new template feature code |

### Recommended CI Configuration

```yaml
# Template Gallery Test Pipeline
test-template-gallery:
  stages:
    - unit-component:
        command: vitest run --reporter=verbose
        coverage: --coverage --coverage.threshold=80
    - accessibility:
        command: vitest run --reporter=verbose src/features/templates/**/*.a11y.test.ts
    - e2e (optional):
        command: playwright test tests/e2e/template-gallery/
```

---

## Testability Concerns

### None Critical

The architecture is well-suited for testing:

| Concern Type | Status | Notes |
|--------------|--------|-------|
| External dependencies | ✅ Mockable | Preview API reuses existing endpoint; MSW can mock |
| State management | ✅ Controllable | react-hook-form provides controlled form state |
| UI components | ✅ Testable | Chakra UI provides accessible, testable components |
| Async operations | ✅ Deterministic | TanStack Query with MSW enables deterministic async testing |

### Minor Considerations

1. **No E2E framework currently configured**: Recommend adding Playwright for comprehensive journey testing
2. **Preview fidelity**: Preview approximates Discord output; manual verification may be needed for pixel-perfect matching
3. **Empty feed edge case**: Ensure test data covers feeds with no articles

---

## Recommendations for Sprint 0

### Test Infrastructure Setup

1. **Configure Playwright** for E2E testing (connection creation flow, message builder integration)
2. **Add axe-core** integration to component tests for automated accessibility validation
3. **Establish test data factories** for template-related fixtures

### Critical Test Coverage (P0)

1. Template filtering logic (requiredFields matching)
2. TemplateCard accessibility (keyboard navigation, screen reader)
3. Connection flow with template selection (E2E)
4. Empty feed handling (default template only)

### Test Patterns to Follow

1. **Component tests**: Use Testing Library render with TanStack Query provider
2. **Form tests**: Use react-hook-form's FormProvider in test wrapper
3. **Accessibility tests**: Include axe-core assertions in component tests
4. **E2E tests**: Use Playwright with network interception for preview API

---

## Quality Gate Criteria

### For Implementation Readiness

- [ ] Test infrastructure configured (Vitest component tests working)
- [ ] Accessibility testing integrated (axe-core)
- [ ] Test patterns documented for template feature

### For Epic Completion

- [ ] Unit test coverage ≥80% for `src/features/templates/`
- [ ] Component test coverage for all TemplateCard states
- [ ] Accessibility tests passing (no axe-core violations)
- [ ] E2E test for connection flow with template selection (if Playwright added)
- [ ] All P0/P1 acceptance criteria have corresponding tests

---

## Related Documents

- **PRD**: docs/prd.md
- **Architecture**: docs/architecture.md
- **Epics**: docs/epics.md
- **UX Specification**: docs/ux-design-specification.md

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `.bmad/bmm/testarch/test-design` (System-Level Mode)
**Version**: 4.0 (BMad v6)
