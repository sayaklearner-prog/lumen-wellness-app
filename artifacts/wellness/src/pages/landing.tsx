import { useState, useRef, useEffect } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OnboardingModal } from "@/components/onboarding-modal";
import { useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Brain, Activity, ChevronDown, Check, Camera, Clock, MessageSquare,
  FileText, ChevronRight, Star, Heart, Droplets, Moon, Smartphone,
  Utensils, BarChart3, Shield, Zap, ArrowRight, Menu, X
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Fade-in wrapper ─────────────────────────────────────────────── */
function FadeIn({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Animated counter ────────────────────────────────────────────── */
function Counter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isInView) return;
    let frame: number;
    const duration = 1800;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * end));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [isInView, end]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ── FAQ data ────────────────────────────────────────────────────── */
const faqs = [
  { q: "What is Lumen Health OS?", a: "Lumen Health OS is an intelligent personal wellness operating system that unifies nutrition tracking, sleep analytics, activity monitoring, mental wellness logging, and conversational AI coaching into one premium interface." },
  { q: "How does the AI Nutrition Scanner work?", a: "Simply take a photo of your meal. Our multimodal AI vision model identifies every ingredient, estimates serving sizes, calculates macronutrients, and even provides vitamin & mineral estimates — all in seconds." },
  { q: "Is my health data secure?", a: "Absolutely. All biometric data is processed locally and stored in a secure on-device database. MeshMind does not sell, share, or transmit your clinical information to third parties." },
  { q: "Can I connect wearable devices?", a: "Yes. Lumen OS supports synchronization with popular wearables including Apple Watch, Garmin, and Fitbit to automatically import steps, heart rate, workouts, and sleep data." },
  { q: "What health modes are available?", a: "Choose from Standard, Diabetes Care, Heart Health, Weight Management, or Pregnancy Focus. Each mode adjusts targets, insights, and AI coaching to match your specific health journey." },
];

/* ── Ecosystem features ──────────────────────────────────────────── */
const ecosystem = [
  { title: "Nutrition Intelligence", desc: "AI-powered food recognition with complete macro and micronutrient analysis. Snap a photo or log manually.", icon: Utensils, color: "text-orange-400" },
  { title: "Activity Tracking", desc: "Log workouts, monitor daily steps, track active calories, and receive AI readiness scores.", icon: Activity, color: "text-emerald-400" },
  { title: "Sleep Analytics", desc: "Monitor sleep duration, quality, and patterns with personalized recommendations for better rest.", icon: Moon, color: "text-indigo-400" },
  { title: "Mental Wellness", desc: "Track mood, journal thoughts, and receive AI-guided mindfulness suggestions throughout your day.", icon: Heart, color: "text-rose-400" },
  { title: "Hydration Tracking", desc: "Set daily water goals, log intake, and receive smart hydration reminders based on activity.", icon: Droplets, color: "text-sky-400" },
  { title: "Health Reports", desc: "Weekly and monthly AI-generated health syntheses grounded in your actual logged biometric data.", icon: BarChart3, color: "text-amber-400" },
];

interface LandingPageProps {
  onAuthenticate: () => void;
}

