---
stepsCompleted: [1, 2, 3, 4, 7, 8, 9, 10, 11]
inputDocuments:
  - docs/analysis/research/technical-template-systems-research-2025-12-13.md
  - docs/index.md
  - docs/architecture-overview.md
  - docs/development-guide.md
  - docs/technology-stack.md
  - docs/source-tree-analysis.md
documentCounts:
  briefs: 0
  research: 1
  brainstorming: 0
  projectDocs: 5
workflowType: 'prd'
lastStep: 11
project_name: 'MonitoRSS-templates'
user_name: 'Admin'
date: '2025-12-13'
---

# Product Requirements Document - MonitoRSS-templates

**Author:** Admin
**Date:** 2025-12-13

## Executive Summary

MonitoRSS provides powerful RSS-to-Discord delivery with deep customization options for message formatting. However, this flexibility creates onboarding friction - users report not fully understanding how to use the app, needing others to configure it for them, and struggling with message customization.

This PRD defines a **Template Gallery and Guided Onboarding** feature that allows users to select pre-designed message templates immediately after adding a feed. The goal is click-and-forget simplicity: users pick a template that looks good, and they're done - no placeholder syntax, no embed configuration, no learning curve.

Additionally, power users can save their own templates for reuse across feeds, reducing repetitive setup work.

### What Makes This Special

The key insight is that **power creates friction**. The current system's deep customization is overwhelming new users before they see value. This feature inverts the experience:

- **Before:** "Here are all the options, figure it out"
- **After:** "Pick what looks good, you're done"

Users will be able to add a feed, select a professional-looking template, and be delivering to Discord in under a minute - without reading documentation or understanding the underlying placeholder system.

## Project Classification

**Technical Type:** web_app
**Domain:** general
**Complexity:** low
**Project Context:** Brownfield - extending existing MonitoRSS system

This is a UX enhancement that builds on top of the existing placeholder and embed system. Templates are pre-configured message/embed settings that users can apply with a single click. The feature integrates into the existing feed creation and connection flow, respecting current architecture patterns (React/Chakra UI frontend, NestJS backend, MongoDB for data).

## Success Criteria

### User Success

- Users complete template selection in **one click** from a visual grid of previews
- New users go from "added a connection" to "seeing a beautifully formatted message in Discord" with minimal friction
- Users who skip template selection still get a sensible default (no broken experience)
- Optional test send lets users see immediate results without waiting for the next article

### Business Success

- **+10% revenue** driven by improved onboarding → retention → premium conversion
- Increased platform adoption from reduced onboarding friction
- Reduction in Discord community questions about message customization

### Technical Success

- Template preview rendering is **instant** (no loading delays in gallery)
- Minimum **4 pre-designed templates** available at launch
- User-saved templates capped at **100 per user**
- Graceful handling of template/feed mismatches (e.g., template expects `{author}` but feed lacks author data)

### Measurable Outcomes

| Metric | Target |
|--------|--------|
| New users completing template selection flow | 75%+ |
| Revenue increase | +10% |
| Discord community support questions (formatting) | Significant reduction |
| Template gallery load time | Instant (<200ms) |

## Product Scope

### MVP - Minimum Viable Product

- Template gallery with 4+ pre-designed templates
- Visual grid preview for template selection
- One-click apply after adding a connection
- Default template for users who skip selection
- Optional test send to Discord after template selection

### Growth Features (Post-MVP)

- Save your own templates (up to 100 per user)
- Expanded library of pre-designed templates
- Template categories/filtering

### Vision (Future)

- Community template sharing/marketplace
- AI-generated templates based on feed content
- Smart template recommendations based on feed type

## User Journeys

### Journey 1: Alex Chen - The Community Manager Who Just Wants It To Look Good

Alex runs a gaming community Discord server with 5,000 members. Their team just launched a new blog on their website, and Alex wants every new post to automatically appear in the #announcements channel - looking professional, not like a raw URL dump.

Alex finds MonitoRSS through a Google search and connects it to their Discord. They add their blog's RSS feed, then start creating a connection to #announcements. As part of the setup, a template gallery appears: "Choose how your articles will look."

Alex sees four options - a clean minimal card, a rich embed with thumbnail, a compact news ticker style, and a bold announcement format. Each shows a realistic preview of what the message would look like in Discord. Alex clicks the "Rich Embed" template because it matches their server's aesthetic. One click.

A prompt asks: "Want to send a test article to preview how it looks? After this, new articles will be delivered automatically." Alex clicks yes. The connection is created, and ten seconds later, their latest blog post appears in #announcements - thumbnail, title, description, and a clean "Read more" link. It looks *exactly* like the preview.

