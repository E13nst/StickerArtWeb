import { useState, useCallback, useEffect, FC } from 'react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface Collection {
  id: string;
  name: string;
  description: string;
  packs: any[];
  type: 'favorites' | 'recent' | 'recommended' | 'custom';
  icon: string;
  color: string;
  isEditable: boolean;
}

interface PersonalCollectionsProps {
  onCollectionClick: (collection: Collection) => void;
  onPackClick: (pack: any) => void;
  likedPacks: any[];
  recentPacks: any[];
  recommendedPacks: any[];
}

export const PersonalCollections: FC<PersonalCollectionsProps> = ({
  onCollectionClick,
  likedPacks,
  recentPacks,
  recommendedPacks
}) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [customCollections, setCustomCollections] = useState<Collection[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  
  const { hapticClick, hapticSuccess } = useHapticFeedback();

  // Инициализация коллекций
  useEffect(() => {
    const defaultCollections: Collection[] = [
      {
        id: 'favorites',
        name: 'Избранное',
        description: `${likedPacks.length} паков`,
        packs: likedPacks,
        type: 'favorites',
        icon: '❤️',
        color: '#ff6b6b',
        isEditable: false
      },
      {
        id: 'recent',
        name: 'Недавние',
        description: `${recentPacks.length} паков`,
        packs: recentPacks,
        type: 'recent',
        icon: '🕒',
        color: '#4ecdc4',
        isEditable: false
      },
      {
        id: 'recommended',
        name: 'Рекомендуемые',
        description: `${recommendedPacks.length} паков`,
        packs: recommendedPacks,
        type: 'recommended',
        icon: '🎯',
        color: '#45b7d1',
        isEditable: false
      }
    ];

    setCollections(defaultCollections);
  }, [likedPacks, recentPacks, recommendedPacks]);

  // Создание новой коллекции
  const handleCreateCollection = useCallback(() => {
    if (!newCollectionName.trim()) return;

    const newCollection: Collection = {
      id: `custom_${Date.now()}`,
      name: newCollectionName,
      description: '0 паков',
      packs: [],
      type: 'custom',
      icon: '📁',
      color: '#96ceb4',
      isEditable: true
    };

    setCustomCollections(prev => [...prev, newCollection]);
    setNewCollectionName('');
    setIsCreating(false);
    hapticSuccess();
  }, [newCollectionName, hapticSuccess]);

  // Удаление коллекции
  const deleteCollection = useCallback((collectionId: string) => {
    setCustomCollections(prev => prev.filter(collection => collection.id !== collectionId));
    hapticClick();
  }, [hapticClick]);

  // Обработка клика по коллекции
  const handleCollectionClick = useCallback((collection: Collection) => {
    hapticClick();
    onCollectionClick(collection);
  }, [onCollectionClick, hapticClick]);

  const allCollections = [...collections, ...customCollections];

  return (
    <div style={{ padding: '16px' }}>
      {/* Заголовок */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '600',
          color: 'var(--color-text)',
          margin: 0
        }}>
          Мои коллекции
        </h2>
        
        <button
          onClick={() => setIsCreating(true)}
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--color-button)',
            color: 'var(--color-button-text)',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          + Создать
        </button>
      </div>

      {/* Создание новой коллекции */}
      {isCreating && (
        <div style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <input
            type="text"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder="Название коллекции"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              fontSize: '16px',
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text)',
              outline: 'none',
              marginBottom: '12px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateCollection();
              } else if (e.key === 'Escape') {
                setIsCreating(false);
                setNewCollectionName('');
              }
            }}
            autoFocus
          />
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCreateCollection}
              disabled={!newCollectionName.trim()}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--color-button)',
                color: 'var(--color-button-text)',
                border: 'none',
                borderRadius: '8px',
                cursor: newCollectionName.trim() ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                opacity: newCollectionName.trim() ? 1 : 0.5
              }}
            >
              Создать
            </button>
            
            <button
              onClick={() => {
                setIsCreating(false);
                setNewCollectionName('');
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Список коллекций */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        {allCollections.map((collection) => (
          <div
            key={collection.id}
            onClick={() => handleCollectionClick(collection)}
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px var(--color-shadow)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Иконка и название */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px'
            }}>
              <div style={{
                fontSize: '24px',
                width: '40px',
                height: '40px',
                backgroundColor: collection.color,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {collection.icon}
              </div>
              
              <div>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: 'var(--color-text)',
                  margin: 0
                }}>
                  {collection.name}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: 'var(--color-text-secondary)',
                  margin: 0
                }}>
                  {collection.description}
                </p>
              </div>
            </div>

            {/* Превью паков */}
            {collection.packs.length > 0 && (
              <div style={{
                display: 'flex',
                gap: '4px',
                marginBottom: '12px'
              }}>
                {collection.packs.slice(0, 4).map((pack) => (
                  <div
                    key={pack.id}
                    style={{
                      width: '32px',
                      height: '32px',
                      backgroundColor: 'var(--color-border)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      overflow: 'hidden'
                    }}
                  >
                    {pack.previewStickers?.[0]?.emoji || '🎨'}
                  </div>
                ))}
                {collection.packs.length > 4 && (
                  <div style={{
                    width: '32px',
                    height: '32px',
                      backgroundColor: 'var(--color-text-secondary)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    color: 'white'
                  }}>
                    +{collection.packs.length - 4}
                  </div>
                )}
              </div>
            )}

            {/* Кнопка удаления для пользовательских коллекций */}
            {collection.isEditable && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteCollection(collection.id);
                }}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  width: '24px',
                  height: '24px',
                  backgroundColor: 'var(--color-error)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Пустое состояние */}
      {allCollections.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: 'var(--color-text-secondary)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
          <h3 style={{ margin: '0 0 8px 0' }}>Нет коллекций</h3>
          <p style={{ margin: 0 }}>Создайте свою первую коллекцию</p>
        </div>
      )}
    </div>
  );
};
