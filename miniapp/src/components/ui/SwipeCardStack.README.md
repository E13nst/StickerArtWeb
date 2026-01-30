# SwipeCardStack Component

A beautiful and interactive swipe card stack component built with React and Framer Motion. Perfect for creating Tinder-like card swiping experiences.

## Features

- 🎨 **Smooth Animations**: Powered by Framer Motion for fluid swipe gestures
- 📱 **Touch & Mouse Support**: Works on both mobile and desktop
- 🎯 **Customizable**: Flexible rendering and styling options
- 🔔 **Toast Notifications**: Built-in success/error feedback
- 📚 **Card Stacking**: Shows 3-4 cards at once with depth effect
- ⚡ **TypeScript Support**: Full type safety

## Installation

The component is already part of the UI library. Import it:

```tsx
import { SwipeCardStack } from '@/components/ui';
```

## Basic Usage

```tsx
import { SwipeCardStack, SwipeCard } from '@/components/ui/SwipeCardStack';

interface MyCard extends SwipeCard {
  id: number;
  title: string;
  content: string;
}

function MyComponent() {
  const cards: MyCard[] = [
    { id: 1, title: 'Card 1', content: 'Content 1' },
    { id: 2, title: 'Card 2', content: 'Content 2' },
    { id: 3, title: 'Card 3', content: 'Content 3' },
  ];

  const handleSwipeLeft = (card: SwipeCard) => {
    console.log('Skipped:', card);
  };

  const handleSwipeRight = (card: SwipeCard) => {
    console.log('Liked:', card);
  };

  const handleEnd = () => {
    console.log('All cards swiped!');
  };

  const renderCard = (card: SwipeCard) => {
    const myCard = card as MyCard;
    return (
      <div style={{ padding: 20 }}>
        <h2>{myCard.title}</h2>
        <p>{myCard.content}</p>
      </div>
    );
  };

  return (
    <SwipeCardStack
      cards={cards}
      onSwipeLeft={handleSwipeLeft}
      onSwipeRight={handleSwipeRight}
      onEnd={handleEnd}
      renderCard={renderCard}
    />
  );
}
```

## Props

### SwipeCardStackProps

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `cards` | `SwipeCard[]` | Yes | - | Array of card objects to display |
| `onSwipeLeft` | `(card: SwipeCard) => void` | Yes | - | Callback when card is swiped left (skip) |
| `onSwipeRight` | `(card: SwipeCard) => void` | Yes | - | Callback when card is swiped right (like) |
| `onEnd` | `() => void` | Yes | - | Callback when all cards are swiped |
| `renderCard` | `(card: SwipeCard, index: number) => React.ReactNode` | Yes | - | Function to render card content |
| `maxVisibleCards` | `number` | No | `4` | Number of cards visible in stack |
| `swipeThreshold` | `number` | No | `100` | Distance (px) needed to trigger swipe |

### SwipeCard Interface

```typescript
interface SwipeCard {
  id: string | number;
  [key: string]: any; // Your custom properties
}
```

## Animation Details

### Swipe Left (Skip)
- Rotation: `-20deg`
- Translation: `-400px` on X axis
- Opacity: `0`
- Toast: Red "Skipped" message

### Swipe Right (Like)
- Rotation: `20deg`
- Translation: `400px` on X axis
- Opacity: `0`
- Toast: Green "Liked" message

### Card Stack Effect
- Card 1 (top): Scale `1.0`, Y offset `0px` - Fully interactive
- Card 2: Scale `0.95`, Y offset `10px`
- Card 3: Scale `0.90`, Y offset `20px`
- Card 4: Scale `0.85`, Y offset `30px`

## Customization

### Custom Card Styling

Override the CSS classes:

```css
.swipe-card-stack__card {
  border-radius: 24px; /* Custom border radius */
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2); /* Custom shadow */
}
```

### Custom Toast Messages

Modify the toast messages in your swipe handlers:

```tsx
const handleSwipeLeft = (card: SwipeCard) => {
  // Your custom logic
  // Toast will still show "Skipped"
};
```

### Dark Mode Support

The component supports CSS variables for theming:

```css
:root {
  --color-surface: #ffffff;
  --color-text-secondary: #666;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-surface: #1e1e1e;
    --color-text-secondary: #aaa;
  }
}
```

## Example

See `SwipeCardStack.example.tsx` for a complete working example with:
- Custom card design
- Styled container
- Instructions overlay
- Gradient background

## Technical Details

### Dependencies
- `framer-motion` (v11.18.2+)
- `react` (v18.2.0+)

### Motion Values
- `x`: Horizontal drag position
- `rotate`: Rotation based on drag position (-15° to 15°)
- `opacity`: Fades out as card approaches swipe threshold

### Performance
- Cards are rendered only when visible (up to `maxVisibleCards`)
- Animations are hardware-accelerated via Framer Motion
- Touch gestures are optimized for mobile devices

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (iOS 12+, macOS)
- Mobile browsers with touch support

## Tips

1. **Card Data**: Keep card data lightweight for better performance
2. **Images**: Use lazy loading for card images
3. **Threshold**: Adjust `swipeThreshold` based on your card size
4. **Stack Size**: 3-4 cards (`maxVisibleCards`) provides best UX
5. **Feedback**: Use toast notifications to confirm user actions

## Troubleshooting

**Cards not swiping?**
- Check if `drag="x"` is properly set
- Ensure Framer Motion is installed

**Animations stuttering?**
- Reduce number of `maxVisibleCards`
- Optimize your `renderCard` function
- Check for expensive operations in callbacks

**Touch not working on mobile?**
- Ensure `touch-action: none` is set
- Check viewport meta tag in HTML

## License

Part of the StickerArtWeb UI component library.