A confirmation message appears: "You're all set! New articles from your feed will now be delivered automatically to #announcements."

Alex thinks "wait, that's it?" They'd budgeted an hour for this. It took three minutes. Over the next week, new blog posts appear in #announcements automatically - Alex doesn't lift a finger. Their community starts engaging with the automated posts without ever knowing Alex didn't hand-craft each one.

### Journey 2: Sam Rivera - The Existing User Who Finds a Shortcut

Sam has been using MonitoRSS for six months to post tech news to their Discord server. The messages work, but they've always looked plain - just the default format. Sam finally has time to make them look nicer and opens the message builder, expecting to spend 30 minutes figuring out placeholders and embed fields.

At the top of the message builder, Sam notices a "Templates" button they hadn't seen before (or hadn't paid attention to). Curious, they click it and a message appears: "Selecting a template will preview changes but won't overwrite your current settings until you save." Feeling safe, they browse the gallery and click a template that looks good.

The message builder populates with the template's settings. Sam sees exactly what fields were filled in and could tweak them if needed - but it already looks good. They could still click "Discard changes" to restore their original configuration, or save to apply the new template. They save, send a test article, and they're done in 2 minutes instead of 30.

### Journey 3: Jordan Park - The Power User Who Wants Consistency (Post-MVP)

Jordan manages RSS feeds for three different Discord servers - a gaming community, a tech news hub, and a crypto alerts channel. Across these servers, Jordan has over 200 feeds configured. Each server has a distinct visual style, and Jordan has spent time perfecting the message format for each.

When setting up a new feed for the gaming server, Jordan thinks "I wish I could just reuse the format I already built." In the message builder, they notice a "Save as Template" option. They click it, name it "Gaming Server - Announcements," and save.

Next week, when adding another feed to the same server, Jordan opens the template gallery and sees their saved template alongside the pre-designed ones. One click, and the new connection matches the others perfectly. No manual recreation needed.

But Jordan also has 50 existing feeds on the gaming server still using inconsistent formats from before templates existed. Rather than updating each one manually, Jordan wants to apply their saved template across multiple connections at once.

Over time, Jordan builds a small library of personal templates - one for each server style, one for alerts, one for long-form content. Setting up new feeds goes from a 10-minute task to a 30-second task, and maintaining consistency across hundreds of feeds becomes manageable.

### Journey Requirements Summary

| Journey | Key Requirements |
|---------|------------------|
| New User (Alex) | Template selection as part of connection creation flow; connection only goes live after template step; visual previews matching Discord output; one-click application; optional test send; clear messaging that delivery is automatic |
| Existing User (Sam) | Templates accessible from message builder UI; explicit messaging that selection is preview-only until save; discard changes option; template pre-fills existing form fields |
| Power User (Jordan) - Post-MVP | Save as Template option; personal template library (up to 100); user templates in gallery alongside system templates; bulk template application to multiple connections; scales for users with hundreds of feeds |

## Web App Specific Requirements

### Project-Type Overview

This feature extends an existing React 18 + Chakra UI single-page application. The template gallery integrates into the existing connection creation flow and message builder UI, reusing existing preview infrastructure.

### Technical Architecture Considerations

**Preview Rendering**
- Reuse existing message preview component and API
- Preview renders based on user-selected article from feed (defaults to latest article)
- Article selection change triggers network request to fetch updated preview
- Loading indicators shown during preview fetch

**Empty Feed Handling**
- Default template shown as only selectable option (safe - pure text, never fails)
- Other templates greyed out with message: "No articles available yet - check back after your feed has articles"
- User can proceed with default and return later via message builder

### Accessibility Requirements

- Full keyboard navigation for template gallery grid
- Screen reader support with ARIA labels for template selection
- Focus management when opening/closing template gallery
- Accessible loading states during preview fetch

### Responsive Design

- Template gallery must work well on mobile devices
- Responsive grid layout adapting to screen size
- Touch-friendly template selection targets

### Performance Targets

- Template gallery loads without blocking connection creation flow
- Preview fetch triggered immediately on article/template change
- Loading indicators provide feedback during network requests
- No perceived lag in UI interactions (selection, navigation)

### Implementation Considerations

**Reusable Components**
- Existing message preview component reused for template previews
- Existing article selector reused for preview article selection

**Integration Points**
- Connection creation flow: Template selection step added before connection goes live
- Message builder UI: Templates button added for existing connections
- Preview API: Existing endpoint reused with template configuration

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Experience MVP - Deliver the key user experience (frictionless onboarding) with minimal but polished functionality.

