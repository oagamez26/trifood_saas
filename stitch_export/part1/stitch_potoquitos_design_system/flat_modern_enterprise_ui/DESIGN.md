---
name: Flat Modern Enterprise UI
colors:
  surface: '#FFFFFF'
  surface-dim: '#d8dadd'
  surface-bright: '#f7f9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f7'
  surface-container: '#eceef1'
  surface-container-high: '#e6e8eb'
  surface-container-highest: '#e0e3e6'
  on-surface: '#191c1e'
  on-surface-variant: '#434655'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f4'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#bb0023'
  on-secondary: '#ffffff'
  secondary-container: '#e02737'
  on-secondary-container: '#fffbff'
  tertiary: '#006242'
  on-tertiary: '#ffffff'
  tertiary-container: '#007d55'
  on-tertiary-container: '#bdffdb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#ffdad8'
  secondary-fixed-dim: '#ffb3b0'
  on-secondary-fixed: '#410006'
  on-secondary-fixed-variant: '#930019'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f7f9fc'
  on-background: '#191c1e'
  surface-variant: '#e0e3e6'
  primary-dark: '#0F2747'
  primary-soft: '#EAF2FF'
  danger-dark: '#B91C1C'
  danger-soft: '#FDEBED'
  success-soft: '#DFF7EE'
  warning: '#F59E0B'
  warning-soft: '#FFF4D6'
  info: '#3B82F6'
  neutral-status: '#94A3B8'
  surface-secondary: '#F8FAFC'
  border: '#E3E8EF'
  border-strong: '#CBD5E1'
  text-primary: '#102A43'
  text-secondary: '#627D98'
  text-muted: '#829AB1'
typography:
  display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  kpi-metric:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 30px
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-md-semibold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-mobile: 0.75rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 1.5rem
---

## Brand & Style

This design system establishes a high-performance, utilitarian, and disciplined operational interface engineered specifically for multi-unit and high-volume restaurant management. High-pressure environments (kitchen line, active dining rooms, fast checkouts, and inventory audits) require instantaneous readability, clear visual hierarchy, and zero decorative friction.

### Design Movement & Aesthetic
The style follows **Corporate / Modern (Flat Enterprise)**:
- **Clean Structure**: Crisp containers, structural dividers, and deliberate whitespace supersede ornamental complexity.
- **Strictly No Glassmorphism or Heavy Skew**: Translucent frosted panels, heavy drop shadows, neon accents, and parallax effects are strictly prohibited to ensure high frame rates, predictable contrast, and visual calmness across extended work shifts.
- **Brand Dualism**: The primary brand anchor is a functional operational blue (`#2563EB`), paired intentionally with the brand's distinct red (`#EF3340`) utilized as an active navigation state indicator and an urgent operational alert accent.
- **Mascot Containment Policy**: The character mark is restricted to public entry points (login, splash, about, and optional menu displays). Internal dashboards, data tables, metrics cards, and kitchen displays remain uncluttered by playful illustration, prioritizing pure data density and actionable clarity.

## Colors

The color palette is built around high-contrast legibility, operational color-coding, and functional containment.

### Key Roles
- **Primary (`#2563EB`)**: Used for core calls-to-action, active interactive controls, focus rings, and primary interactive iconography.
- **Secondary (`#EF3340`)**: Operational alert and active focus color. Used for table urgency ("Pendiente"), stock depletion warnings ("Crítico"), active sidebar selection boundaries, and destructive confirmation steps.
- **Tertiary (`#10B981`)**: Order fulfillment indicator ("Lista", "En servicio", positive revenue delta percentages).
- **Neutral (`#F5F7FA`)**: The global page canvas tone, ensuring soft separation against pure white cards (`#FFFFFF`).

### Operational Status Mapping (Restaurant Floors & Orders)
- **Disponible / Unoccupied**: `#94A3B8` (Neutral gray badge/dot)
- **En preparación / Cooking**: `#3B82F6` (Info blue)
- **Lista / Order Ready**: `#10B981` (Success green)
- **Pendiente / Delayed / Urgent**: `#EF3340` (Alert red)

