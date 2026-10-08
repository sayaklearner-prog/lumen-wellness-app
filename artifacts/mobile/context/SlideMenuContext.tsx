import React, { createContext, useContext, useState } from "react";

interface SlideMenuContextType {
  // Left menu (Primary navigation drawer shifted to top-left)
  isLeftOpen: boolean;
  openLeftMenu: () => void;
  closeLeftMenu: () => void;
  toggleLeftMenu: () => void;

  // Right menu (Preserved top-right drawer for future usage)
  isRightOpen: boolean;
  openRightMenu: () => void;
  closeRightMenu: () => void;
  toggleRightMenu: () => void;

  // Aliases (defaults to the primary left drawer)
  isOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
}

const SlideMenuContext = createContext<SlideMenuContextType>({
  isLeftOpen: false,
  openLeftMenu: () => {},
  closeLeftMenu: () => {},
  toggleLeftMenu: () => {},

  isRightOpen: false,
  openRightMenu: () => {},
  closeRightMenu: () => {},
  toggleRightMenu: () => {},

  isOpen: false,
  openMenu: () => {},
  closeMenu: () => {},
});

export function SlideMenuProvider({ children }: { children: React.ReactNode }) {
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);

  const openLeftMenu = () => {
    setIsRightOpen(false);
    setIsLeftOpen(true);
  };
  const closeLeftMenu = () => setIsLeftOpen(false);
  const toggleLeftMenu = () => setIsLeftOpen((prev) => !prev);

  const openRightMenu = () => {
    setIsLeftOpen(false);
    setIsRightOpen(true);
  };
  const closeRightMenu = () => setIsRightOpen(false);
  const toggleRightMenu = () => setIsRightOpen((prev) => !prev);

  const closeMenu = () => {
    setIsLeftOpen(false);
    setIsRightOpen(false);
  };

  return (
    <SlideMenuContext.Provider
      value={{
        isLeftOpen,
        openLeftMenu,
        closeLeftMenu,
        toggleLeftMenu,
        isRightOpen,
        openRightMenu,
        closeRightMenu,
        toggleRightMenu,
        isOpen: isLeftOpen,
        openMenu: openLeftMenu,
        closeMenu,
      }}
    >
      {children}
    </SlideMenuContext.Provider>
  );
}

export function useSlideMenu() {
  return useContext(SlideMenuContext);
}
