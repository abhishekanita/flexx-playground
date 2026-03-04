# Coding Style Guide

This document outlines the coding patterns, conventions, and architectural decisions used in this React TypeScript project.

## Project Architecture Overview

**Product**: Limitless - A collaborative workplace platform with features for channels, agents, artifacts, video calls, and project management. Built as a modern React application with real-time capabilities.

## Feature Organization

### Feature-Based Folder Structure

Each feature follows a consistent folder structure within `src/features/`:

```
features/
├── [feature-name]/
│   ├── components/          # UI components specific to this feature
│   │   ├── [sub-feature]/   # Grouped by functionality
│   │   └── ...
│   ├── containers/          # Container components with business logic
│   ├── hooks/               # Custom hooks for this feature
│   ├── pages/               # Page components (route handlers)
│   ├── services/            # API services and external integrations
│   ├── store/               # State management (Jotai/Zustand stores)
│   ├── types/               # TypeScript type definitions
│   └── index.ts             # Feature exports
```

**Examples of features**: `agents`, `channels`, `workplace`, `artifacts`, `video`, `auth`, `dashboard`

## State Management Strategy

### React Query First Approach

-   **Primary choice**: Use `@tanstack/react-query` for server state management
-   **Configuration**: Queries have `staleTime: Infinity` and `retry: false` by default
-   **Pattern**: When using React Query, avoid additional state stores like Jotai/Zustand

### Zustand for Client State

-   Used for complex client-side state that needs to be shared across components
-   Pattern: Create typed stores with actions object
-   Export individual selector hooks for better performance

```typescript
// Example Zustand pattern
export const useChannelStore = create<ChannelState>((set, get) => ({
    channelId: '',
    channelType: 'named',
    channel: null,
    actions: {
        setChannelId: (channelId: string) => set({ channelId }),
        setChannelType: channelType => set({ channelType }),
        setChannel: channel => set({ channel }),
    },
}));

// Export individual selectors
export const useChannelId = () => useChannelStore(state => state.channelId);
export const useChannelStoreActions = () => useChannelStore(state => state.actions);
```

### Jotai for Simple Atoms

-   Used sparingly for simple global state
-   Typically for presence/status indicators or simple flags
-   Pattern: Create atoms with descriptive names

```typescript
export const membersPresenceAtom = atom<Record<string, { isOnline: boolean }>>({});
```

## Naming Conventions

### Files and Folders

-   **Components**: PascalCase (`UserAvatar.tsx`, `ChannelHeader.tsx`)
-   **Hooks**: camelCase with `use` prefix (`useChannelActions.ts`, `useAgentChat.tsx`)
-   **Services**: camelCase with `.service.ts` suffix (`workplace.service.ts`)
-   **Types**: camelCase with `.types.ts` suffix (`auth.types.ts`)
-   **Stores**: camelCase with `.store.ts` suffix (`channel.store.ts`)
-   **Pages**: camelCase with `.page.tsx` suffix (`channel.page.tsx`)

### Code Conventions

-   **Interfaces**: PascalCase with `I` prefix for data interfaces (`IAgentMessage`, `IAgentConversation`)
-   **Types**: PascalCase (`ChannelState`, `WorkplaceMember`)
-   **Constants**: SCREAMING_SNAKE_CASE (when applicable)
-   **Variables/Functions**: camelCase

### Component Organization

-   Group related components in subdirectories by functionality
-   Use descriptive names that indicate purpose
-   Example: `channels/components/channel/actions/` contains all channel action dialogs

## Common Utilities and Hooks

### Global Hooks (`src/hooks/`)

-   `useDebounce<T>(value: T, delay = 500)` - Debounce values with customizable delay
-   `useLocalStorage<T>(key: string, initialValue: T)` - Persistent local storage with type safety
-   `useAuthTokens()` - Access authentication tokens
-   `useMobile()` - Detect mobile devices
-   `useUploadFile()` - File upload functionality

### Utility Functions (`src/utils/`)

