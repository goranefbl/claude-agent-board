# Ardena.com Gutenberg Block Migration Strategy

## Project Scope
- **Total pages:** ~72 pages
  - **60 content pages** (articles, events) - simple content, easily transferable
  - **12 real pages** (home, about, services, career, etc.) - built with ACF flexible content
- **Current tech:** ACF Flexible Content
- **Target:** WordPress Gutenberg blocks + custom blocks as needed

---

## Phase 1: Block Inventory & Design

### Use Core/Native Gutenberg Blocks (No custom blocks needed)
These already exist in WordPress and require zero custom development:

1. **core/heading** - All section titles
2. **core/paragraph** - Body text
3. **core/image** - Single images
4. **core/list** - Bullet/numbered lists
5. **core/group** - Container with background, padding, border, border-radius
   - Use Grid layout (min-width option) for responsive cards
   - Use Flex layout for two-column layouts with text/image
6. **core/columns** - Two or three fixed-width columns (use sparingly, prefer group for grids)
7. **core/button** - CTAs, links with styling
8. **core/separator** - Visual dividers
9. **core/spacer** - Vertical spacing between sections

### Custom Gutenberg Blocks to Create (10-14 total)
Only create custom blocks for things core blocks cannot do or would be too complex/unintuitive:

#### 1. **Hero Block** (1 block)
   - Fields:
     - Title (with color word option: highlight one word in brand color)
     - Subtitle/Description
     - Badge pill (optional)
     - CTA button (text, link, style: primary/secondary)
     - Background (solid color, gradient, or image)
     - Text alignment
   - Why custom: Core blocks don't have the "highlight one word" pattern or gradient backgrounds
   - Used on: All hero sections (home, inner pages)

#### 2. **Badge Pill Block** (1 block)
   - Fields:
     - Text
     - Background color (preset colors)
     - Size (small, medium, large)
   - Why custom: Small reusable component that needs consistent styling
   - Used on: Section headers, card badges, feature labels

#### 3. **Section Header Block** (1 block)
   - Fields:
     - Badge pill (optional, uses Badge Pill block)
     - Main heading (with optional highlight word)
     - Description/subtitle
     - Alignment (left, center, right)
   - Why custom: Combines badge + heading in a structured way, used repeatedly
   - Used on: Before every section (Why Ardena, Care in Action, etc.)

#### 4. **Colored Card Block** (1 block)
   - Fields:
     - Icon (or icon library)
     - Title
     - Description
     - Background color (from preset palette)
     - Link (optional)
     - Read More button (optional)
   - Why custom: Consistent card styling with icon/text combo
   - Used on: "Why Ardena?" grid, feature cards
   - **Container pattern:** Use core/group with Grid layout, place Colored Card blocks inside

#### 5. **Icon + Title + List Block** (1 block)
   - Fields:
     - Icon (from library)
     - Title
     - List items (repeater field)
     - Background color (optional, preset colors)
     - Has border (toggle)
   - Why custom: Combines icon + structured content (Care in Action pattern)
   - Used on: Care boxes, service details

#### 6. **Two-Column Layout Block** (1 block)
   - Fields:
     - Which side has content (left/right)
     - Content type on configurable side: text block or card
     - Image/card on other side
     - Background color (optional)
     - Text alignment
   - Why custom: Saves time vs. using two core/columns, handles the text-left/card-right pattern
   - Alternative: Use core/columns with core/group + core/image, but custom block is simpler
   - Used on: Mission/Vision, service details, Caring Beyond Lab section

#### 7. **Testimonial Block** (1 block)
   - Fields:
     - Quote text
     - Author name
     - Author title/role
     - Author photo (optional)
     - Rating (stars, 1-5)
   - Why custom: Specific testimonial styling
   - Used on: If testimonials exist on site

#### 8. **Feature Grid Block** (1 block)
   - Fields:
     - Items (repeater): icon, title, description
     - Columns (2 or 3)
     - Background color (optional)
   - Why custom: Structured grid of features with consistent styling
   - Alternative: Use core/group with Grid layout + Colored Card blocks
   - **Decision:** Skip this if core/group grid + cards work well

#### 9. **CTA Banner Block** (1 block)
   - Fields:
     - Heading
     - Description
     - Primary CTA button (text, link)
     - Secondary CTA button (optional)
     - Background color or gradient
   - Why custom: Common pattern, needs specific layout
   - Used on: Between sections, end of pages

#### 10. **Team Member Card Block** (1 block)
   - Fields:
     - Photo
     - Name
     - Role/Title
     - Bio/Description
     - Social links (optional)
   - Why custom: Specific team card layout
   - Used on: Team/Career pages (if they exist)

#### 11. **Service Detail Block** (1 block)
   - Fields:
     - Title
     - Description
     - Icon
     - Link/CTA (optional)
   - Why custom: Service-specific styling
   - Alternative: Use Colored Card + Icon List combo
   - **Decision:** Skip if Colored Card works

#### 12. **Timeline/Process Block** (1 block)
   - Fields:
     - Steps (repeater): title, description, icon, number
     - Layout (horizontal, vertical)
   - Why custom: Not a common Gutenberg pattern
   - Used on: Process pages, career/application flows (if they exist)

