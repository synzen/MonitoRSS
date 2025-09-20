import { useState, useCallback } from "react";

export const useConfigPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeComponent, setActiveComponent] = useState<any>(null);

  const openConfig = useCallback((component: any) => {
    setActiveComponent(component);
    setIsOpen(true);
  }, []);

  const closeConfig = useCallback(() => {
    setIsOpen(false);
    setActiveComponent(null);
  }, []);

  const updateComponent = useCallback((updatedComponent: any) => {
    setActiveComponent(updatedComponent);
  }, []);

  return {
    isOpen,
    activeComponent,
    openConfig,
    closeConfig,
    updateComponent,
  };
};
