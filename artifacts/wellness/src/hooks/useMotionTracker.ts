import { useState, useEffect, useCallback, useRef } from "react";

export function useMotionTracker() {
  const [permission, setPermission] = useState<"prompt" | "granted" | "denied">("prompt");
  const [supported, setSupported] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [steps, setSteps] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  
  const sampleCountRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const lastMagRef = useRef<number>(0);
  const lastStepTimeRef = useRef<number>(0);

  // Check support
  useEffect(() => {
    if (typeof window === "undefined" || !window.DeviceMotionEvent) {
      setSupported(false);
    }
  }, []);

  const requestPermission = async () => {
    if (typeof (DeviceMotionEvent as any).requestPermission === "function") {
      try {
        const perm = await (DeviceMotionEvent as any).requestPermission();
        setPermission(perm);
        return perm === "granted";
      } catch (err) {
        console.error(err);
        setPermission("denied");
        return false;
      }
    } else {
      setPermission("granted");
      return true;
    }
  };

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    sampleCountRef.current++;
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;
    
    // Simple peak detection
    const mag = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    const now = Date.now();
    
    if (mag > 12 && lastMagRef.current <= 12 && now - lastStepTimeRef.current > 250) {
      setSteps(s => s + 1);
      lastStepTimeRef.current = now;
    }
    lastMagRef.current = mag;
  }, []);

  const start = async () => {
    let perm = permission;
    if (perm === "prompt") {
      const granted = await requestPermission();
      if (!granted) return;
    }
    if (permission === "denied") return;
    
    setIsTracking(true);
    setSteps(0);
    setDurationSeconds(0);
    sampleCountRef.current = 0;
    
    if (supported) {
      window.addEventListener("devicemotion", handleMotion);
    } else {
      // Simulation mode for unsupported devices (desktop)
      timerRef.current = window.setInterval(() => {
        setSteps(s => s + 1);
      }, 700);
    }
    
    // Second timer for duration
    const durTimer = window.setInterval(() => {
      setDurationSeconds(d => d + 1);
    }, 1000);
    
    return () => {
      window.clearInterval(durTimer);
    };
  };

  const stop = () => {
    setIsTracking(false);
    if (supported) {
      window.removeEventListener("devicemotion", handleMotion);
    } else if (timerRef.current) {
      window.clearInterval(timerRef.current);
    }
  };

  const reset = () => {
    setSteps(0);
    setDurationSeconds(0);
    sampleCountRef.current = 0;
  };

  // calculate intensity based on steps per minute
  let intensity: "light" | "moderate" | "vigorous" = "light";
  if (durationSeconds > 0) {
    const spm = (steps / durationSeconds) * 60;
    if (spm >= 110) intensity = "vigorous";
    else if (spm >= 80) intensity = "moderate";
  }

  return {
    permission,
    supported,
    isTracking,
    steps,
    durationSeconds,
    intensity,
    sampleCount: sampleCountRef.current,
    start,
    stop,
    reset
  };
}