export default function LandingPage({ onAuthenticate }: LandingPageProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: profile } = useGetMyProfile();

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleGetStarted = () => setOnboardingOpen(true);

  const handleSignIn = () => {
    if (profile && (profile as any).onboardingComplete) {
      localStorage.setItem("lumen_authenticated", "true");
      qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      toast({ title: "Welcome back", description: "Signed in to Lumen Health OS." });
      onAuthenticate();
    } else {
      setOnboardingOpen(true);
    }
  };

  /* parallax for hero image */
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroImgY = useTransform(scrollYProgress, [0, 1], [0, 80]);

  return (
    <div className="bg-[#faf9f7] text-[#1a1a1a] min-h-screen font-sans selection:bg-emerald-600/20 selection:text-emerald-800 overflow-x-hidden">

      {/* ═══════════ NAVBAR ═══════════ */}
      <nav className="fixed top-0 inset-x-0 z-50 h-16">
        <div className="mx-auto max-w-7xl px-6 h-full flex items-center justify-between">
          <div className="absolute inset-0 bg-[#faf9f7]/70 backdrop-blur-xl border-b border-black/[.04]" />

          {/* Logo */}
          <div className="relative flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center shadow-sm">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-[#1a1a1a]">Lumen</span>
          </div>

          {/* Desktop links */}
          <div className="relative hidden md:flex items-center gap-8 text-[13px] font-medium text-[#666]">
            <a href="#features" className="hover:text-[#1a1a1a] transition-colors">Features</a>
            <a href="#ai" className="hover:text-[#1a1a1a] transition-colors">AI Intelligence</a>
            <a href="#ecosystem" className="hover:text-[#1a1a1a] transition-colors">Ecosystem</a>
            <a href="#about" className="hover:text-[#1a1a1a] transition-colors">About</a>
          </div>

          {/* CTA buttons */}
          <div className="relative flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={handleSignIn}
              className="hidden md:inline-flex text-[13px] font-semibold text-[#666] hover:text-[#1a1a1a] hover:bg-transparent"
            >
              Sign In
            </Button>
            <Button
              onClick={handleGetStarted}
              className="bg-[#1a1a1a] hover:bg-[#333] text-white text-[13px] font-semibold rounded-full px-5 h-9 shadow-sm"
            >
              Get Started
            </Button>
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-[#666]"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-[#faf9f7]/95 backdrop-blur-xl border-b border-black/[.06] px-6 py-4 space-y-3"
          >
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-[#666] hover:text-[#1a1a1a]">Features</a>
            <a href="#ai" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-[#666] hover:text-[#1a1a1a]">AI Intelligence</a>
            <a href="#ecosystem" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-[#666] hover:text-[#1a1a1a]">Ecosystem</a>
            <a href="#about" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-[#666] hover:text-[#1a1a1a]">About</a>
            <Button variant="ghost" onClick={handleSignIn} className="w-full justify-start text-sm font-semibold text-[#666]">Sign In</Button>
          </motion.div>
        )}
      </nav>

      {/* ═══════════ HERO ═══════════ */}
      <section ref={heroRef} className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid md:grid-cols-2 gap-12 md:gap-8 items-center">
            {/* Left – Copy */}
            <FadeIn className="space-y-7 max-w-xl">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-[.18em]">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                MeshMind Wellness
              </div>

              <h1 className="text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-extrabold leading-[1.08] tracking-tight text-[#1a1a1a]">
                Your Personal<br />
                <span className="text-emerald-700">AI Health</span><br />
                Companion.
              </h1>

              <p className="text-[#666] text-base md:text-lg leading-relaxed max-w-md">
                Understand your body. Track your lifestyle. Receive personalized, AI-powered health guidance every single day.
              </p>

              <div className="flex flex-wrap gap-3 pt-1">
                <Button
                  size="lg"
                  onClick={handleGetStarted}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-full px-7 h-12 text-sm font-semibold shadow-md shadow-emerald-700/15"
                >
                  Get Started <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[#ddd] text-[#555] hover:bg-[#f0efed] rounded-full px-7 h-12 text-sm font-semibold"
                  onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Learn More
                </Button>
              </div>

              {/* Trust indicator */}
              <div className="flex items-center gap-3 pt-2">
                <div className="flex text-amber-500">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                </div>
                <span className="text-xs text-[#888]">Trusted by wellness enthusiasts</span>
                <span className="text-[10px] text-[#aaa] font-medium">|</span>
                <span className="text-xs text-[#888]">Created by <b className="text-[#555]">MeshMind</b></span>
              </div>
            </FadeIn>

            {/* Right – Hero Image */}
            <FadeIn delay={0.2} className="relative flex justify-center md:justify-end">
              <motion.div
                style={{ y: heroImgY }}
                className="relative"
              >
                <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-black/10 max-w-md md:max-w-lg w-full group">
                  <img
                    src="/hero-runner.jpg"
                    alt="Woman running at sunrise with a smartwatch"
                    className="w-full h-[420px] md:h-[520px] object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    loading="eager"
                  />
                  {/* Subtle overlay gradient at bottom */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
                </div>
              </motion.div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ═══════════ TRUSTED PILLARS ═══════════ */}
      <section className="py-16 border-y border-black/[.05] bg-[#f5f4f2]">
        <div className="mx-auto max-w-7xl px-6">
          <FadeIn className="text-center mb-10">
            <p className="text-[11px] font-bold text-[#999] uppercase tracking-[.2em]">Integrated Health Pillars</p>
          </FadeIn>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[
              { icon: Brain, label: "AI Coaching" },
              { icon: Camera, label: "Nutrition Scanner" },
              { icon: Activity, label: "Activity Tracking" },
              { icon: Moon, label: "Sleep Analytics" },
            ].map((item, idx) => (
              <FadeIn key={idx} delay={idx * 0.08}>
                <div className="flex items-center justify-center gap-2.5 bg-white/80 backdrop-blur-sm border border-black/[.04] rounded-2xl p-4 md:p-5 text-sm font-medium text-[#444] hover:shadow-md hover:shadow-black/[.04] transition-all duration-300">
                  <item.icon className="w-4.5 h-4.5 text-emerald-600" />
                  {item.label}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ AI INTELLIGENCE SECTION (Image 2: Smartwatch) ═══════════ */}
      <section id="ai" className="py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            {/* Left – Smartwatch Image */}
            <FadeIn className="relative">
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                <div className="rounded-3xl overflow-hidden shadow-2xl shadow-black/10 group">
                  <img
                    src="/smartwatch-phone.jpg"
                    alt="Smartwatch and phone showing health metrics"
                    className="w-full h-[360px] md:h-[440px] object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    loading="lazy"
                  />
                </div>
                {/* Decorative dot */}
                <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-emerald-100 rounded-full -z-10" />
              </motion.div>
            </FadeIn>

            {/* Right – Editorial Copy */}
            <FadeIn delay={0.15} className="space-y-6 max-w-lg">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-[.18em]">
                <Zap className="w-3.5 h-3.5" /> AI Intelligence
              </div>

              <h2 className="text-3xl md:text-[2.5rem] font-extrabold leading-tight tracking-tight text-[#1a1a1a]">
                Your Health,<br />Connected.
              </h2>

              <p className="text-[#666] leading-relaxed">
                Lumen continuously understands your health through wearable devices, nutrition logs, sleep patterns, workout data, and its persistent AI memory engine — delivering insights that evolve with you.
              </p>

              <div className="space-y-3 pt-2">
                {[
                  "AI Health Coach",
                  "Wearable Integration",
                  "Real-time Insights",
                  "Personalized Recommendations",
                  "Smart Health Reports"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-sm text-[#444]">
                    <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-emerald-600" />
                    </div>
                    {item}
                  </div>
                ))}
              </div>

              <button
                onClick={() => document.getElementById("ecosystem")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800 pt-2 group"
              >
                Learn More <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ═══════════ FEATURE GRID ═══════════ */}
      <section id="features" className="py-24 md:py-32 bg-[#f5f4f2]">
        <div className="mx-auto max-w-7xl px-6">
          <FadeIn className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <p className="text-[11px] font-bold text-[#999] uppercase tracking-[.2em]">Core Capabilities</p>
            <h2 className="text-3xl md:text-[2.75rem] font-extrabold tracking-tight text-[#1a1a1a]">
              Everything you need to understand your body.
            </h2>
            <p className="text-[#888] text-sm md:text-base">Precision logging meets proactive health intelligence.</p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { title: "AI Health Coach", desc: "An always-on conversational companion trained on your clinical metrics, providing personalized guidance.", icon: Brain, color: "bg-emerald-50 text-emerald-600" },
              { title: "Nutrition Scanner", desc: "Snap a photo to instantly estimate calories, protein, carbs, fats, and even vitamins & minerals.", icon: Camera, color: "bg-orange-50 text-orange-600" },
              { title: "Activity Intelligence", desc: "Log workouts, analyze readiness scores, and receive AI-driven fitness challenges each week.", icon: Activity, color: "bg-indigo-50 text-indigo-600" },
              { title: "Sleep Analytics", desc: "Understand your sleep quality with trend analysis, 14-day charts, and personalized rest tips.", icon: Moon, color: "bg-violet-50 text-violet-600" },
              { title: "AI Memory Engine", desc: "Your coach remembers you. Conversational context is grounded in past health logs — no hallucinations.", icon: MessageSquare, color: "bg-sky-50 text-sky-600" },
              { title: "Health Reports", desc: "Weekly and monthly AI-generated syntheses of your wellness, consistency scores, and trend adjustments.", icon: FileText, color: "bg-amber-50 text-amber-600" },
            ].map((f, idx) => (
              <FadeIn key={idx} delay={idx * 0.06}>
                <div className="p-7 bg-white rounded-2xl border border-black/[.04] space-y-4 hover:shadow-lg hover:shadow-black/[.04] hover:-translate-y-0.5 transition-all duration-300 h-full">
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", f.color)}>
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-[#1a1a1a]">{f.title}</h3>
                  <p className="text-sm text-[#888] leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ LIFESTYLE BANNER ═══════════ */}
      <section className="relative py-24 md:py-32 overflow-hidden bg-[#1a1a1a]">
        <div className="absolute inset-0 opacity-20">
          <img src="/hero-runner.jpg" alt="" className="w-full h-full object-cover" loading="lazy" aria-hidden="true" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a1a1a] via-[#1a1a1a]/80 to-[#1a1a1a]/40" />
        <FadeIn className="relative mx-auto max-w-4xl px-6 text-center space-y-5">
          <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-[.2em]">Philosophy</p>
          <h2 className="text-3xl md:text-[2.75rem] font-extrabold text-white leading-tight tracking-tight">
            Wellness isn't about<br />collecting data.
          </h2>
          <p className="text-xl md:text-2xl font-light text-white/60 italic">
            It's about understanding yourself.
          </p>
        </FadeIn>
      </section>

      {/* ═══════════ HEALTH ECOSYSTEM ═══════════ */}
      <section id="ecosystem" className="py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <FadeIn className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <p className="text-[11px] font-bold text-[#999] uppercase tracking-[.2em]">Health Ecosystem</p>
            <h2 className="text-3xl md:text-[2.75rem] font-extrabold tracking-tight text-[#1a1a1a]">
              Every parameter, one platform.
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ecosystem.map((item, idx) => (
              <FadeIn key={idx} delay={idx * 0.06}>
                <div className="p-6 rounded-2xl border border-black/[.05] bg-white hover:shadow-lg hover:shadow-black/[.04] hover:-translate-y-0.5 transition-all duration-300 space-y-3 h-full">
                  <item.icon className={cn("w-6 h-6", item.color)} />
                  <h3 className="font-bold text-[#1a1a1a]">{item.title}</h3>
                  <p className="text-sm text-[#888] leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ STATISTICS ═══════════ */}
      <section className="py-20 bg-[#f5f4f2] border-y border-black/[.05]">
        <div className="mx-auto max-w-7xl px-6 grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
          {[
            { value: 95, suffix: "%", label: "Recommendation Accuracy" },
            { value: 500, suffix: "K+", label: "Health Logs Processed" },
            { value: 24, suffix: "/7", label: "AI Coaching Available" },
            { value: 12, suffix: "+", label: "Health Modules" },
          ].map((stat, idx) => (
            <FadeIn key={idx} delay={idx * 0.08}>
              <div className="space-y-1">
                <div className="text-4xl md:text-5xl font-extrabold text-[#1a1a1a] tabular-nums">
                  <Counter end={stat.value} suffix={stat.suffix} />
                </div>
                <p className="text-xs font-medium text-[#999] uppercase tracking-wider">{stat.label}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ═══════════ TESTIMONIALS ═══════════ */}
      <section id="about" className="py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <FadeIn className="text-center mb-16 space-y-4">
            <p className="text-[11px] font-bold text-[#999] uppercase tracking-[.2em]">What People Say</p>
            <h2 className="text-3xl md:text-[2.75rem] font-extrabold tracking-tight text-[#1a1a1a]">
              Loved by wellness enthusiasts.
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "Dr. Ananya Sharma", role: "Endocrinologist", text: "The diabetes mode with glucose-aware AI coaching has genuinely improved my patients' self-management.", avatar: "AS" },
              { name: "Marcus Webb", role: "CrossFit Coach", text: "The activity intelligence section rivals WHOOP. Readiness scores and AI challenges keep my athletes engaged.", avatar: "MW" },
              { name: "Elena Novak", role: "Nutritionist", text: "The nutrition scanner is remarkably accurate. My clients love photographing their meals and seeing instant macro breakdowns.", avatar: "EN" },
            ].map((t, idx) => (
              <FadeIn key={idx} delay={idx * 0.08}>
                <div className="p-7 bg-white rounded-2xl border border-black/[.04] space-y-5 hover:shadow-lg hover:shadow-black/[.04] transition-all duration-300">
                  <div className="flex text-amber-400">
                    {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                  </div>
                  <p className="text-sm text-[#555] leading-relaxed italic">"{t.text}"</p>
                  <div className="flex items-center gap-3 pt-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">{t.avatar}</div>
                    <div>
                      <div className="text-sm font-bold text-[#1a1a1a]">{t.name}</div>
                      <div className="text-xs text-[#999]">{t.role}</div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section className="py-24 md:py-32 bg-[#f5f4f2]">
        <div className="mx-auto max-w-3xl px-6">
          <FadeIn className="text-center mb-14 space-y-4">
            <h2 className="text-3xl md:text-[2.5rem] font-extrabold tracking-tight text-[#1a1a1a]">
              Frequently Asked Questions
            </h2>
          </FadeIn>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <FadeIn key={idx} delay={idx * 0.04}>
                <div className="bg-white rounded-2xl border border-black/[.04] overflow-hidden">
                  <button
                    onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                    className="w-full p-5 md:p-6 text-left font-semibold text-sm text-[#1a1a1a] flex justify-between items-center"
                    aria-expanded={activeFaq === idx}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={cn("w-4 h-4 text-[#aaa] transition-transform duration-300 flex-shrink-0 ml-4", activeFaq === idx && "rotate-180")} />
                  </button>
                  <motion.div
                    initial={false}
                    animate={{ height: activeFaq === idx ? "auto" : 0, opacity: activeFaq === idx ? 1 : 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 md:px-6 pb-5 md:pb-6 text-sm text-[#888] leading-relaxed">
                      {faq.a}
                    </div>
                  </motion.div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <section className="py-28 md:py-36 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-[#faf9f7] to-amber-50/30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-100/40 rounded-full blur-[120px] pointer-events-none" />

        <FadeIn className="relative mx-auto max-w-3xl px-6 text-center space-y-7">
          <h2 className="text-3xl md:text-[3rem] font-extrabold tracking-tight text-[#1a1a1a] leading-tight">
            Start Your Health<br />Journey Today.
          </h2>
          <p className="text-[#888] text-base md:text-lg max-w-md mx-auto leading-relaxed">
            No subscription required. Your wellness data stays secure on your device. Powered by AI, designed for life.
          </p>
          <div className="flex flex-wrap gap-4 justify-center pt-2">
            <Button
              size="lg"
              onClick={handleGetStarted}
              className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-full px-8 h-13 text-sm font-semibold shadow-lg shadow-emerald-700/15"
            >
              Get Started <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handleSignIn}
              className="border-[#ddd] text-[#555] hover:bg-[#f0efed] rounded-full px-8 h-13 text-sm font-semibold"
            >
              Sign In
            </Button>
          </div>
          <div className="flex items-center justify-center gap-2 pt-3">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span className="text-xs text-[#aaa]">Privacy-first. On-device processing. No data selling.</span>
          </div>
        </FadeIn>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="border-t border-black/[.06] bg-[#faf9f7] py-14 px-6">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center">
                <Activity className="w-3 h-3 text-white" />
              </div>
              <span className="font-bold text-sm text-[#1a1a1a]">Lumen Health OS</span>
            </div>
            <span className="text-xs text-[#bbb]">Created by MeshMind</span>
          </div>
          <div className="flex gap-6 text-xs font-medium text-[#999]">
            <a href="#" className="hover:text-[#1a1a1a] transition-colors">Privacy</a>
            <a href="#" className="hover:text-[#1a1a1a] transition-colors">Terms</a>
            <a href="#" className="hover:text-[#1a1a1a] transition-colors">GitHub</a>
            <a href="#" className="hover:text-[#1a1a1a] transition-colors">Contact</a>
          </div>
        </div>
      </footer>

      {/* ═══════════ ONBOARDING MODAL ═══════════ */}
      <OnboardingModal
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        onComplete={onAuthenticate}
      />

    </div>
  );
}
