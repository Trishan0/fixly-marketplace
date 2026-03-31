import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Check, Upload, X } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Button, Input, Textarea, Select, Card } from '../../components/shared/UI'
import { useToast } from '../../hooks/useToast'
import { DISTRICTS, cn } from '../../lib/utils'
import api from '../../lib/api'

const URGENCIES = [
  { value: 'today', label: '🔥 Today', desc: 'Need it done ASAP' },
  { value: 'tomorrow', label: '📅 Tomorrow', desc: 'Can wait until tomorrow' },
  { value: 'this_week', label: '📆 This Week', desc: 'Flexible within the week' },
  { value: 'flexible', label: '🕐 Flexible', desc: 'No rush, whenever available' },
]

const PRICING_MODES = [
  { value: 'fixed', label: '💰 Fixed Budget', desc: 'I know my budget' },
  { value: 'ask_quotes', label: '💬 Ask for Quotes', desc: 'Let workers name their price' },
  { value: 'inspection', label: '🔍 After Inspection', desc: 'Price determined after site visit' },
]

const STEPS = ['Basics', 'Description', 'Photos', 'Location', 'Pricing', 'Review']

export default function PostJob() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [photos, setPhotos] = useState([])
  const [form, setForm] = useState({
    title: '', description: '', category_id: '', subcategory_id: '',
    urgency: 'flexible', district: '', town: '', address: '',
    pricing_mode: 'ask_quotes', fixed_budget: '',
  })
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/jobs/categories').then(r => r.data),
  })

  const createJob = useMutation({
    mutationFn: async () => {
      const payload = { ...form, fixed_budget: form.fixed_budget || undefined }
      const { data } = await api.post('/jobs', payload)
      if (photos.length > 0) {
        const fd = new FormData()
        photos.forEach(p => fd.append('photos', p.file))
        await api.post(`/jobs/${data.id}/photos`, fd)
      }
      return data
    },
    onSuccess: (data) => {
      toast({ title: 'Job posted!', description: 'Workers can now send you proposals.', variant: 'success' })
      navigate(`/jobs/${data.id}`)
    },
    onError: (err) => {
      toast({ title: 'Failed to post job', description: err.response?.data?.error, variant: 'error' })
    },
  })

  const handlePhotos = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 6 - photos.length)
    const newPhotos = files.map(file => ({ file, preview: URL.createObjectURL(file) }))
    setPhotos(p => [...p, ...newPhotos])
  }

  const stepContent = [
    // Step 0: Basics
    <div key="basics" className="space-y-4">
      <Input label="Job Title *" placeholder="e.g. Fix leaking kitchen pipe" value={form.title} onChange={set('title')} required />
      <Select label="Category *" value={form.category_id} onChange={set('category_id')}>
        <option value="">Select a category</option>
        {categories.filter(c => !c.parent_id).map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </Select>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Urgency</label>
        <div className="grid grid-cols-2 gap-2">
          {URGENCIES.map(u => (
            <button key={u.value} type="button" onClick={() => setForm(f => ({ ...f, urgency: u.value }))}
              className={cn('p-3 rounded-xl border text-left transition-all', form.urgency === u.value ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-sky-200')}>
              <p className="text-sm font-semibold">{u.label}</p>
              <p className="text-xs text-slate-500">{u.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>,

    // Step 1: Description
    <div key="description" className="space-y-4">
      <Textarea label="Describe the problem *" placeholder="Explain what needs to be done in detail..." value={form.description} onChange={set('description')} rows={6} required />
      <p className="text-xs text-slate-400">Tip: Good descriptions attract better workers. Include the problem, any relevant measurements, and what outcome you expect.</p>
    </div>,

    // Step 2: Photos
    <div key="photos" className="space-y-4">
      <p className="text-sm text-slate-500">Upload up to 6 photos of the job (optional but recommended)</p>
      <div className="grid grid-cols-3 gap-3">
        {photos.map((p, i) => (
          <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
            <img src={p.preview} className="w-full h-full object-cover" alt="" />
            <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {photos.length < 6 && (
          <label className="aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-sky-400 flex flex-col items-center justify-center cursor-pointer transition-all">
            <Upload className="w-5 h-5 text-slate-400 mb-1" />
            <span className="text-xs text-slate-400">Add photo</span>
            <input type="file" accept="image/*" multiple onChange={handlePhotos} className="hidden" />
          </label>
        )}
      </div>
    </div>,

    // Step 3: Location
    <div key="location" className="space-y-4">
      <Select label="District *" value={form.district} onChange={set('district')}>
        <option value="">Select district</option>
        {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
      </Select>
      <Input label="Town / Area" placeholder="e.g. Nugegoda" value={form.town} onChange={set('town')} />
      <Input label="Address / Landmark" placeholder="e.g. Near Nugegoda Market, Temple Road" value={form.address} onChange={set('address')} />
    </div>,

    // Step 4: Pricing
    <div key="pricing" className="space-y-4">
      <div className="space-y-2">
        {PRICING_MODES.map(m => (
          <button key={m.value} type="button" onClick={() => setForm(f => ({ ...f, pricing_mode: m.value }))}
            className={cn('w-full p-4 rounded-xl border text-left transition-all', form.pricing_mode === m.value ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-sky-200')}>
            <p className="font-semibold text-sm">{m.label}</p>
            <p className="text-xs text-slate-500">{m.desc}</p>
          </button>
        ))}
      </div>
      {form.pricing_mode === 'fixed' && (
        <Input label="Your Budget (LKR)" type="number" placeholder="5000" value={form.fixed_budget} onChange={set('fixed_budget')} />
      )}
    </div>,

    // Step 5: Review
    <div key="review" className="space-y-4">
      <div className="bg-slate-50 rounded-2xl p-4 space-y-3 text-sm">
        <ReviewRow label="Title" value={form.title} />
        <ReviewRow label="Category" value={categories.find(c => c.id === form.category_id)?.name || '—'} />
        <ReviewRow label="Urgency" value={URGENCIES.find(u => u.value === form.urgency)?.label} />
        <ReviewRow label="Location" value={[form.district, form.town].filter(Boolean).join(', ') || '—'} />
        <ReviewRow label="Pricing" value={PRICING_MODES.find(p => p.value === form.pricing_mode)?.label} />
        {form.pricing_mode === 'fixed' && form.fixed_budget && (
          <ReviewRow label="Budget" value={`LKR ${Number(form.fixed_budget).toLocaleString()}`} />
        )}
        <ReviewRow label="Photos" value={`${photos.length} photo${photos.length !== 1 ? 's' : ''}`} />
      </div>
      <p className="text-xs text-slate-400">By posting, this job will be visible to all workers in the platform.</p>
    </div>,
  ]

  const canNext = () => {
    if (step === 0) return form.title && form.category_id
    if (step === 1) return form.description
    if (step === 3) return form.district
    return true
  }

  return (
    <AppShell>
      <div className="fixly-page max-w-3xl">
        <div className="mb-8">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Post a Job</h1>
          <p className="text-slate-500 text-sm">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className={cn('h-1.5 rounded-full flex-1 transition-all duration-300', i <= step ? 'bg-sky-600' : 'bg-slate-200')} />
          ))}
        </div>

        <Card className="p-6 mb-6">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              {stepContent[step]}
            </motion.div>
          </AnimatePresence>
        </Card>

        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep(s => s - 1)} className="flex-1">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="flex-1">
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button variant="primary" onClick={() => createJob.mutate()} loading={createJob.isPending} className="flex-1">
              <Check className="w-4 h-4" /> Post Job
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value || '—'}</span>
    </div>
  )
}
