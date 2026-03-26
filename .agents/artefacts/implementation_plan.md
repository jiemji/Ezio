# Implementation Plan - Phase 2 (Fix): Editor Expansion

The goal is to fix the issue where the editor (footer) remains at its minimum width instead of expanding to its 1024px target. This is caused by the `fit-content` property on the card parent, which defaults to the minimum required width unless a larger base width is specified for children.

## User Review Required

> [!IMPORTANT]
> - **Width Overrides**: I will set an explicit `width: 1024px` and `flex-grow: 1` on the footer to force it to attempt its maximum size.
> - **Responsiveness**: The `dlv-card` will be capped at `max-width: 100%` of the viewport to ensure it doesn't overflow on small screens while still allowing full expansion on large screens.

## Proposed Changes

### CSS Styles
#### [MODIFY] [style_deliveries.css](file:///g:/devapps/Ezio/css/style_deliveries.css)
- `.dlv-card`: Add `max-width: 100%;`.
- `.dlv-card-content > .dlv-card-footer`:
    - Add `width: 1024px;` (to provide a base for `fit-content` calculation).
    - Ensure `flex: 1 1 1024px;`.
    - Maintain `min-width: 500px` and `max-width: 1024px`.

## Verification Plan

### Automated Tests
- **DISABLED** as per user request.

### Manual Verification
- Verify that on a large screen, the editor expands to 1024px.
- Confirm that the whole card remains centered.
- Check that the configuration panel still toggles correctly and the card shrinks accordingly.
