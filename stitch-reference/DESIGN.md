---
name: Autonomous PR Remediation Interface
colors:
  surface: '#0d141d'
  surface-dim: '#0d141d'
  surface-bright: '#333a44'
  surface-container-lowest: '#080f17'
  surface-container-low: '#151c25'
  surface-container: '#192029'
  surface-container-high: '#232a34'
  surface-container-highest: '#2e353f'
  on-surface: '#dce3f0'
  on-surface-variant: '#bcc9cd'
  inverse-surface: '#dce3f0'
  inverse-on-surface: '#2a313b'
  outline: '#869397'
  outline-variant: '#3d494c'
  surface-tint: '#4cd7f6'
  primary: '#4cd7f6'
  on-primary: '#003640'
  primary-container: '#06b6d4'
  on-primary-container: '#00424f'
  inverse-primary: '#00687a'
  secondary: '#d0bcff'
  on-secondary: '#3c0091'
  secondary-container: '#571bc1'
  on-secondary-container: '#c4abff'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#1bbd85'
  on-tertiary-container: '#00452e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#acedff'
  primary-fixed-dim: '#4cd7f6'
  on-primary-fixed: '#001f26'
  on-primary-fixed-variant: '#004e5c'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0d141d'
  on-background: '#dce3f0'
  surface-variant: '#2e353f'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: -0.005em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  caption:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  code-lg:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  code-badge:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-base: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  gutter-terminal: 0.75rem
  gutter-pane: 1.25rem
  sidebar-width: 260px
  diff-meta-width: 320px
---

## Brand & Style

The design system projects surgical precision, absolute operational reliability, and hyper-focused engineering intelligence. Designed for autonomous code repair loops, continuous integration agents, and elite development teams, the interface removes friction and reduces cognitive load during high-stakes pull request failures.

The aesthetic fuses **Modern Technical Minimalism** with **Developer Infrastructure Elegance** (drawing cues from Linear, Vercel, and Raycast). Surfaces are pitch black, quiet, and structured; information hierarchy is dictated by micro-borders, razor-sharp typography, and high-fidelity status lights. The feeling is that of a mission control terminal inside an automated repair bay: surgical, deterministic, and silent.

## Colors

The palette leverages an obsidian tonal architecture paired with surgical diagnostics accents:

### Surfaces & Neutrals
- **Canvas Base (`#050505`)**: The infinite ground plane for the entire application viewport.
- **Surface Elevation 1 (`#0a0a0a`)**: Base card containers, sidebar panels, and terminal backgrounds.
- **Surface Elevation 2 (`#111111`)**: Nested panes, unified diff containers, and code review blocks.
- **Surface Hover / Active (`#18181b`)**: Interactive row hover, dropdown items, and control button backings.
- **Structural Borders (`#1f242c` / `#222222`)**: 1px crisp separation strokes separating panes and table cells without harsh optical contrast.

### Typography Levels
- **Primary Text (`#f3f4f6`)**: Crisp slate-white for headlines, active PR branches, and diff code lines.
- **Secondary Text (`#9ca3af`)**: Neutral gray for metadata, timestamps, telemetry labels, and commit SHAs.
- **Muted Text (`#4b5563`)**: De-emphasized gutter numbers, structural delimiters, and disabled states.

### State & Diagnostic Accents
- **Surgical Cyan (`#06b6d4`)**: Active automation sweeps, real-time patches, and targeted AST analysis nodes.
- **Healed / Verified Emerald (`#10b981`)**: Suture loops passed, CI green, and PR ready-to-merge state.
- **Neural Violet (`#8b5cf6` / `#6366f1`)**: Autonomous reasoning engines, LLM patch synthesis, and AST refactor generation.
- **Critical Failure Crimson (`#ef4444` / `#f43f5e`)**: Broken builds, failed assertions, stack traces, and unresolvable merge conflicts.
- **Diagnostic Warning Amber (`#f59e0b`)**: Flaky test suites, retry timeouts, and heuristic warnings.

## Typography

The type system separates natural language cognition from machine execution:

- **Inter** handles narrative interaction, navigation, panel titles, settings, and descriptive error explanations. Dense tracking (`-0.025em` on displays down to `-0.005em` on body copy) creates a compact, technical presence.
- **JetBrains Mono** governs all deterministic output: unified diff chunks, AST node identifiers, commit SHAs, terminal output, CI logs, and telemetry badges. Monospaced elements must always be rendered with explicit tabular lining and subpixel anti-aliasing.

## Layout & Spacing

The layout is built upon an engineering workbench framework using a multi-pane fixed docking system with fluid data canvases:

