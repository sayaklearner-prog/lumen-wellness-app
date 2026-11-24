import React, { createContext, useContext, useState, useCallback } from "react";

interface ControlCenterContextType {
  isControlCenterOpen: boolean;
  openControlCenter: () => void;
  closeControlCenter: () => void;
  toggleControlCenter: () => void;
}

const ControlCenterContext = createContext<ControlCenterContextType>({
  isControlCenterOpen: false,
  openControlCenter: () => {},
  closeControlCenter: () => {},
  toggleControlCenter: () => {},
});

export function ControlCenterProvider({ children }: { children: React.ReactNode }) {
  const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);

  const openControlCenter = useCallback(() => {
    setIsControlCenterOpen(true);
  }, []);

  const closeControlCenter = useCallback(() => {
    setIsControlCenterOpen(false);
  }, []);

  const toggleControlCenter = useCallback(() => {
    setIsControlCenterOpen((prev) => !prev);
  }, []);

  return (
    <ControlCenterContext.Provider
      value={{
        isControlCenterOpen,
        openControlCenter,
        closeControlCenter,
        toggleControlCenter,
      }}
    >
      {children}
    </ControlCenterContext.Provider>
  );
}

export function useControlCenter() {
  return useContext(ControlCenterContext);
}
