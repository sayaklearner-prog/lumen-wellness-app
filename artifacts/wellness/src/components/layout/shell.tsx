import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useTheme } from "@/components/theme-provider";
import { Moon, Sun, Activity, MoonIcon, Utensils, MonitorSmartphone, BrainCircuit, Calendar, Award, Settings, Crown, LayoutDashboard, Link2, ActivitySquare, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useAppFocusTracker } from "@/hooks/useAppFocusTracker";

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  useAppFocusTracker();
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { data: profile } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey() } });

  const handleSignOut = () => {
    localStorage.removeItem("lumen_authenticated");
    window.location.reload();
  };

  const isDiabetes = profile?.mode === "diabetes";

  const navItems = [
    { href: "/", label: "Today", icon: LayoutDashboard },
    { href: "/coach", label: "AI Coach", icon: BrainCircuit },
    ...(isDiabetes ? [{ href: "/glucose", label: "Glucose", icon: ActivitySquare }] : []),
    { href: "/reports", label: "Intelligence", icon: BrainCircuit },
    { href: "/nutrition", label: "Nutrition", icon: Utensils },
    { href: "/activity", label: "Activity", icon: Activity },
    { href: "/sleep", label: "Sleep", icon: MoonIcon },
    { href: "/screen-time", label: "Screen Time", icon: MonitorSmartphone },
    { href: "/planner", label: "Planner", icon: Calendar },
    { href: "/badges", label: "Badges", icon: Award },
    { href: "/connections", label: "Connections", icon: Link2 },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  // Mobile nav shows 5 items max
  const mobileNavItems = [
    navItems[0], // Today
    navItems[1], // AI Coach
    ...(isDiabetes ? [navItems.find(n => n.href === "/glucose")!] : [navItems.find(n => n.href === "/nutrition")!]),
    navItems.find(n => n.href === "/activity")!,
    navItems.find(n => n.href === "/settings")!
  ].filter(Boolean);

  // Hide shell on onboarding
  if (location === "/onboarding") {
    return <div className="min-h-[100dvh] bg-background font-sans text-foreground">{children}</div>;
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-sidebar h-full py-4">
        <div className="px-6 mb-8 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
            <Activity className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-sidebar-foreground">Lumen</h1>
        </div>

        <nav aria-label="Main navigation" className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={location === item.href ? "page" : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                location === item.href
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className={`w-5 h-5 ${location === item.href ? "text-primary" : ""}`} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-4 mt-auto space-y-2">
          <Link href="/upgrade" className="block w-full" aria-label="Upgrade to Premium">
            <Button variant="outline" className="w-full justify-start gap-2 rounded-xl bg-secondary/10 border-secondary/20 hover:bg-secondary/20 text-secondary-foreground shadow-sm">
              <Crown className="w-4 h-4 text-secondary" />
              Upgrade to Premium
            </Button>
          </Link>
          
          <Button 
            variant="ghost" 
            aria-label={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            className="w-full justify-start gap-2 rounded-xl text-sidebar-foreground/70 hover:text-sidebar-foreground"
            onClick={toggleTheme}
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {theme === "light" ? "Dark Mode" : "Light Mode"}
          </Button>

          <Button 
            variant="ghost" 
            aria-label="Sign Out"
            className="w-full justify-start gap-2 rounded-xl text-sidebar-foreground/70 hover:text-red-400 hover:bg-red-500/5"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-xl z-20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
              <Activity className="w-4 h-4" />
            </div>
            <span className="font-bold text-lg">Lumen</span>
          </div>
          <Button aria-label="Toggle theme" variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
            {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto p-4 md:p-8 pb-24 md:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        <nav aria-label="Mobile navigation" className="md:hidden absolute bottom-0 left-0 right-0 border-t border-border bg-background/90 backdrop-blur-xl pb-safe z-20">
          <ul className="flex justify-around items-center p-2 m-0">
            {mobileNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={location === item.href ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl min-w-[64px] ${
                    location === item.href
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
