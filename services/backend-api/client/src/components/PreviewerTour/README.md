# Previewer Tour Component

This tour component provides a guided walkthrough for first-time users of the Message Previewer interface.

## Features

- **Automatic activation**: Shows automatically for users who haven't seen the tour before
- **Local storage persistence**: Remembers tour completion status using localStorage
- **Manual reset**: Users can retake the tour using the "Take Tour" button
- **Responsive positioning**: Tour tooltips automatically adjust position to stay within viewport
- **Keyboard accessibility**: Supports keyboard navigation and screen readers
- **Focus overlay**: Dims the rest of the UI and highlights the focused element with a pulsing border
- **Smooth animations**: Uses framer-motion for polished transitions and effects

## Tour Steps

The tour walks users through four key areas:

1. **Components Section** - Explains the component tree on the left panel
2. **Add Component Button** - Shows how to add new components to messages 
3. **Properties Panel** - Describes the properties panel on the right
4. **Problems Section** - Explains the validation problems area

## Usage

The tour is automatically integrated into the Previewer component. No additional setup is required.

### Manual Tour Trigger

Users can manually start the tour by clicking the "Take Tour" button in the top bar of the Previewer interface.

### Programmatic Control

```typescript
import { usePreviewerTour } from "../hooks";

const MyComponent = () => {
  const { hasCompletedTour, resetTour, markTourCompleted } = usePreviewerTour();
  
  // Check if user has completed tour
  if (hasCompletedTour) {
    // User has seen the tour
  }
  
  // Reset tour to show again
  resetTour();
  
  // Mark tour as completed
  markTourCompleted();
};
```

## Tour Targets

Components are targeted using `data-tour-target` attributes:

- `data-tour-target="components-section"` - Components tree panel
- `data-tour-target="add-component-button"` - New component button
- `data-tour-target="properties-panel"` - Properties configuration panel  
- `data-tour-target="problems-section"` - Validation problems section

## Customization

Tour steps are defined in `PREVIEWER_TOUR_STEPS` and can be modified to add, remove, or change tour content:

```typescript
export const PREVIEWER_TOUR_STEPS: TourStep[] = [
  {
    id: "components-section",
    target: "[data-tour-target='components-section']",
    title: "Message Components",
    content: "This is where you can view and manage...",
    placement: "right",
    offset: { x: 20, y: 0 },
  },
  // ... more steps
];
```

## Implementation Details

- Built with Chakra UI components for consistent styling
- Uses framer-motion for smooth animations and focus effects
- Responsive design adapts to different screen sizes
- Tour state persisted in localStorage with key `previewer-tour-completed`
- Automatically handles scroll and resize events to keep tooltips positioned correctly
- Dark overlay (blackAlpha.700) dims background UI for better focus
- Pulsing blue border highlights the current tour target with animated shadow
- Multi-layered z-index system ensures proper stacking (overlay: 9998, highlight: 9999, tooltip: 10000)