### Typography Tones
Instead of pure carbon black, text utilizes deep navy tones (`#102A43` for headings and primary metrics, `#627D98` for secondary labels, and `#829AB1` for captions and timestamps) to prevent harsh screen glare during long shifts while preserving maximum contrast.

## Typography

The typography is locked to a single humanist grotesque typeface: **Inter**. This unifies application densities across dense tables, POS terminal sizes, and administrative reporting dashboards.

### Principles
- **Monospaced Numerical Alignment**: KPI numbers and monetary units utilize `font-variant-numeric: tabular-nums` to maintain aligned decimals in ledger columns, transaction receipts, and live metrics.
- **Hierarchy Anchors**:
  - `Display` (`32px`, Bold): Reserved for login, splash screen titles, and big counter cards.
  - `Headline-LG` / `KPI-Metric` (`28px`, Bold): Primary page headings ("Hola, Administrador") and dashboard KPI totals.
  - `Headline-MD` (`22px`, Bold): Section dividers and modal headers.
  - `Headline-SM` (`18px`, Semi-Bold): Sub-card headings ("Operación actual", "Ventas de la semana").
  - `Body-MD` (`14px`, Regular / Semi-Bold): Data tables, active form fields, and standard records.
  - `Label-MD` (`13px`, Medium): Navigation menu links and time tags.
  - `Label-SM` / `Caption` (`12px`): Pills, badges, and contextual comparison indicators (e.g., `↑ 12% vs ayer`).

## Layout & Spacing

The layout is built upon a 4px/8px modular base rhythm inside a fixed administrative shell.

### Layout Model
- **Persistent Sidebar Shell**: A fixed `240px` wide navigation pane anchored to the left on screens `>= 1200px`. Folds into an overlay drawer on mobile and tablet.
- **Top Utility Header**: Fixed `64px` height containing the global system search bar, quick alert counter, and role/user profile switcher.
- **Main Canvas Area**: Standard `24px` (`1.5rem`) outer padding. Content organizes into responsive CSS grid containers using a standard 12-column or multi-card layout with consistent `20px` (`1.25rem`) gutters.
- **Card Padding**: Interior padding for all dashboard and operational cards is standardized at `20px`.

### Responsive Breakpoints
- **Mobile (`< 768px`)**: Single column flow. Outer margins reduce to `16px`, sidebar turns into a bottom sheet or off-canvas drawer, cards stack vertically.
- **Tablet (`768px - 1199px`)**: 2-column KPI layouts, sidebar collapses to icon-only mode (`64px` width) or off-canvas.
- **Desktop (`1200px - 1599px`)**: Full enterprise layout (`240px` sidebar, 4-column KPI cards, side-by-side analytical and operational table views).
- **Large Desktop (`>= 1600px`)**: Layout centered or capped at `1440px` inner max-width to maintain eye scanning efficiency without elongated table rows.

## Elevation & Depth

Visual separation relies on strict structural containment rather than heavy vertical depth.

### Depth Hierarchy
1. **Canvas (Level 0)**: Background `#F5F7FA`.
2. **Standard Surface (Level 1)**: White surfaces (`#FFFFFF`) framed with a crisp `1px solid #E3E8EF` border and an ultra-subtle ambient shadow:
   `box-shadow: 0 4px 14px rgba(15, 39, 71, 0.05)`.
3. **Interactive Hover (Level 2)**: Hovering over action cards, table rows, or clickable widgets produces a slight lift:
   `box-shadow: 0 6px 18px rgba(15, 39, 71, 0.08)` and border transition to `#CBD5E1`.
4. **Floating Overlays & Modals (Level 3)**: Dropdowns, tooltips, and confirmation dialogs utilize:
   `box-shadow: 0 10px 25px rgba(15, 39, 71, 0.12)` with solid white backgrounds and `#E3E8EF` boundaries.
5. **No Glassmorphism**: Frosted glass effects, `backdrop-filter: blur()`, and decorative colored glow effects are explicitly prohibited.

## Shapes

The design system maintains a modern, balanced curvature scale that softens the density of enterprise forms without feeling overly toy-like.

