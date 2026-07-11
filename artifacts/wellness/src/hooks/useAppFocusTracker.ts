import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
export function useAppFocusTracker() {
  const [location] = useLocation();
  const createFocusSession: any = { mutate: () => {} };
  
  const sessionStartRef = useRef<number | null>(null);
  const currentRouteRef = useRef<string>(location);
  const isVisibleRef = useRef<boolean>(!document.hidden);
  const hasFocusRef = useRef<boolean>(document.hasFocus());

  const endSession = () => {
    if (!sessionStartRef.current) return;
    const now = Date.now();
    const durationSeconds = Math.floor((now - sessionStartRef.current) / 1000);
    
    if (durationSeconds >= 10) {
      const cappedDuration = Math.min(durationSeconds, 3 * 60 * 60); // 3 hours
      // createFocusSession.mutate({
      //   data: {
      //     category: currentRouteRef.current,
      //     durationSeconds: cappedDuration,
      //     startedAt: new Date(sessionStartRef.current).toISOString(),
      //     endedAt: new Date(now).toISOString(),
      //   }
      // });
    }
    sessionStartRef.current = null;
  };

  const startSession = () => {
    if (!sessionStartRef.current && isVisibleRef.current && hasFocusRef.current) {
      sessionStartRef.current = Date.now();
    }
  };

  useEffect(() => {
    if (location !== currentRouteRef.current) {
      endSession();
      currentRouteRef.current = location;
      startSession();
    }
  }, [location]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
      if (isVisibleRef.current && hasFocusRef.current) {
        startSession();
      } else {
        endSession();
      }
    };

    const handleFocus = () => {
      hasFocusRef.current = true;
      if (isVisibleRef.current) {
        startSession();
      }
    };

    const handleBlur = () => {
      hasFocusRef.current = false;
      endSession();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    startSession();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      endSession();
    };
  }, []);
}