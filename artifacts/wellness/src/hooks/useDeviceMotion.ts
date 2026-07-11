import { useState, useEffect, useCallback, useRef } from "react";

export function useDeviceMotion() {
  const [permission, setPermission] = useState<"prompt" | "granted" | "denied">("prompt");
  const [supported, setSupported] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [steps, setSteps] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [accelMagnitude, setAccelMagnitude] = useState(0);
  const [gyroMagnitude, setGyroMagnitude] = useState(0);
  
  const sampleCountRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const lastMagRef = useRef<number>(0);
  const lastStepTimeRef = useRef<number>(0);

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
    if (acc && acc.x !== null && acc.y !== null && acc.z !== null) {
      const mag = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
      setAccelMagnitude(mag);
      const now = Date.now();
      
      if (mag > 12 && lastMagRef.current <= 12 && now - lastStepTimeRef.current > 250) {
        setSteps(s => s + 1);
        lastStepTimeRef.current = now;
      }
      lastMagRef.current = mag;
    }
  }, []);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
      const mag = Math.sqrt(event.alpha * event.alpha + event.beta * event.beta + event.gamma * event.gamma);
      setGyroMagnitude(mag);
    }
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
      window.addEventListener("deviceorientation", handleOrientation);
    } else {
      timerRef.current = window.setInterval(() => {
        setSteps(s => s + 1);
      }, 700);
    }
    
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
      window.removeEventListener("deviceorientation", handleOrientation);
    } else if (timerRef.current) {
      window.clearInterval(timerRef.current);
    }
  };

  const reset = () => {
    setSteps(0);
    setDurationSeconds(0);
    sampleCountRef.current = 0;
  };

  let intensity: "light" | "moderate" | "vigorous" = "light";
  if (durationSeconds > 0) {
    const spm = (steps / durationSeconds) * 60;
    if (spm >= 110) intensity = "vigorous";
    else if (spm >= 80) intensity = "moderate";
  }
  
  const calories = Math.round(steps * 0.04);

  return {
    permission,
    supported,
    isTracking,
    steps,
    durationSeconds,
    intensity,
    calories,
    accelMagnitude,
    gyroMagnitude,
    sampleCount: sampleCountRef.current,
    start,
    stop,
    reset
  };
}