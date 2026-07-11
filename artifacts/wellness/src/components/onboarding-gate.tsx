import { useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";

export function OnboardingGate({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { data: profile, isLoading } = useGetMyProfile({
    query: {
      queryKey: getGetMyProfileQueryKey(),
      retry: false
    }
  });

  useEffect(() => {
    if (isLoading) return;
    
    // Check if the user is a mock profile that hasn't completed onboarding.
    // In our backend, there's `onboardingComplete` boolean? No, looking at api.schemas.ts, there's no `onboardingComplete` directly on Profile, but we can assume checking `joinedAt` or maybe it's not typed. Let's just assume `true` for now, or check if it exists. Wait, the prompt says `profile.onboardingComplete === false`. I will use `(profile as any).onboardingComplete === false`.
    const isComplete = (profile as any)?.onboardingComplete;
    if (profile && isComplete === false && location !== "/onboarding") {
      navigate("/onboarding", { replace: true });
    }
  }, [profile, isLoading, location, navigate]);

  return <>{children}</>;
}