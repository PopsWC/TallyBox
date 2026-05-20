import React, { createContext, useContext, useState } from "react";
import { Season } from "@/lib/database";

export interface ActiveSeasonContextValue {
  activeSeason: Season | null;
  setActiveSeason: (s: Season | null) => void;
}

const ActiveSeasonContext = createContext<ActiveSeasonContextValue>({
  activeSeason: null,
  setActiveSeason: () => {},
});

export function ActiveSeasonProvider({ children }: { children: React.ReactNode }) {
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  return (
    <ActiveSeasonContext.Provider value={{ activeSeason, setActiveSeason }}>
      {children}
    </ActiveSeasonContext.Provider>
  );
}

export function useActiveSeason() {
  return useContext(ActiveSeasonContext);
}
