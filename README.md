# Hierarchical Todo List App

A web application that allows users to create hierarchical todo lists with drag-and-drop functionality, built with React, TypeScript, and Firebase.

## Features

- **Multi-user support**: Each user has their own isolated task data
- **Authentication**: Sign up and sign in with Firebase Auth
- **Multiple Lists**: Create and manage multiple todo lists
- **Hierarchical Tasks**: Create tasks with up to 3 levels of sub-items
- **Drag & Drop**: 
  - Reorder lists horizontally
  - Reorder tasks within lists
  - Move tasks between lists
  - Reparent tasks (change hierarchy)
- **Task Management**:
  - Mark tasks as complete/incomplete
  - Collapse/expand task hierarchies
  - Edit task titles inline
  - Delete tasks and subtrees
- **Real-time Updates**: Changes sync automatically across sessions
- **Optimistic UI**: Immediate visual feedback for all operations

## Installation

### Prerequisites
- Node.js (version 18 or higher)
- npm

### Setup Instructions

1. **Clone/Download the project**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Start the development server:**
   ```bash
   npm start
   ```
4. **Open your browser and navigate to:**
   ```
   http://localhost:5173
   ```

The application will start in development mode with hot reloading enabled.

## Project Structure

```
src/
├── components/          # React components
│   ├── Board.tsx       # Horizontal scrollable container
│   ├── ListColumn.tsx  # Individual list column
│   ├── TreeItem.tsx    # Hierarchical task component
│   ├── DropSlot.tsx    # Drop zones for drag & drop
│   └── ...
├── hooks/              # Custom React hooks
│   ├── useLists.ts     # List data management
│   └── useItems.ts     # Task data management
├── services/           # Firebase services
│   ├── lists.ts        # Firestore operations for lists
│   ├── items.ts        # Firestore operations for tasks
│   └── auth.ts         # Authentication service
├── auth/               # Authentication components
├── types.ts            # TypeScript type definitions
└── App.tsx             # Main application component
```

## Technical Implementation

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Drag & Drop**: @dnd-kit library
- **Backend**: Firebase (Firestore + Auth)
- **State Management**: React hooks with optimistic updates

## Usage

1. **Sign up or sign in** when you first visit the app
2. **Create lists** using the "+ New List" button
3. **Add tasks** using the "+" button in each list
4. **Create subtasks** using the "+" button on any task
5. **Drag and drop** to reorder lists and tasks
6. **Complete tasks** by checking the checkbox
7. **Collapse/expand** task hierarchies using the arrow icons
8. **Edit titles** by clicking directly on list or task names

## MVP Requirements Met

- ✅ Multi-user support with data isolation
- ✅ User authentication (sign up/sign in)
- ✅ Task completion marking
- ✅ Task collapse/expand functionality
- ✅ Move top-level tasks between lists
- ✅ Durable data storage (Firebase Firestore)

## Extensions Implemented

- ✅ Advanced drag & drop for arbitrary task movement
- ✅ Real-time synchronization
- ✅ Optimistic UI updates
- ✅ Configurable nesting depth
- ✅ Visual drop indicators
- ✅ Completed task sections

## Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Browser Support

This application works in all modern browsers that support ES2020+ features.