### Token Mapping
- **`--radius-sm` (8px)**: Small nested components, status dot containers, date/time chips, and nested sub-elements.
- **`--radius-md` (10px)**: Interactive controls (inputs, search bars, buttons, dropdown triggers) and catalog asset thumbnails (`56px × 56px` with `object-fit: cover`).
- **`--radius-lg` (16px)**: Standard content cards, analytical chart panels, modals, and operational dashboard widgets.
- **`--radius-pill` (9999px / full)**: Operational status badges, stock level chips ("Crítico", "Bajo", "OK"), notification count bubbles, and filter tags.

## Components

### Buttons
- **Primary Action**: Height `42px`, padding `0 16px`, background `#2563EB`, text `#FFFFFF`, radius `10px`, font-size `14px`, font-weight `600`. Hover: `#1D4ED8`. Active: `#1E40AF`.
- **Secondary / Outline**: Height `42px`, padding `0 16px`, background `#FFFFFF`, border `1px solid #CBD5E1`, text `#102A43`, radius `10px`. Hover: `#F8FAFC`.
- **Danger / Destructive**: Height `42px`, padding `0 16px`, background `#EF3340`, text `#FFFFFF`, radius `10px`. Hover: `#DC2626`.
- **Ghost / Icon Button**: Height `40px`, width `40px`, background transparent, border none, icon color `#627D98`. Hover: `#F5F7FA` with text `#102A43`.

### Sidebar Navigation Item
- Height `44px`, horizontal padding `14px`, gap `12px`, border-radius `0 8px 8px 0` (or symmetrical `8px`), font size `13px`, font weight `500`.
- **Default State**: Text `#627D98`, icon `#829AB1`, background transparent.
- **Hover State**: Text `#102A43`, background `#F8FAFC`.
- **Active State**: Background `#FDEBED`, text `#EF3340`, icon `#EF3340`, font weight `600`. Features an exclusive `3px solid #EF3340` indicator on the far left edge.

### Inputs & Search Bars
- Height `42px`, background `#FFFFFF`, border `1px solid #CBD5E1`, border-radius `10px`, horizontal padding `12px`, font size `14px`, text color `#102A43`, placeholder `#829AB1`.
- Focus state: Border color `#2563EB`, box-shadow `0 0 0 3px rgba(37, 99, 235, 0.15)`.

### Operational Status Badges & Pills
- Height `26px`, horizontal padding `10px`, border-radius `9999px`, font size `12px`, font-weight `600`, display inline-flex, align-items center, gap `6px`.
- **Success / Lista**: Background `#DFF7EE`, text `#10B981`.
- **Alert / Pendiente / Crítico**: Background `#FDEBED`, text `#EF3340`.
- **In-Prep / Info**: Background `#EAF2FF`, text `#2563EB`.
- **Warning / Bajo**: Background `#FFF4D6`, text `#D97706`.
- **Neutral / Disponible**: Background `#F1F5F9`, text `#64748B`.

### Tables (Kitchen, Orders, & Operations)
- **Container**: Border `1px solid #E3E8EF`, border-radius `16px`, background `#FFFFFF`, overflow hidden.
- **Header Row**: Background `#F8FAFC`, text `#627D98`, font size `13px`, font weight `600`, text-transform none, padding `12px 16px`, bottom border `1px solid #E3E8EF`.
- **Data Rows**: Background `#FFFFFF`, padding `14px 16px`, border-bottom `1px solid #E3E8EF`, text `#102A43`, font-size `14px`. Hover: `#F8FAFC`.

### Inventory Stock Alert Cards
- Compact horizontal cards with `#FFFFFF` background, border `1px solid #E3E8EF`, border-radius `16px`, padding `12px`.
- Left-aligned thumbnail: `56px × 56px`, border-radius `10px`, object-fit cover, subtle gray frame.
- Right content: Item title (`14px`, bold), stock caption (`12px`, `#627D98`), and bottom-aligned status badge pill.

### Iconography Rules
- Single icon family: **Lucide Icons**.
- Stroke width: Strictly `1.8px` to `2.0px`.
- Standard operational size: `20px × 20px` (navigation and table actions), `16px × 16px` (inside buttons and badges).