**Core Principle:** Solve the onboarding friction problem completely for the primary use case before expanding.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- New User (Alex): Complete guided template selection during connection creation
- Existing User (Sam): Template access via message builder for existing connections

**Must-Have Capabilities:**
- Template gallery with 4+ pre-designed templates
- Visual grid preview with realistic Discord output approximation
- One-click template application
- Template selection as part of connection creation flow (connection only goes live after)
- Default template for users who skip (safe, pure text - never fails)
- Templates accessible from message builder UI for existing connections
- Explicit messaging: "Changes won't be saved until you click Save"
- Discard changes option to restore previous configuration
- Optional test send with clear messaging about automatic delivery
- Empty feed handling: default template selectable, others greyed out
- Full accessibility (keyboard navigation, screen reader support)
- Mobile-responsive template gallery

### Post-MVP Features

**Phase 2 (Growth):**
- Save your own templates (up to 100 per user)
- User templates appear in gallery alongside system templates
- Expanded library of pre-designed templates
- Template categories/filtering
- Bulk template application to multiple connections

**Phase 3 (Vision):**
- Community template sharing/marketplace
- AI-generated templates based on feed content
- Smart template recommendations based on feed type

### Risk Mitigation Strategy

**Technical Risks:**
- *Template/feed mismatch:* Mitigated by preview using actual feed article; default template designed to never fail
- *Preview fidelity:* Reusing existing preview component which is already an accepted approximation

**Market Risks:**
- *Users don't adopt templates:* Mitigated by making template selection part of the natural flow, not a separate feature to discover
- *Templates don't match user needs:* Start with 4 versatile templates; expand based on feedback

**Resource Risks:**
- *Minimum viable scope:* Can launch with 4 templates and core flow; polish and expansion can follow
- *Reuse strategy:* Leveraging existing preview component and article selector reduces new development

## Functional Requirements

### Template Gallery

- FR1: Users can view a gallery of pre-designed message templates displayed as a visual grid
- FR2: Users can see a preview of how each template will render with their feed's content
- FR3: Users can select an article from their feed to use as preview sample data
- FR4: Users can apply a template to their connection with a single click
- FR5: Users can see which template is currently selected/active
- FR6: System displays loading indicator while fetching template preview

### Connection Creation Flow

- FR7: Users are presented with template selection as part of the connection creation flow
- FR8: Connection only becomes active after user completes template selection step (or skips)
- FR9: Users can skip template selection to use the default template
- FR10: Users are shown confirmation that delivery will be automatic after setup

### Message Builder Integration

- FR11: Users can access the template gallery from within the message builder UI
- FR12: Users can apply a template to an existing connection
- FR13: Selecting a template populates the message builder form fields with template settings
- FR14: Users can modify template settings after applying (template is a starting point)
- FR15: Users are informed that changes won't overwrite settings until they explicitly save
- FR16: Users can discard changes to restore their previous configuration

### Test Send

- FR17: Users can send a test article to Discord after selecting a template
- FR18: Users are informed that test send is optional and delivery will be automatic going forward

### Empty Feed Handling

- FR19: Users with empty feeds can select only the default template
- FR20: Users with empty feeds see other templates greyed out with explanatory message
- FR21: Users with empty feeds can proceed with default template and return later

### Default Template

- FR22: System provides a default template that works with any feed (safe, never fails)
- FR23: Users who skip template selection automatically receive the default template

### Accessibility

- FR24: Users can navigate the template gallery using keyboard controls
- FR25: Screen reader users receive appropriate labels and announcements for template selection
- FR26: Focus is properly managed when opening/closing the template gallery

## Non-Functional Requirements

### Performance

- NFR1: Template gallery UI loads without blocking the connection creation flow
- NFR2: Only the currently selected template preview is rendered (not all templates simultaneously)
- NFR3: Preview fetch is triggered immediately on template/article selection change
- NFR4: Loading indicators provide feedback during preview network requests
- NFR5: UI interactions (selection, navigation) remain responsive during preview loading

### Accessibility

- NFR6: Template gallery meets WCAG 2.1 AA compliance
- NFR7: All template selection functionality is operable via keyboard
- NFR8: Screen readers can identify templates, selection state, and preview content
- NFR9: Focus indicators are clearly visible during keyboard navigation
- NFR10: Loading states are announced to assistive technologies

### Responsive Design

- NFR11: Template gallery adapts to mobile, tablet, and desktop screen sizes
- NFR12: Touch targets for template selection meet minimum size guidelines (44x44px)

### Integration

- NFR13: Template preview reuses existing message preview API and component
- NFR14: Template application uses existing connection/message builder data structures
- NFR15: No changes required to Discord delivery infrastructure
