# Components Directory

This directory contains all React UI components for the application. The components are organized with a focus on **separation of concerns** and **single responsibility**.

## Separation of Concerns

### Component Hierarchy and Responsibilities

#### Container Components (Layout)
- **`Board.tsx`**: Top-level horizontal scrollable container
  - Pure layout component
  - No business logic
  - Provides structure for list columns

#### List Components
- **`SortableListColumn.tsx`**: Wrapper that adds drag-and-drop capabilities
  - **Responsibility**: Drag-and-drop integration for lists
  - Uses `@dnd-kit/sortable` to make lists draggable
  - Wraps `ListColumn` and passes drag handle props
  - **Why separate?** Keeps drag-and-drop logic isolated from presentation

- **`ListColumn.tsx`**: Presentational component for a single list
  - **Responsibility**: Rendering list header and task tree structure
  - Manages list-level UI state (renaming, completed section visibility)
  - Renders root-level items and organizes completed/active separation
  - Delegates item rendering to `TreeItem`
  - **Why separate?** Focuses solely on list presentation, not drag-and-drop mechanics

#### Item Components
- **`TreeItem.tsx`**: Recursive component for hierarchical task items
  - **Responsibility**: Rendering individual items and their subtrees
  - Handles item-level interactions (complete, collapse, edit, delete)
  - Recursively renders children using itself
  - Manages visual indentation based on depth
  - Integrates with `@dnd-kit` for item-level drag-and-drop
  - **Why separate?** Encapsulates the recursive tree structure and item logic

#### Drag and Drop Utilities
- **`DragOverlayContent.tsx`**: Drag preview components
  - **Responsibility**: Visual feedback during drag operations
  - Provides `ListOverlay` and `ItemSubtreeOverlay` for drag previews
  - Read-only renderings that match the dragged content
  - **Why separate?** Drag overlays are a distinct concern from main UI rendering

- **`DropSlot.tsx`**: Visual drop zone indicators for items
  - **Responsibility**: Showing where items can be dropped within lists
  - Appears between sortable items during drag operations
  - Provides visual feedback for valid drop targets
  - **Why separate?** Drop zone logic is independent of item/list rendering

- **`ListDropSlot.tsx`**: Visual drop zone indicators for lists
  - **Responsibility**: Showing where lists can be dropped during reordering
  - Appears between sortable lists during drag operations
  - Used for horizontal list reordering
  - **Why separate?** List-level drop zones are distinct from item-level drop zones

#### Utility Components
- **`Loading.tsx`**: Loading state indicator
  - **Responsibility**: Reusable loading spinner
  - Can be used throughout the application
  - **Why separate?** Reusable UI component with single purpose

- **`Checkbox.tsx`**: Custom checkbox component
  - **Responsibility**: Styled checkbox for task completion
  - Consistent styling and behavior
  - **Why separate?** Reusable form control component

- **`Sidebar.tsx`**: Sidebar navigation component (currently not used in main app)
  - **Responsibility**: Alternative list navigation and management interface
  - Provides sidebar-based list selection and management
  - **Why separate?** Could be used for alternative navigation patterns if needed

## Design Principles

### 1. Single Responsibility
Each component has one clear purpose:
- `Board` → Layout container
- `SortableListColumn` → Drag-and-drop wrapper
- `ListColumn` → List presentation
- `TreeItem` → Item tree rendering

### 2. Prop Drilling vs Context
- Components receive data and callbacks via props (prop drilling)
- No global state management library needed
- Keeps data flow explicit and traceable
- Component dependencies are clear from prop signatures

### 3. Presentation vs Logic Separation
- **Presentation Components**: `ListColumn`, `TreeItem`, `Board` focus on rendering
- **Logic Components**: `SortableListColumn` adds behavior (drag-and-drop)
- Business logic (data operations) lives in hooks (`useLists`, `useItems`), not components

### 4. Composition over Inheritance
- Components compose together (e.g., `SortableListColumn` wraps `ListColumn`)
- Reusable components can be combined in different ways
- No class inheritance; functional components throughout

### 5. Controlled Components
- All form inputs are controlled (value managed by parent state)
- No internal component state for user input
- Makes data flow predictable and testable

## Component Interaction Flow

```
App.tsx
  ├── Board
  │     ├── ListDropSlot (between lists)
  │     └── SortableListColumn (wraps ListColumn)
  │           └── ListColumn
  │                 ├── TreeItem (recursive)
  │                 │     ├── Checkbox
  │                 │     ├── DropSlot (between items)
  │                 │     └── TreeItem (children, recursive)
  │                 └── DropSlot (between items)
  └── DragOverlay
        ├── ListOverlay (uses ListColumn)
        └── ItemSubtreeOverlay (uses TreeItem-like structure)
```

## Benefits of This Structure

1. **Testability**: Each component can be tested in isolation
2. **Maintainability**: Changes to drag-and-drop don't affect presentation components
3. **Reusability**: `ListColumn` can be used with or without sortable wrapper
4. **Readability**: Clear component boundaries make code easier to understand
5. **Scalability**: Easy to add new features without modifying existing components

## Key Patterns

### Wrapper Pattern
`SortableListColumn` wraps `ListColumn` to add drag-and-drop without modifying the presentation component. This follows the **Higher-Order Component** pattern conceptually (though implemented as composition).

### Recursive Pattern
`TreeItem` calls itself recursively to render subtrees, maintaining the tree structure in the component tree.

### Container/Presentational Pattern
- Container: `Board`, `SortableListColumn` (orchestrate behavior)
- Presentational: `ListColumn`, `TreeItem` (focus on rendering)

This separation allows presentation components to be reused in different contexts (e.g., in drag overlays or different layouts).