#### 13. **Accordion/Collapsible Block** (1 block)
   - Fields:
     - Items (repeater): title, content
     - Allow multiple open (toggle)
   - Why custom: FAQ patterns, hide/show content
   - Used on: FAQ pages (if they exist)

---

## Block Count Summary
- **Core blocks used:** 9 (no development)
- **Custom blocks to build:** 8-13
- **Recommended minimum:** 10 custom blocks
  - Must-haves: Hero, Badge, Section Header, Colored Card, Icon+List, Two-Column, CTA Banner
  - Nice-to-haves: Testimonial, Team Card, Timeline, Accordion

---

## Phase 2: Migration Strategy

### Step 1: Content Pages (60 articles/events) - 1-2 weeks
1. **Export from ACF** - If ACF blocks already exist, many will convert automatically
2. **Batch content pages** into 5-10 per editor
3. **Minimal restructuring** - Keep title, content, featured image
4. **No custom block setup needed** - Use core/heading, core/paragraph, core/image
5. **Timeline:** Run in parallel with block development

### Step 2: Real Pages (12 pages) - 2-3 weeks
1. **Audit each page** - Map current ACF flexible content layouts to block types
2. **Create blocks incrementally** - Build blocks as you encounter them
3. **Migration order (by dependency):**
   1. **Week 1:** Hero, Section Header, Badge (unlocks 70% of pages)
   2. **Week 1-2:** Colored Card, Icon+List, Two-Column (covers remaining pages)
   3. **Week 2:** Testimonial, CTA Banner, Timeline (if needed)
4. **Test as you go** - Migrate one page per block type to test UX

### Step 3: Homepage Redesign - 1 week
1. Once core blocks are built, redesign homepage with new design
2. Use page builder to visualize layout
3. Fine-tune block styling

### Step 4: Go-live - 1 day
1. Enable blocks in production
2. Redirect old ACF content (if needed)
3. Publish new pages

---

## Page-by-Page Migration Map

| Page | Sections | Blocks Needed | Effort |
|------|----------|---------------|--------|
| Home | Hero, Features, Why Ardena, CTA | Hero, Section Header, Colored Card, CTA Banner | Medium |
| About | Hero, Mission/Vision, Caring Beyond, Team | Hero, Two-Column, Team Card | Medium |
| Why Ardena | Hero, 5-card grid, CTA | Hero, Colored Card (in Grid), CTA Banner | Small |
| Care in Action | Hero, 4 boxes with icon/title/list | Hero, Icon+List (in Grid) | Small |
| Services | Hero, Service list, Service detail pages | Hero, Colored Card, Service Detail | Medium |
| Career | Hero, Benefits, Team, Timeline | Hero, Icon+List, Timeline | Medium |
| Blog/Articles | Title, Content, Featured image | core/heading, core/paragraph, core/image | Small |
| Events | Title, Date, Description, Image | Same as blog + core/group for metadata | Small |

---

## Theme.json Configuration

### Presets to define:
```json
{
  "color": {
    "palette": [
      { "name": "Ardena Burgundy", "color": "#8B4557" },
      { "name": "Ardena Light", "color": "#F5E6D3" },
      // Add all brand colors
    ]
  },
  "blocks": {
    "core/group": {
      "supports": ["background", "padding", "border", "borderRadius"]
    },
    "core/columns": {
      "supports": ["background", "padding"]
    }
  }
}
```

This ensures editors pick from brand colors, not arbitrary ones.

---

## File Structure (WordPress)

```
/wp-content/blocks/
├── hero/
│   ├── block.json
│   ├── edit.js
│   ├── save.js
│   └── style.css
├── badge-pill/
├── section-header/
├── colored-card/
├── icon-title-list/
├── two-column-layout/
├── cta-banner/
├── team-card/
├── testimonial/
├── timeline/
├── accordion/
└── index.js (exports all blocks)
```

---

## Success Criteria
- [ ] All 12 real pages migrated to Gutenberg
- [ ] All 60 content pages migrated
- [ ] Theme colors locked to brand palette via theme.json
- [ ] Editors can't create visual inconsistencies
- [ ] Mobile responsive (test on 5 devices)
- [ ] Accessibility audit pass (WCAG 2.1 AA)
- [ ] Performance: homepage < 3s LCP on 4G

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| ACF migration bugs | Content loss | Test on staging, export ACF data before deleting |
| Block API changes | Deprecated blocks | Build with WordPress 6.3+ APIs, test quarterly |
| Editor UX confusion | Slow adoption | Create block-specific documentation, video demos |
| Performance regression | Slow page loads | Lazy-load images, use core/image lazy attributes |

---

## Timeline Summary
- **Block development:** 3-4 weeks (parallel with content migration)
- **Content migration:** 2-3 weeks (60 pages)
- **Real page migration:** 2-3 weeks (12 pages)
- **Testing & polish:** 1 week
- **Total:** 8-11 weeks

---

## Next Steps
1. **Create Hero block** (first blocker)
2. **Create Section Header block** (second blocker)
3. **Migrate one test page** (validate approach)
4. **Build remaining blocks** (as needed per page)
5. **Go-live checklist**
