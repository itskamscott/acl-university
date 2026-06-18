"use client";

import { createContext, useContext, useState } from "react";

interface CreditsContextValue {
  credits: number;
  setCredits: (n: number) => void;
  decrement: (n?: number) => void;
}

const CreditsContext = createContext<CreditsContextValue | null>(null);

export function CreditsProvider({
  initial,
  children,
}: {
  initial: number;
  children: React.ReactNode;
}) {
  const [credits, setCredits] = useState(initial);
  const [lastInitial, setLastInitial] = useState(initial);

  // Reset to the new server-provided value whenever the layout re-renders
  // with a different initial (e.g. after router.refresh() post-purchase).
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setCredits(initial);
  }

  const decrement = (n: number = 1) =>
    setCredits((current) => Math.max(0, current - n));

  return (
    <CreditsContext.Provider value={{ credits, setCredits, decrement }}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const ctx = useContext(CreditsContext);
  if (!ctx) {
    throw new Error("useCredits must be used within CreditsProvider");
  }
  return ctx;
}
