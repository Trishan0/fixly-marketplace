import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Wrench,
  ChevronRight,
  Droplets,
  Zap,
  Hammer,
  Sparkles,
  ShieldCheck,
  Briefcase,
  Star,
  ClipboardList,
  BellRing,
  Banknote,
  ArrowRight,
  Search,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const categories = [
  { icon: Droplets, name: "Plumbing", color: "bg-blue-100 text-blue-600" },
  { icon: Zap, name: "Electrical", color: "bg-yellow-100 text-yellow-600" },
  { icon: Hammer, name: "Carpentry", color: "bg-amber-100 text-amber-700" },
  { icon: Sparkles, name: "Cleaning", color: "bg-green-100 text-green-600" },
];

const features = [
  {
    icon: Search,
    title: "Find Skilled Workers",
    desc: "Browse verified local professionals in your district",
  },
  {
    icon: ClipboardList,
    title: "Get Competitive Quotes",
    desc: "Workers send proposals and you choose the best fit",
  },
  {
    icon: Banknote,
    title: "Pay Offline Safely",
    desc: "Record cash or bank payments directly in the app",
  },
  {
    icon: Star,
    title: "Leave Reviews",
    desc: "Help your community find the best workers",
  },
];

function getNavActions(user) {
  if (!user) {
    return [
      { to: "/workers", label: "Browse Workers", variant: "link" },
      { to: "/auth", label: "Sign In", variant: "secondary" },
      { to: "/auth?tab=register", label: "Get Started", variant: "primary" },
    ];
  }

  if (user.role === "customer") {
    return [
      { to: "/find-workers", label: "Browse Workers", variant: "link" },
      { to: "/jobs/new", label: "Post a Job", variant: "primary" },
    ];
  }

  if (user.role === "worker") {
    return [
      { to: "/jobs/feed", label: "Browse Open Jobs", variant: "primary" },
      {
        to: "/worker-dashboard",
        label: "Go to Dashboard",
        variant: "secondary",
      },
    ];
  }

  return [{ to: "/admin", label: "Go to Dashboard", variant: "primary" }];
}

function getHeroContent(user) {
  if (!user) {
    return {
      eyebrow: "Sri Lanka's Local Service Marketplace",
      title: "Find trusted workers without the usual hassle.",
      accent: "Hire with confidence in your area.",
      description:
        "Connect with skilled plumbers, electricians, carpenters, and more. Post a job, get quotes, and manage the whole process in one clean workflow.",
      primary: { to: "/auth?tab=register&role=customer", label: "Post a Job" },
      secondary: {
        to: "/auth?tab=register&role=worker",
        label: "Join as Worker",
      },
      tertiary: { to: "/workers", label: "Browse Workers" },
    };
  }

  if (user.role === "customer") {
    return {
      eyebrow: "Welcome Back",
      title: "Find the right worker faster.",
      accent: "Post jobs and review proposals in one place.",
      description:
        "Browse trusted workers, post a new job, and keep your hiring workflow moving from the same Fixly experience.",
      primary: { to: "/jobs/new", label: "Post a Job" },
      secondary: { to: "/find-workers", label: "Browse Workers" },
      tertiary: { to: "/customer-dashboard", label: "Go to Dashboard" },
    };
  }

  if (user.role === "worker") {
    return {
      eyebrow: "Welcome Back",
      title: "Discover new jobs worth your time.",
      accent: "Track invites, work, and earnings from one dashboard.",
      description:
        "Browse open jobs, send proposals quickly, and stay on top of active work, notifications, and payments.",
      primary: { to: "/jobs/feed", label: "Browse Open Jobs" },
      secondary: { to: "/worker-dashboard", label: "Go to Dashboard" },
      tertiary: { to: "/earnings", label: "View Earnings" },
    };
  }

  return {
    eyebrow: "Admin Access",
    title: "Monitor the marketplace clearly.",
    accent: "Manage users, workers, reports, and categories.",
    description:
      "Jump into the admin dashboard to review platform activity and keep the marketplace running smoothly.",
    primary: { to: "/admin", label: "Go to Dashboard" },
    secondary: { to: "/admin/users", label: "Manage Users" },
    tertiary: { to: "/admin/reports", label: "Open Reports" },
  };
}

function actionClass(variant) {
  if (variant === "primary") return "fixly-btn-primary text-sm";
  if (variant === "secondary") return "fixly-btn-secondary text-sm";
  return "text-sm font-medium text-slate-600 hover:text-slate-900";
}

