import { createContext, useContext, useState } from "react";

const AppReadyContext = createContext();

export const AppReadyProvider = ({ children }) => {
  const [ready, setReady] = useState(false);
  return (
    <AppReadyContext.Provider value={{ ready, setReady }}>
      {children}
    </AppReadyContext.Provider>
  );
};

export const useAppReady = () => useContext(AppReadyContext);

