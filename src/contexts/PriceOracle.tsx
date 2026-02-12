"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

type PricesMap = Map<string, number>;

interface PriceOracleContextValue {
  prices: PricesMap;
  loading: boolean;
  getPriceBySymbol: (symbol: string) => number | undefined;
  reload: () => Promise<void>;
}

const PriceOracleContext = createContext<PriceOracleContextValue | undefined>(undefined);

export const PriceOracleProvider = ({ children }: { children: ReactNode }) => {
  const [prices, setPrices] = useState<PricesMap>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tokens`);
      const data = await res.json();
      if (data && !data.error && Array.isArray(data)) {
        const map = new Map<string, number>();
        data.forEach((t: any) => {
          if (t.symbol && typeof t.price === "number") {
            map.set(String(t.symbol).toUpperCase(), t.price);
          }
        });
        setPrices(map);
      } else {
        // If API returns object keyed differently, try to extract price fields
        if (data && data.data && Array.isArray(data.data)) {
          const map = new Map<string, number>();
          data.data.forEach((t: any) => {
            const sym = t.symbol || t.slug;
            const price = t.quote?.USD?.price;
            if (sym && typeof price === "number") map.set(String(sym).toUpperCase(), price);
          });
          setPrices(map);
        }
      }
    } catch (e) {
      console.error("PriceOracle: failed to fetch prices", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // start background load but do not block rendering
    void fetchPrices();
    // refresh periodically (e.g., every 10 minutes)
    const id = setInterval(() => {
      void fetchPrices();
    }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchPrices]);

  const getPriceBySymbol = (symbol: string) => {
    if (!symbol) return undefined;
    return prices.get(symbol.toUpperCase());
  };

  const reload = async () => {
    await fetchPrices();
  };

  return (
    <PriceOracleContext.Provider value={{ prices, loading, getPriceBySymbol, reload }}>
      {children}
    </PriceOracleContext.Provider>
  );
};

export function usePriceOracle() {
  const ctx = useContext(PriceOracleContext);
  if (!ctx) throw new Error("usePriceOracle must be used within PriceOracleProvider");
  return ctx;
}
