import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type KeyboardContextType = 'GLOBAL' | 'MODAL' | 'DRAWER' | 'DROPDOWN' | 'SEARCH' | 'COMMAND_PALETTE';

interface KeyboardContextState {
  activeContexts: KeyboardContextType[];
  pushContext: (context: KeyboardContextType) => void;
  popContext: (context: KeyboardContextType) => void;
  currentContext: KeyboardContextType;
  registerEscHandler: (handler: () => void) => () => void;
  executeEscHandler: () => boolean;
}

const KeyboardContext = createContext<KeyboardContextState | undefined>(undefined);

export const KeyboardShortcutsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeContexts, setActiveContexts] = useState<KeyboardContextType[]>(['GLOBAL']);
  const [escHandlers, setEscHandlers] = useState<(() => void)[]>([]);

  const pushContext = useCallback((context: KeyboardContextType) => {
    setActiveContexts((prev) => {
      // Don't add if it's already the top context
      if (prev[prev.length - 1] === context) return prev;
      return [...prev, context];
    });
  }, []);

  const popContext = useCallback((context: KeyboardContextType) => {
    setActiveContexts((prev) => {
      const newContexts = prev.filter((c) => c !== context);
      return newContexts.length === 0 ? ['GLOBAL'] : newContexts;
    });
  }, []);

  const registerEscHandler = useCallback((handler: () => void) => {
    setEscHandlers((prev) => [...prev, handler]);
    return () => {
      setEscHandlers((prev) => prev.filter((h) => h !== handler));
    };
  }, []);

  const executeEscHandler = useCallback(() => {
    if (escHandlers.length > 0) {
      // Execute the most recently registered handler
      const handler = escHandlers[escHandlers.length - 1];
      handler();
      return true; // Indicates it was handled
    }
    return false;
  }, [escHandlers]);

  const currentContext = activeContexts[activeContexts.length - 1];

  return (
    <KeyboardContext.Provider
      value={{
        activeContexts,
        pushContext,
        popContext,
        currentContext,
        registerEscHandler,
        executeEscHandler,
      }}
    >
      {children}
    </KeyboardContext.Provider>
  );
};

export const useKeyboardContext = () => {
  const context = useContext(KeyboardContext);
  if (!context) {
    throw new Error('useKeyboardContext must be used within a KeyboardShortcutsProvider');
  }
  return context;
};
