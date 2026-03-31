import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Wrench, Star, Shield, MapPin, ChevronRight, Droplets, Zap, Hammer, Sparkles } from 'lucide-react'

const categories = [
  { icon: Droplets, name: 'Plumbing', color: 'bg-blue-100 text-blue-600' },
  { icon: Zap, name: 'Electrical', color: 'bg-yellow-100 text-yellow-600' },
  { icon: Hammer, name: 'Carpentry', color: 'bg-amber-100 text-amber-700' },
  { icon: Sparkles, name: 'Cleaning', color: 'bg-green-100 text-green-600' },
]

const features = [
  { icon: '🔍', title: 'Find Skilled Workers', desc: 'Browse verified local professionals in your district' },
  { icon: '💬', title: 'Get Competitive Quotes', desc: 'Workers send proposals — you choose the best fit' },
  { icon: '✅', title: 'Pay Offline Safely', desc: 'Record cash or bank payments directly in the app' },
  { icon: '⭐', title: 'Leave Reviews', desc: 'Help your community find the best workers' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-sky-600 rounded-xl flex items-center justify-center">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-xl text-slate-900" style={{ fontFamily: 'Syne, sans-serif' }}>Fixly</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/workers" className="text-sm font-medium text-slate-600 hover:text-slate-900 hidden sm:block">
            Browse Workers
          </Link>
          <Link to="/auth" className="fixly-btn-secondary text-sm">Sign In</Link>
          <Link to="/auth?tab=register" className="fixly-btn-primary text-sm">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-sky-500 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-600 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-6 md:px-12 py-24 md:py-36">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 bg-sky-500/20 border border-sky-500/30 rounded-full px-4 py-1.5 mb-6">
              <MapPin className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-xs font-semibold text-sky-300 uppercase tracking-wide">Sri Lanka's Local Service Marketplace</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
              Find Trusted Workers<br />
              <span className="text-sky-400">Right In Your Area</span>
            </h1>
            <p className="text-lg text-slate-300 max-w-xl mb-10 leading-relaxed">
              Connect with skilled plumbers, electricians, carpenters, and more. Post a job, get quotes, hire with confidence — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/auth?tab=register&role=customer" className="fixly-btn-primary text-base px-8 py-3.5 rounded-2xl">
                Post a Job →
              </Link>
              <Link to="/auth?tab=register&role=worker" className="bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-3.5 rounded-2xl text-base transition-all">
                Join as Worker
              </Link>
              <Link to="/workers" className="text-sky-400 hover:text-sky-300 font-semibold px-6 py-3.5 rounded-2xl text-base transition-all flex items-center gap-1">
                Browse Workers <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-wrap gap-8 mt-16 pt-10 border-t border-white/10"
          >
            {[['500+', 'Verified Workers'], ['25', 'Districts Covered'], ['4.8★', 'Average Rating']].map(([v, l]) => (
              <div key={l}>
                <p className="text-2xl font-black text-sky-400">{v}</p>
                <p className="text-sm text-slate-400">{l}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-5xl mx-auto px-6 md:px-12 py-20">
        <h2 className="text-2xl font-bold text-slate-900 mb-8">Popular Services</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map(({ icon: Icon, name, color }) => (
            <Link key={name} to={`/workers?category=${name}`}
              className="fixly-card p-6 flex flex-col items-center gap-3 hover:shadow-md transition-shadow group">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <span className="font-semibold text-slate-800 text-sm group-hover:text-sky-600 transition-colors">{name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-5xl mx-auto px-6 md:px-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">How Fixly Works</h2>
          <p className="text-slate-500 mb-10">Simple, transparent, and built for Sri Lanka</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon, title, desc }) => (
              <div key={title} className="fixly-card p-6">
                <div className="text-3xl mb-4">{icon}</div>
                <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-sky-600 py-20 text-white text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-black mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Ready to get started?</h2>
          <p className="text-sky-100 mb-8">Join thousands of homeowners and skilled workers across Sri Lanka.</p>
          <div className="flex gap-3 justify-center">
            <Link to="/auth?tab=register" className="bg-white text-sky-600 font-bold px-8 py-3 rounded-2xl hover:bg-sky-50 transition-all">
              Create Account
            </Link>
            <Link to="/workers" className="bg-sky-700 text-white font-bold px-8 py-3 rounded-2xl hover:bg-sky-800 transition-all">
              Browse Workers
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-10">
        <div className="max-w-5xl mx-auto px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-sky-500 rounded-lg flex items-center justify-center">
              <Wrench className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-white text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Fixly</span>
            <span className="text-xs">— Sri Lanka's Local Service Marketplace</span>
          </div>
          <p className="text-xs">© 2024 Fixly. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
