import { createContext, useContext, ReactNode, FC } from 'react';

interface ScrollContextValue {
  scrollElement: HTMLElement | null;
}

const ScrollContext = createContext<ScrollContextValue>({
  scrollElement: null,
});

interface ScrollProviderProps {
  children: ReactNode;
  scrollElement: HTMLElement | null;
}

export const ScrollProvider: FC<ScrollProviderProps> = ({
  children,
  scrollElement,
}) => {
  return (
    <ScrollContext.Provider value={{ scrollElement }}>
      {children}
    </ScrollContext.Provider>
  );
};

export const useScrollElement = (): HTMLElement | null => {
  const { scrollElement } = useContext(ScrollContext);
  return scrollElement;
};

export { ScrollContext };