- **Primary Workbench Model**: High-density 3-pane workbench (collapsible navigation tree on the left, primary diff/terminal canvas in center, and contextual remediation inspector on the right).
- **Rhythm**: Compact 4px base increment. Data tables and code streams favor tight vertical padding (`space-xs` to `space-sm`) to maximize code viewable above the fold.
- **Responsive Adaptations**:
  - **Desktop (>1440px)**: Full tri-pane view (tree, split-diff canvas, AST/AI inspector) simultaneously visible.
  - **Laptop (1024px–1439px)**: Inspector docks as a tabbed overlay or slides over the canvas; unified diff mode replaces side-by-side diff.
  - **Mobile (<1024px)**: Single column stacked layout. Navigation collapses into a command menu drawer; diffs collapse to full-width inline changes with horizontal scroll support on code spans.

## Elevation & Depth

This design system avoids traditional heavy dropshadows, relying instead on **Tonal Stratification and Micro-Border Occlusion**:

1. **Floor (Elevation 0 - `#050505`)**: Global canvas background.
2. **Panel (Elevation 1 - `#0a0a0a`)**: Contained via a 1px continuous border (`#1f242c`).
3. **Card / Diff Segment (Elevation 2 - `#111111`)**: Nested with 1px border (`#222222`).
4. **Floating Popovers / Command Palettes (Elevation 3 - `#141416`)**:
   - Border: 1px solid `#2d333b`.
   - Shadow: `0 12px 32px -4px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.04) inset`.
5. **AI Repair Glow**: When an automated loop is compiling or synthesizing, an interior pseudo-gradient line (`linear-gradient(90deg, transparent, #06b6d4, #8b5cf6, transparent)`) runs along the top 1px border of the container, simulating real-time activity without visual clutter.

## Shapes

The interface employs tight, structural corner radii suited for professional developer interfaces:

- **Base Radius (6px / `rounded-sm`)**: Applied to inline badges, inputs, buttons, tree items, and individual diff blocks.
- **Container Radius (8px / `rounded-md`)**: Applied to cards, panels, popover menus, and terminal windows.
- **Dialog Radius (10px / `rounded-lg`)**: Applied to top-level modal dialogs and the command palette.
- **Pill Badges (9999px)**: Reserved strictly for live pulse indicators and machine state pills.

## Components

### Buttons & Action Bars
- **Primary Action (Surgical / Remediate)**: Solid `#06b6d4` background with `#050505` bold text. Hover: `#22d3ee`. Active: scales down to `0.98`.
- **Secondary / Neutral Action**: Background `#111111` with 1px border `#222222` and `#f3f4f6` text. Hover: Background `#18181b` and border `#374151`.
- **Ghost Action**: Transparent background, `#9ca3af` text. Hover: `#18181b` with `#f3f4f6` text.

### Unified Diff & Patch Blocks
- **Container**: Elevation 2 background (`#111111`) with `#1f242c` perimeter stroke and `rounded-md`.
- **Gutter**: Monospaced line numbers in `code-sm`, right-aligned, text color `#4b5563`.
- **Additions**: Background `rgba(16, 185, 129, 0.08)`, text `#34d399`, gutter prefix `+` in `#10b981`.
- **Deletions**: Background `rgba(239, 68, 68, 0.08)`, text `#f87171`, gutter prefix `-` in `#ef4444`.
- **Automated Suture Replacement**: Highlighted in `rgba(6, 182, 212, 0.1)` with a 2px left border in `#06b6d4`.

### Chips & Telemetry Badges
- **Status Badges**: JetBrains Mono `code-badge` (11px). Padded `2px 6px` with 4px border radius.
  - *Healed*: Border `1px solid rgba(16, 185, 129, 0.3)`, text `#10b981`, background `rgba(16, 185, 129, 0.05)`.
  - *Synthesizing*: Border `1px solid rgba(139, 92, 246, 0.3)`, text `#a78bfa`, background `rgba(139, 92, 246, 0.05)`.
  - *Failing*: Border `1px solid rgba(239, 68, 68, 0.3)`, text `#f87171`, background `rgba(239, 68, 68, 0.05)`.

### Terminal Logs & AST Nodes
- High-contrast console window with pure `#080808` ground.
- Strict monospaced font with `0.75rem` padding.
- Search highlights rendered in translucent warning amber (`rgba(245, 158, 11, 0.25)`).

### Input Fields & Search Bars
- Background `#0a0a0a`, border 1px solid `#1f242c`, height 32px for compact mode, 36px for regular.
- Focus state: Border transitions to `#06b6d4` with an inner ring `0 0 0 1px #06b6d4`. Text in `#f3f4f6`. Placeholder in `#4b5563`.