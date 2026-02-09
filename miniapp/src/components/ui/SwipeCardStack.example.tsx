import { FC } from 'react';
import { SwipeCardStack, SwipeCard } from './SwipeCardStack';
import './SwipeCardStack.example.css';

// Example card data structure
interface ExampleCardData extends SwipeCard {
  id: number;
  title: string;
  description: string;
  imageUrl?: string;
}

export const SwipeCardStackExample: FC = () => {
  // Sample card data
  const sampleCards: ExampleCardData[] = [
    {
      id: 1,
      title: 'Card 1',
      description: 'This is the first card. Swipe right to like, left to skip!',
    },
    {
      id: 2,
      title: 'Card 2',
      description: 'Another card to explore. Keep swiping!',
    },
    {
      id: 3,
      title: 'Card 3',
      description: 'You are doing great! More cards ahead.',
    },
    {
      id: 4,
      title: 'Card 4',
      description: 'Almost there! Just a few more.',
    },
    {
      id: 5,
      title: 'Card 5',
      description: 'Last card! What will you choose?',
    },
  ];

  const handleSwipeLeft = (card: SwipeCard) => {
    console.log('Swiped left (skipped):', card);
  };

  const handleSwipeRight = (card: SwipeCard) => {
    console.log('Swiped right (liked):', card);
  };

  const handleEnd = () => {
    console.log('All cards have been swiped!');
    alert('You have finished all cards!');
  };

  // Custom card renderer
  const renderCard = (card: SwipeCard, index: number) => {
    const cardData = card as ExampleCardData;

    return (
      <div className="example-card">
        <div className="example-card__header">
          <h2 className="example-card__title">{cardData.title}</h2>
        </div>
        <div className="example-card__body">
          <p className="example-card__description">{cardData.description}</p>
          <div className="example-card__number">{index + 1}</div>
        </div>
        <div className="example-card__footer">
          <div className="example-card__hint">
            <span>← Skip</span>
            <span>Like →</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="swipe-card-stack-example">
      <div className="swipe-card-stack-example__header">
        <h1>Swipe Card Stack Example</h1>
        <p>Swipe left to skip, right to like</p>
      </div>

      <SwipeCardStack
        cards={sampleCards}
        onSwipeLeft={handleSwipeLeft}
        onSwipeRight={handleSwipeRight}
        onEnd={handleEnd}
        renderCard={renderCard}
        maxVisibleCards={4}
        swipeThreshold={100}
      />

      <div className="swipe-card-stack-example__instructions">
        <div className="instruction">
          <div className="instruction__icon">←</div>
          <div className="instruction__text">Swipe left to skip</div>
        </div>
        <div className="instruction">
          <div className="instruction__icon">→</div>
          <div className="instruction__text">Swipe right to like</div>
        </div>
      </div>
    </div>
  );
};