-   `localstorage.ts` - Safe localStorage operations with SSR support
-   `validation.ts` - Common validation functions (e.g., `isValidEmail`)
-   `files.tsx` - File handling utilities

### UI Utilities (`src/lib/`)

-   `utils.ts` - Contains `cn()` function for className merging using `clsx` and `tailwind-merge`
-   `axios.ts` - Configured axios instance
-   `react-query.ts` - React Query client configuration

## Service Layer Pattern

### API Services

Services follow a consistent object pattern:

```typescript
export const workplaceService = {
    get: async () => {
        const response = await axios.get('/workplace');
        return response.data;
    },
    create: async (data: any) => {
        const response = await axios.post('/workplace/new', data);
        return response.data;
    },
    // ... other methods
};
```

### Hook Integration

Services are consumed through React Query hooks:

```typescript
export const useWorkplace = () => {
    const { data: workplace, isLoading } = useQuery({
        queryKey: ['workplace'],
        queryFn: () => workplaceService.get(),
    });
    return { workplace, isLoading };
};
```

## Technology Stack

### Core Libraries

-   **React 19.1.0** - UI framework
-   **TypeScript** - Type safety
-   **Vite** - Build tool and development server
-   **Tailwind CSS 4.x** - Styling with custom theme system

### State Management

-   **@tanstack/react-query 5.x** - Server state management
-   **Zustand 5.x** - Client state management
-   **Jotai 2.x** - Simple atomic state

### UI Components

-   **Radix UI** - Headless component primitives
-   **Lucide React** - Icon library
-   **Framer Motion** - Animations
-   **Sonner** - Toast notifications

### Rich Text Editing

-   **Plate.js (v49)** - Comprehensive rich text editor
-   **Slate.js** - Underlying editor framework

### Real-time Features

-   **Socket.io Client** - WebSocket communication
-   **Stream Chat React** - Chat functionality
-   **Stream Video React SDK** - Video calling
-   **Liveblocks** - Real-time collaboration

### Specialized Libraries

-   **@ai-sdk/react** - AI integration
-   **Axios** - HTTP client
-   **React Router DOM** - Client-side routing
-   **Zod** - Schema validation
-   **date-fns/dayjs** - Date manipulation

## Code Style Preferences

### Component Structure

1. Import statements (external libraries first, then internal)
2. Type definitions
3. Component implementation
4. Export statements

### State Management Decision Tree

1. **Server data** → Use React Query
2. **Complex shared client state** → Use Zustand
3. **Simple global flags/atoms** → Use Jotai
4. **Component-local state** → Use useState

### Conditional Logic

-   Prefer early returns over nested conditionals
-   Use optional chaining and nullish coalescing operators
-   Keep components focused and single-purpose

### Performance Considerations

-   Use `useShallow` from Zustand when selecting multiple values
-   Implement proper memoization for expensive calculations
-   Lazy load components and features when appropriate

## Project-Specific Patterns

### Socket Integration

-   Features include optimized socket integration with persistent subscriptions
-   Custom hooks like `useAutoProject()` and `useAutoSession()` manage real-time data
-   Subscriptions persist across navigation for performance

### Theme System

-   Multiple built-in themes: `claude`, `ghibli`, `modern`, `slack`, `vs-code`
-   Theme switching capability built into workplace settings

### Editor Integration

-   Extensive rich text editing capabilities with Plate.js
-   Custom nodes for mentions, slash commands, media, tables, etc.
-   AI-powered features integrated directly into the editor

### Authentication

-   Token-based authentication with refresh capabilities
-   Google OAuth integration
-   Email OTP authentication flow

## Development Workflow

### Build Commands

-   `npm run dev` - Development server
-   `npm run build` - Production build
-   `npm run lint` - ESLint checking
-   `npm run format` - Prettier formatting

### Environment Support

-   Development, staging, and production build modes
-   Environment-specific configurations

This style guide reflects the current codebase patterns and should be followed for consistency when adding new features or modifying existing code.
