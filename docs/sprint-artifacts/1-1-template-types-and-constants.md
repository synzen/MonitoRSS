# Story 1.1: Template Types and Constants

Status: ready-for-dev

## Story

As a developer,
I want a well-defined Template interface and a set of pre-designed templates,
So that the template gallery has professional content to display and a safe default that always works.

## Acceptance Criteria

1. **Given** the feature module structure exists at `src/features/templates/`
   **When** I import from `@/features/templates`
   **Then** I have access to a `Template` interface with: id, name, description, thumbnail (optional), requiredFields array, and messageComponent (supporting V1 and V2 formats)

2. **Given** the templates constant file exists
   **When** I access the templates array
   **Then** there are at least 4 pre-designed templates available

3. **Given** one template is designated as the default
   **When** I check its requiredFields array
   **Then** it is empty (requires no specific feed fields, safe for any feed)

4. **Given** any template in the array
   **When** I inspect its messageComponent
   **Then** it contains a valid MessageComponentRoot structure (V1 Legacy or V2 format)

5. **Given** templates need thumbnails for the gallery
   **When** I access a template's thumbnail property
   **Then** it contains a reference to a static preview image or is undefined (preview will be generated dynamically)

## Tasks / Subtasks

- [ ] **Task 1: Create feature module structure** (AC: #1)
  - [ ] Create directory: `services/backend-api/client/src/features/templates/`
  - [ ] Create `index.ts` barrel export file
  - [ ] Create `types/` subdirectory with `index.ts`
  - [ ] Create `constants/` subdirectory with `index.ts`
  - [ ] Create `components/` subdirectory with `index.ts`
  - [ ] Create `hooks/` subdirectory with `index.ts`

- [ ] **Task 2: Define Template type interface** (AC: #1, #4)
  - [ ] Create `types/Template.ts`
  - [ ] Import `MessageComponentRoot` from `src/pages/MessageBuilder/types`
  - [ ] Define `Template` interface with all required fields
  - [ ] Export via barrel file

- [ ] **Task 3: Create DEFAULT_TEMPLATE** (AC: #3)
  - [ ] Create `constants/templates.ts`
  - [ ] Define `DEFAULT_TEMPLATE_ID = 'default'`
  - [ ] Create default template with empty `requiredFields` array
  - [ ] Use `ComponentType.LegacyRoot` with simple text output
  - [ ] Default should show: `{title}\n{url}` - pure text, never fails

- [ ] **Task 4: Create 3 additional templates** (AC: #2, #4)
  - [ ] Create "Rich Embed" template using `ComponentType.LegacyRoot` with embedded content (title, description, image, footer)
  - [ ] Create "Minimal Card" template using V2 components (Container with Section)
  - [ ] Create "News Ticker" template - compact V2 format with text and button
  - [ ] Set appropriate `requiredFields` for each template

- [ ] **Task 5: Export TEMPLATES array** (AC: #2)
  - [ ] Create and export `TEMPLATES: Template[]` array
  - [ ] Ensure default template is first in array
  - [ ] Export via barrel file

- [ ] **Task 6: Add helper functions** (AC: #3)
  - [ ] Create `getTemplateById(id: string): Template | undefined`
  - [ ] Create `getDefaultTemplate(): Template`
  - [ ] Create `isDefaultTemplate(template: Template): boolean`

## Dev Notes

### Critical Architecture Constraints

**MUST FOLLOW - These are non-negotiable:**

1. **Feature Module Location**: All new code goes in `services/backend-api/client/src/features/templates/`
2. **Type Import Path**: Import `MessageComponentRoot`, `ComponentType`, and related types from `../../pages/MessageBuilder/types`
3. **Naming Convention**: PascalCase for types/interfaces, camelCase for functions, SCREAMING_SNAKE_CASE for constants
4. **Barrel Exports**: Every subdirectory MUST have an `index.ts` that re-exports its contents

### MessageComponentRoot Structure Reference

The `messageComponent` field MUST be a valid `MessageComponentRoot` which is a union type:

```typescript
// From src/pages/MessageBuilder/types.ts
export type MessageComponentRoot = LegacyMessageComponentRoot | V2MessageComponentRoot;

// LegacyRoot structure (V1 - traditional embeds)
interface LegacyMessageComponentRoot {
  type: ComponentType.LegacyRoot;  // "Legacy Discord Message"
  id: string;
  name: string;
  children: Component[];  // LegacyText, LegacyEmbedContainer, LegacyActionRow, etc.
  // ... optional settings
}

// V2Root structure (new Discord Components V2)
interface V2MessageComponentRoot {
  type: ComponentType.V2Root;  // "Discord Components V2"
  id: string;
  name: string;
  children: Component[];  // Container, TextDisplay, Section, ActionRow, etc.
  // ... optional settings
}
```

### ComponentType enum values (from src/pages/MessageBuilder/types.ts)

**V1 Legacy:**
- `ComponentType.LegacyRoot` = "Legacy Discord Message"
- `ComponentType.LegacyText` = "Legacy Text"
- `ComponentType.LegacyEmbedContainer` = "Legacy Embed Container"
- `ComponentType.LegacyEmbed` = "Legacy Embed"
- `ComponentType.LegacyEmbedTitle`, `LegacyEmbedDescription`, `LegacyEmbedImage`, etc.
- `ComponentType.LegacyActionRow`, `LegacyButton`

**V2 Components:**
- `ComponentType.V2Root` = "Discord Components V2"
- `ComponentType.V2TextDisplay` = "Text Display"
- `ComponentType.V2Container` = "Container"
- `ComponentType.V2Section` = "Section"
- `ComponentType.V2Divider` = "Divider"
- `ComponentType.V2ActionRow` = "Action Row"
- `ComponentType.V2Button` = "Button"
- `ComponentType.V2Thumbnail` = "Thumbnail"
- `ComponentType.V2MediaGallery` = "Media Gallery"

### Template Specifications (COMPLETE - Implement Exactly As Shown)

The 4 required templates are specified below with exact structure. Implement these precisely.

---

#### Template 1: Default (REQUIRED - Bulletproof)

**Purpose:** Safe fallback that works with ANY feed, even those with minimal fields.

| Property | Value |
|----------|-------|
| id | `'default'` |
| name | `'Simple Text'` |
| description | `'Clean text format that works with any feed'` |
| requiredFields | `[]` (empty - works with everything) |
| Format | V1 Legacy |

**Visual Output in Discord:**
```
Article Title Here
https://example.com/article-url
```

**Complete messageComponent:**
```typescript
{
  type: ComponentType.LegacyRoot,
  id: 'default-root',
  name: 'Simple Text Template',
  children: [{
    type: ComponentType.LegacyText,
    id: 'default-text',
    name: 'Message Content',
    content: '**{title}**\n{url}'
  }]
}
```

---

#### Template 2: Rich Embed

**Purpose:** Professional-looking embed with thumbnail, ideal for blogs and news.

| Property | Value |
|----------|-------|
| id | `'rich-embed'` |
| name | `'Rich Embed'` |
| description | `'Full embed with image, description, and branding'` |
| requiredFields | `['description']` |
| Format | V1 Legacy |

**Visual Output in Discord:**
```
┌─────────────────────────────────┐
│ [Thumbnail image on right]      │
│ Article Title (clickable)       │
│ First 200 chars of description  │
│                                 │
│ 📰 Feed Name          timestamp │
└─────────────────────────────────┘
```

**Complete messageComponent:**
```typescript
{
  type: ComponentType.LegacyRoot,
  id: 'rich-embed-root',
  name: 'Rich Embed Template',
  children: [{
    type: ComponentType.LegacyEmbedContainer,
    id: 'rich-embed-container',
    name: 'Embeds',
    children: [{
      type: ComponentType.LegacyEmbed,
      id: 'rich-embed-embed',
      name: 'Main Embed',
      color: 5814783,  // #58ACFF - blue
      children: [
        {
          type: ComponentType.LegacyEmbedTitle,
          id: 'rich-embed-title',
          name: 'Title',
          title: '{title}',
          titleUrl: '{url}'
        },
        {
          type: ComponentType.LegacyEmbedDescription,
          id: 'rich-embed-desc',
          name: 'Description',
          description: '{description}'
        },
        {
          type: ComponentType.LegacyEmbedThumbnail,
          id: 'rich-embed-thumb',
          name: 'Thumbnail',
          thumbnailUrl: '{image}'
        },
        {
          type: ComponentType.LegacyEmbedFooter,
          id: 'rich-embed-footer',
          name: 'Footer',
          footerText: '📰 {feed::title}'
        },
        {
          type: ComponentType.LegacyEmbedTimestamp,
          id: 'rich-embed-timestamp',
          name: 'Timestamp',
          timestamp: 'article'
        }
      ]
    }]
  }]
}
```

---

#### Template 3: Compact Card (V2)

**Purpose:** Modern Discord Components V2 format with clean layout.

| Property | Value |
|----------|-------|
| id | `'compact-card'` |
| name | `'Compact Card'` |
| description | `'Modern card layout with thumbnail and read button'` |
| requiredFields | `[]` (works with any feed) |
| Format | V2 Components |

**Visual Output in Discord:**
```
┌─────────────────────────────────┐
│ [Thumb] Article Title Here      │
│         Short description...    │
│                    [Read More]  │
└─────────────────────────────────┘
```

**Complete messageComponent:**
```typescript
{
  type: ComponentType.V2Root,
  id: 'compact-card-root',
  name: 'Compact Card Template',
  children: [{
    type: ComponentType.V2Container,
    id: 'compact-card-container',
    name: 'Card Container',
    accentColor: 5814783,  // #58ACFF - blue accent bar
    children: [
      {
        type: ComponentType.V2Section,
        id: 'compact-card-section',
        name: 'Content Section',
        children: [{
          type: ComponentType.V2TextDisplay,
          id: 'compact-card-text',
          name: 'Title & Description',
          content: '**{title}**\n{description::50}'
        }],
        accessory: {
          type: ComponentType.V2Thumbnail,
          id: 'compact-card-thumb',
          name: 'Thumbnail',
          mediaUrl: '{image}',
          description: 'Article thumbnail'
        }
      },
      {
        type: ComponentType.V2ActionRow,
        id: 'compact-card-actions',
        name: 'Actions',
        children: [{
          type: ComponentType.V2Button,
          id: 'compact-card-btn',
          name: 'Read More Button',
          label: 'Read More',
          style: 5,  // Link style
          disabled: false,
          href: '{url}'
        }]
      }
    ]
  }]
}
```

---

#### Template 4: Media Gallery (V2)

**Purpose:** Image-focused layout using V2 MediaGallery for visual content feeds (photography, art, news with images).

| Property | Value |
|----------|-------|
| id | `'media-gallery'` |
| name | `'Media Gallery'` |
| description | `'Showcase images in a modern gallery layout'` |
| requiredFields | `['image']` |
| Format | V2 Components |

**Visual Output in Discord:**
```
┌─────────────────────────────────┐
│ **Article Title**               │
│ Short description text...       │
│                                 │
│ ┌─────────┐ ┌─────────┐        │
│ │  Image  │ │  Image  │        │
│ │    1    │ │    2    │        │
│ └─────────┘ └─────────┘        │
│                                 │
│              [View Article]     │
└─────────────────────────────────┘
```

**Complete messageComponent:**
```typescript
{
  type: ComponentType.V2Root,
  id: 'media-gallery-root',
  name: 'Media Gallery Template',
  children: [{
    type: ComponentType.V2Container,
    id: 'media-gallery-container',
    name: 'Gallery Container',
    accentColor: 2895667,  // #2C2F33 - dark gray accent
    children: [
      {
        type: ComponentType.V2TextDisplay,
        id: 'media-gallery-title',
        name: 'Title',
        content: '**{title}**'
      },
      {
        type: ComponentType.V2TextDisplay,
        id: 'media-gallery-desc',
        name: 'Description',
        content: '{description::100}'
      },
      {
        type: ComponentType.V2Divider,
        id: 'media-gallery-divider',
        name: 'Divider',
        visual: true,
        spacing: 1,
        children: []
      },
      {
        type: ComponentType.V2MediaGallery,
        id: 'media-gallery-gallery',
        name: 'Image Gallery',
        children: [
          {
            type: ComponentType.V2MediaGalleryItem,
            id: 'media-gallery-item-1',
            name: 'Image 1',
            mediaUrl: '{image}',
            description: '{title}',
            children: []
          }
        ]
      },
      {
        type: ComponentType.V2ActionRow,
        id: 'media-gallery-actions',
        name: 'Actions',
        children: [{
          type: ComponentType.V2Button,
          id: 'media-gallery-btn',
          name: 'View Button',
          label: 'View Article',
          style: 5,  // Link style
          disabled: false,
          href: '{url}'
        }]
      }
    ]
  }]
}
```

**Note:** The MediaGallery shows one image by default using `{image}`. If the feed provides multiple images, users can customize in the message builder to add more MediaGalleryItem children.

---

### TEMPLATES Array Order

Export templates in this exact order:
```typescript
export const TEMPLATES: Template[] = [
  DEFAULT_TEMPLATE,       // Always first - fallback (V1)
  RICH_EMBED_TEMPLATE,    // Classic embed format (V1)
  COMPACT_CARD_TEMPLATE,  // Modern card with button (V2)
  MEDIA_GALLERY_TEMPLATE, // Image gallery showcase (V2)
];
```

### Template Format Summary

| Template | Format | Why This Format |
|----------|--------|-----------------|
| Simple Text | V1 Legacy | Most compatible, safest fallback |
| Rich Embed | V1 Legacy | Embeds excel at title+desc+thumb+footer+timestamp |
| Compact Card | V2 | Section with thumbnail accessory + action button |
| Media Gallery | V2 | MediaGallery component is V2-exclusive feature |

### Placeholder Reference

Common placeholders used in templates:
- `{title}` - Article title (always available)
- `{url}` - Article URL (always available)
- `{description}` - Article description/summary
- `{description::50}` - Description truncated to 50 chars
- `{image}` - First image URL from article
- `{feed::title}` - Name of the RSS feed
- `{author}` - Article author (if available)

### ID Generation

All component IDs must be unique. Use a consistent pattern:
- `{templateId}-root` for root component
- `{templateId}-{componentType}-{index}` for children

### File Structure to Create

```
services/backend-api/client/src/features/templates/
├── index.ts                    # Barrel export
├── types/
│   ├── index.ts               # Re-exports Template
│   └── Template.ts            # Template interface
├── constants/
│   ├── index.ts               # Re-exports templates and constants
│   └── templates.ts           # TEMPLATES array, DEFAULT_TEMPLATE_ID
├── components/
│   └── index.ts               # Empty for now, placeholder
└── hooks/
    └── index.ts               # Empty for now, placeholder
```

### Project Structure Notes

- Feature module pattern matches existing `src/features/feedConnections/`, `src/features/discordServers/`, etc.
- Import path alias `@/` may not be configured - use relative imports `../../pages/MessageBuilder/types`
- All TypeScript with strict mode enabled

### Testing Requirements

- Type check: `npm run type-check` or `tsc --noEmit`
- Templates must be valid `MessageComponentRoot` structures
- Default template must have empty `requiredFields` array

### References

- [Architecture: Feature Module Structure] docs/architecture.md - "Project Structure & Boundaries"
- [Architecture: Template Storage Strategy] docs/architecture.md - "Core Architectural Decisions"
- [MessageBuilder Types] services/backend-api/client/src/pages/MessageBuilder/types.ts:1-314
- [PRD: Default Template] docs/prd.md - FR22, FR23
- [UX: Templates] docs/ux-design-specification.md - "Bulletproof Default"
- [Epics: Story 1.1] docs/epics.md:192-218

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

