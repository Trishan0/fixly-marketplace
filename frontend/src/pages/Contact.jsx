import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock, Mail, MapPin, MessageCircle, Send } from 'lucide-react'
import { PublicNavbar } from '../components/shared/PublicNavbar'
import { PublicFooter } from '../components/shared/PublicFooter'
import { Button, Input, Select, Textarea } from '../components/shared/UI'
import { useToast } from '../hooks/useToast'
import api from '../lib/api'

const contactOptions = [
  { icon: MessageCircle, title: 'Using Fixly', description: 'Need help posting a job, creating a worker profile, or understanding a proposal?', action: 'Explore how it works', to: '/how-it-works' },
  { icon: Mail, title: 'Demo and project enquiries', description: 'Tell us what you are building, presenting, or evaluating. The team can reply directly to your email.', action: 'Send a message', to: '#contact-form' },
  { icon: MapPin, title: 'Local-first marketplace', description: 'Fixly is designed around the way customers and skilled workers connect across Sri Lanka.', action: 'Browse workers', to: '/workers' },
]

export default function Contact() {
  const { toast } = useToast()
  const [form, setForm] = useState({ name: '', email: '', topic: 'Getting started', message: '', website: '' })
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)

  const update = (field) => (event) => setForm(current => ({ ...current, [field]: event.target.value }))
  const submit = async (event) => {
    event.preventDefault()
    setIsSending(true)
    try {
      await api.post('/contact', form)
      setSent(true)
      setForm({ name: '', email: '', topic: 'Getting started', message: '', website: '' })
      toast({ title: 'Message sent', description: 'The Fixly team will reply to the email you provided.', variant: 'success' })
    } catch (error) {
      toast({ title: 'Message could not be sent', description: error.response?.data?.error || 'Please try again shortly.', variant: 'error' })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixly-page-shell min-h-[100dvh] overflow-x-hidden">
      <PublicNavbar />
      <main>
        <section className="border-b border-slate-100 bg-[radial-gradient(circle_at_85%_0%,rgba(14,165,233,0.16),transparent_35%)] py-12 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_85%_0%,rgba(14,165,233,0.22),transparent_35%)] sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-12">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">Contact Fixly</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.035em] text-slate-950 dark:text-white sm:text-5xl">Let&apos;s make local work simpler.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">Whether you are exploring the marketplace or preparing a project enquiry, this is the right place to start.</p>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 md:px-12">
          <div className="grid gap-4 lg:grid-cols-3">
            {contactOptions.map(({ icon: Icon, title, description, action, to }) => (
              <div key={title} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/45 dark:text-sky-300"><Icon className="h-5 w-5" /></div>
                <h2 className="mt-5 text-lg font-black text-slate-950 dark:text-white">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
                {to.startsWith('#') ? <a href={to} className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-sky-700 dark:text-sky-300">{action} <ArrowRight className="h-4 w-4" /></a> : <Link to={to} className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-sky-700 dark:text-sky-300">{action} <ArrowRight className="h-4 w-4" /></Link>}
              </div>
            ))}
          </div>
          <div id="contact-form" className="mt-12 scroll-mt-28 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900 sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">Send a message</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">Tell us how we can help.</h2>
                <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">Use this form for feedback, support, or a demo/project enquiry. We will reply to the email you provide.</p>
                {sent && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">Thanks—your message has been sent. The Fixly team will reply by email.</div>}
              </div>
              <form onSubmit={submit} className="grid gap-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Your name" value={form.name} onChange={update('name')} placeholder="e.g. Nadeesha Perera" autoComplete="name" required />
                  <Input label="Email address" type="email" value={form.email} onChange={update('email')} placeholder="you@example.com" autoComplete="email" required />
                </div>
                <Select label="What can we help with?" value={form.topic} onChange={update('topic')}>
                  <option>Getting started</option>
                  <option>Customer support</option>
                  <option>Worker support</option>
                  <option>Demo or project enquiry</option>
                  <option>Other</option>
                </Select>
                <Textarea label="Your message" value={form.message} onChange={update('message')} placeholder="Please tell us a little about what you need..." rows={6} required />
                <div className="sr-only" aria-hidden="true">
                  <label htmlFor="website">Website</label>
                  <input id="website" name="website" value={form.website} onChange={update('website')} tabIndex="-1" autoComplete="off" />
                </div>
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-slate-500">We only use your details to respond to this message.</p>
                  <Button type="submit" loading={isSending} className="rounded-xl sm:shrink-0">Send message <Send className="h-4 w-4" /></Button>
                </div>
              </form>
            </div>
          </div>
          <div className="mt-12 grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/45 dark:text-sky-300"><Clock className="h-5 w-5" /></div>
              <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">Already know what you need?</h2>
              <p className="mt-2 max-w-2xl leading-7 text-slate-600 dark:text-slate-300">Start with the marketplace. Customers can post a job in minutes, while workers can build a profile and discover suitable work.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link to="/auth?tab=register&role=customer" className="fixly-btn-primary rounded-2xl text-sm">Post a job</Link>
              <Link to="/auth?tab=register&role=worker" className="fixly-btn-secondary rounded-2xl text-sm">Join as worker</Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
