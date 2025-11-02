# Hierarchical Todo List Application

A full-stack React application for managing hierarchical task lists with drag-and-drop functionality. Built with TypeScript, Firebase, and modern React patterns.

## Overview

This application provides a Kanban-style task management system where users can:
- Organize tasks into multiple lists (columns)
- Create hierarchical subtasks with a maximum depth constraint
- Drag and drop items within and across lists
- Manage tasks with features like completion tracking, collapsing, and reordering

The application uses Firebase Authentication for user management and Firestore for real-time data persistence with offline support.

## Features

### Core Functionality
- **Multiple Lists**: Create, rename, and delete task lists that can be reordered via drag-and-drop
- **Hierarchical Items**: Tasks can have subtasks up to a configurable maximum depth (default: 4 levels)
- **Real-time Synchronization**: All changes are persisted to Firebase Firestore and synchronized across devices
- **Offline Support**: Firebase multi-tab IndexedDB persistence enables offline functionality

### Task Management
- **CRUD Operations**: Create, read, update, and delete tasks and entire subtrees
- **Completion Tracking**: Mark tasks as complete/incomplete
- **Collapsible Subtrees**: Expand/collapse subtasks to manage visual complexity
- **Inline Editing**: Edit task titles directly in the list
- **Keyboard Navigation**: Indent/outdent tasks and move them up/down within sibling groups

### Drag and Drop
- **List Reordering**: Drag lists horizontally to reorder them
- **Item Reparenting**: Move items between different parent containers within the same list
- **Cross-list Moves**: Drag items between different lists
- **Visual Feedback**: Drop zones and drag overlays provide clear visual feedback during operations
- **Optimistic Updates**: UI updates immediately before server confirmation for responsive interactions

### User Experience
- **Authentication**: Sign in/sign up with email and password
- **Protected Routes**: Application routes require authentication
- **Loading States**: Loading indicators during data fetches
- **Error Handling**: Graceful error handling with user feedback

## Tech Stack

### Frontend
- **React 19** - UI library with modern hooks and patterns
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **@dnd-kit** - Accessible drag-and-drop library
- **React Router** - Client-side routing

### Backend
- **Firebase Authentication** - User authentication
- **Cloud Firestore** - NoSQL database with real-time subscriptions
- **Firebase Analytics** (optional) - Usage analytics

## Project Structure

```
src/
├── App.tsx                 # Main application component with drag-and-drop orchestration
├── main.tsx               # Application entry point and routing setup
├── types.ts               # TypeScript type definitions (List, Item, MAX_DEPTH)
│
├── components/            # React UI components (see components/README.md)
│   ├── Board.tsx         # Horizontal scrollable container for lists
│   ├── SortableListColumn.tsx  # Sortable wrapper for ListColumn
│   ├── ListColumn.tsx    # List container with header and item display
│   ├── TreeItem.tsx      # Recursive tree item component
│   ├── DragOverlayContent.tsx  # Drag preview components
│   ├── DropSlot.tsx      # Drop zone indicators
│   ├── Loading.tsx       # Loading spinner component
│   └── ...
│
├── hooks/                 # Custom React hooks for data management
│   ├── useLists.ts       # List CRUD operations and subscriptions
│   └── useItems.ts       # Item CRUD operations and subscriptions
│
├── services/              # Firebase service layer
│   ├── auth.ts           # Authentication service functions
│   ├── db.ts             # Firestore reference helpers
│   ├── lists.ts          # List database operations
│   └── items.ts          # Item database operations (includes complex reparenting logic)
│
├── auth/                  # Authentication context and hooks
│   ├── AuthProvider.tsx  # Authentication context provider
│   └── useAuth.ts        # Authentication hook
│
├── pages/                 # Route components
│   └── SignIn.tsx        # Sign in/sign up page
│
└── routes/                # Route utilities
    └── RequireAuth.tsx   # Protected route wrapper
```

## Architecture

### Separation of Concerns

The codebase follows a clear separation of concerns:

1. **Components** (`src/components/`): Presentational and interactive UI components
   - Focus on rendering and user interaction
   - Receive data and callbacks via props
   - No direct knowledge of Firebase or data structures

2. **Hooks** (`src/hooks/`): Data management and state synchronization
   - Subscribe to Firebase real-time updates
   - Provide React hooks interface for components
   - Handle loading states and coordinate service calls

3. **Services** (`src/services/`): Database and authentication operations
   - Pure functions for Firebase operations
   - Handle batch writes, queries, and complex operations (e.g., reparenting subtrees)
   - No React dependencies

4. **Auth** (`src/auth/`): Authentication context and utilities
   - Provides authentication state to the application
   - Wraps Firebase Auth with React context

### Data Flow

1. **User Action** → Component calls handler (e.g., `onToggleComplete`)
2. **Handler** → Hook function (e.g., `toggleComplete` from `useItems`)
3. **Hook** → Service function (e.g., `toggleComplete` from `services/items.ts`)
4. **Service** → Firebase Firestore operation
5. **Firebase** → Real-time subscription triggers hook update
6. **Hook State** → Component re-renders with new data

### Key Design Decisions

1. **Real-time Subscriptions**: Uses Firestore `onSnapshot` for real-time updates rather than polling or manual refresh
2. **Optimistic Updates**: UI updates immediately during drag-and-drop operations, then reconciles when server confirms
3. **Batch Operations**: Complex operations (e.g., reparenting subtrees) use Firestore batch writes for atomicity
4. **Path-based Hierarchy**: Items store their ancestor path for efficient subtree queries and cycle prevention
5. **Separation of Sortable/ListColumn**: `SortableListColumn` wraps `ListColumn` to separate drag-and-drop concerns from presentation

## Setup Instructions

### Installation

1. Extract the zip file to your desired location

2. Navigate to the project directory:
```bash
cd Todo-list
```

3. Install dependencies:
```bash
npm install
```

4. Start the development server:
```bash
npm start
```

The application will open in your browser at `http://localhost:5173` (or the port shown in the terminal).

> **Note**: The `.env` file with Firebase configuration is included in the zip and should work out of the box. No additional Firebase setup is required.

## Key Implementation Details

### Hierarchical Item Structure

Items maintain their hierarchy through:
- `parentId`: Direct parent reference (null for root items)
- `path`: Array of ancestor IDs (excludes self, includes all ancestors)
- `listId`: The list containing the item

This structure enables:
- Efficient subtree queries using `array-contains` on the `path` field
- Cycle prevention during reparenting operations
- Depth calculations for maximum depth enforcement

### Drag and Drop Implementation

The drag-and-drop system uses `@dnd-kit` and handles:
- **List reordering**: Simple array move operations
- **Item reordering**: Within same parent (sibling reordering)
- **Item reparenting**: Moving items to different parents or lists, including:
  - Path recalculation for the moved item and all descendants
  - Order recalculation for both source and target sibling groups
  - Batch writes to ensure atomicity

### Optimistic Updates

During drag operations:
1. UI immediately updates with optimistic state
2. Server operation executes in background
3. When Firestore snapshot arrives, optimistic state is cleared
4. If server state matches optimistic state, no additional re-render needed

## Development Notes

- Maximum depth is configurable via `MAX_DEPTH` constant in `src/types.ts`
- All Firebase operations are wrapped in try-catch blocks for error handling
- The application uses React Router for client-side routing
- Tailwind CSS provides utility-first styling with a dark theme
- TypeScript strict mode ensures type safety throughout the codebase