function HeroVisual({ user }) {
  const roleLabel =
    user?.role === "admin"
      ? "Platform Overview"
      : user?.role === "worker"
        ? "Worker Workspace"
        : user?.role === "customer"
          ? "Customer Workspace"
          : "Marketplace Flow";

  return (
    <div className="relative">
      <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.18),transparent_34%)]" />
      <div className="relative rounded-[2rem] border border-white/60 bg-white/88 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-500">
              {roleLabel}
            </p>
            <h3 className="mt-2 text-xl font-bold text-slate-950">
              Fixly at a glance
            </h3>
          </div>
          <div className="rounded-2xl bg-sky-50 p-3 text-sky-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Post job or find work
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {user?.role === "worker"
                    ? "Browse open jobs near you and send proposals fast."
                    : user?.role === "admin"
                      ? "Review platform activity and moderation queues."
                      : "Reach the right worker without messy back-and-forth."}
                </p>
              </div>
              <div className="rounded-2xl bg-white p-3 shadow-sm">
                <Briefcase className="h-5 w-5 text-sky-600" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-sky-100 bg-sky-50/80 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white p-2.5 shadow-sm">
                  <BellRing className="h-4 w-4 text-sky-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Stay updated
                  </p>
                  <p className="text-xs text-slate-500">
                    Notifications, invites, and job updates stay organized.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/80 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white p-2.5 shadow-sm">
                  <Banknote className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Track outcomes
                  </p>
                  <p className="text-xs text-slate-500">
                    Payments, reviews, and completion signals stay visible.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">
                  Professional marketplace flow
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Browse, match, hire, complete, and review without losing
                  context.
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-sky-300" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const navActions = getNavActions(user);
  const hero = getHeroContent(user);

  return (
    <div
      className="min-h-screen bg-white"
      style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
    >
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sky-600 rounded-xl flex items-center justify-center">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <span
            className="text-xl font-bold text-slate-900"
            style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
          >
            Fixly
          </span>
        </div>
        <div className="flex items-center gap-3">
          {navActions.map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className={actionClass(action.variant)}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </nav>

      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f7fbff_0%,#eef6ff_100%)]">
        <div className="absolute inset-0 opacity-80">
          <div className="absolute left-[-6rem] top-10 h-72 w-72 rounded-full bg-sky-100 blur-3xl" />
          <div className="absolute right-[-3rem] top-24 h-80 w-80 rounded-full bg-cyan-100 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 py-16 md:px-12 md:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white px-4 py-1.5 shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-sky-500" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                  {hero.eyebrow}
                </span>
              </div>

              <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-slate-950 md:text-6xl">
                {hero.title}
              </h1>
              <p className="mt-4 max-w-2xl text-2xl font-semibold leading-tight text-sky-600 md:text-3xl">
                {hero.accent}
              </p>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                {hero.description}
              </p>

              <div
                className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
                style={{ padding: "10px 0 25px 0;" }}
              >
                <Link
                  to={hero.primary.to}
                  className="fixly-btn-primary text-base px-8 py-3.5 rounded-2xl"
                >
                  {hero.primary.label}
                </Link>
                <Link
                  to={hero.secondary.to}
                  className="fixly-btn-secondary text-base px-8 py-3.5 rounded-2xl"
                >
                  {hero.secondary.label}
                </Link>
                <Link
                  to={hero.tertiary.to}
                  className="inline-flex items-center gap-1 px-2 py-3 text-base font-semibold text-sky-700 transition hover:text-sky-800"
                >
                  {hero.tertiary.label} <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.45 }}
                className="mt-14 flex flex-wrap gap-8 border-t border-slate-200 pt-8"
              >
                {[
                  ["500+", "Verified Workers"],
                  ["25", "Districts Covered"],
                  ["4.8", "Average Rating"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <p className="text-2xl font-bold text-slate-950">{v}</p>
                    <p className="text-sm text-slate-500">{l}</p>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
            >
              <HeroVisual user={user} />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 md:px-12 py-20">
        <h2 className="text-2xl font-bold text-slate-900 mb-8">
          Popular Services
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map(({ icon: Icon, name, color }) => (
            <Link
              key={name}
              to={`/workers?category=${name}`}
              className="fixly-card p-6 flex flex-col items-center gap-3 hover:shadow-md transition-shadow group"
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <span className="font-semibold text-slate-800 text-sm group-hover:text-sky-600 transition-colors">
                {name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="max-w-6xl mx-auto px-6 md:px-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            How Fixly Works
          </h2>
          <p className="text-slate-500 mb-10">
            Simple, transparent, and built for Sri Lanka
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="fixly-card p-6">
                <div className="mb-4 inline-flex rounded-2xl bg-sky-50 p-3 text-sky-600">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {!user && (
        <section className="bg-sky-600 py-20 text-white text-center">
          <div className="max-w-2xl mx-auto px-6">
            <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-sky-100 mb-8">
              Join thousands of homeowners and skilled workers across Sri Lanka.
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                to="/auth?tab=register"
                className="bg-white text-sky-600 font-bold px-8 py-3 rounded-2xl hover:bg-sky-50 transition-all"
              >
                Create Account
              </Link>
              <Link
                to="/workers"
                className="bg-sky-700 text-white font-bold px-8 py-3 rounded-2xl hover:bg-sky-800 transition-all"
              >
                Browse Workers
              </Link>
            </div>
          </div>
        </section>
      )}

      <footer className="bg-slate-950 text-slate-400 py-10">
        <div className="max-w-6xl mx-auto px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-sky-500 rounded-lg flex items-center justify-center">
              <Wrench className="w-3 h-3 text-white" />
            </div>
            <span
              className="font-bold text-white text-sm"
              style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              Fixly
            </span>
            <span className="text-xs">
              Sri Lanka's Local Service Marketplace
            </span>
          </div>
          <p className="text-xs">© 2024 Fixly. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
