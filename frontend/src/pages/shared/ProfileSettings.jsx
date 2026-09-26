import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, Camera, Trash2, Save, Bot, BadgeCheck, Clock, ShieldAlert } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Button, Card, Input, Textarea, Select, PageHeader, Avatar, Toggle } from '../../components/shared/UI'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { DISTRICTS, cn } from '../../lib/utils'
import api from '../../lib/api'
import { uploadSingleImage } from '../../lib/storage'
import { ThemeModeSelector } from '../../components/shared/ThemeToggle'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { EmailVerificationNotice } from '../../components/shared/EmailVerificationNotice'
import { errorMessage } from '../../lib/errors'
import { usePageTitle } from '../../hooks/usePageTitle'

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'

const CATEGORIES = ['Plumbing','Electrical','Carpentry','Cleaning','Painting','Tiling','Welding','AC Repair','Landscaping','General Labour']

// Older profiles stored free text such as "LKR 2,000"; keep just the number.
function startingPriceInput(value) {
  if (!value) return ''
  const numeric = Number(String(value).replace(/[^\d.]/g, ''))
  return Number.isFinite(numeric) && numeric > 0 ? String(numeric) : ''
}

const profileForm = (user) => ({
  full_name: user?.full_name || '',
  phone: user?.phone || '',
  district: user?.district || '',
  area: user?.area || '',
  bio: user?.bio || '',
  starting_price: startingPriceInput(user?.starting_price),
  primary_skill: user?.primary_skill || '',
})

export function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [form, setForm] = useState(() => profileForm(user))
  const [removingPhoto, setRemovingPhoto] = useState(null)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  usePageTitle('Edit profile')

  // The full profile (portfolio, skills) comes from /profile/me; the session
  // user from /auth/me only carries the basics.
  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/profile/me').then(r => r.data),
  })
  const portfolioPhotos = profile?.portfolio_photos || []
  const nicStatus = profile?.nic_status || user?.nic_status || 'none'
  const nicRejectionReason = profile?.nic_rejection_reason || user?.nic_rejection_reason

  useEffect(() => {
    if (window.location.hash === '#identity') document.getElementById('identity')?.scrollIntoView({ block: 'center' })
  }, [])

  const refreshProfile = () => {
    refreshUser().catch(() => {})
    qc.invalidateQueries({ queryKey: ['my-profile'] })
  }
  const failed = (title) => (error) => toast({ title, description: errorMessage(error), variant: 'error' })

  const startingPriceError = form.starting_price && !/^\d+(\.\d{1,2})?$/.test(form.starting_price)
    ? 'Enter a number in rupees, for example 2500'
    : ''

  const save = useMutation({
    mutationFn: () => api.put('/profile/me', { ...form, starting_price: form.starting_price || null }),
    onSuccess: () => { refreshProfile(); toast({ title: 'Profile saved', variant: 'success' }) },
    onError: failed('Profile not saved'),
  })

  const uploadPhoto = useMutation({
    mutationFn: (file) => uploadSingleImage({ file, kind: 'profile', endpoint: '/profile/photo', fieldName: 'photo' }),
    onSuccess: () => { refreshProfile(); toast({ title: 'Profile photo updated', variant: 'success' }) },
    onError: failed('Photo not uploaded'),
  })

  const uploadNic = useMutation({
    mutationFn: (file) => uploadSingleImage({ file, kind: 'nic', endpoint: '/profile/nic-upload', fieldName: 'nic_image' }),
    onSuccess: () => { refreshProfile(); toast({ title: 'NIC submitted', description: 'We’ll review it and notify you, usually within 2 working days.', variant: 'success' }) },
    onError: failed('NIC not uploaded'),
  })

  const uploadPortfolio = useMutation({
    mutationFn: (file) => uploadSingleImage({ file, kind: 'portfolio', endpoint: '/profile/portfolio', fieldName: 'photo' }),
    onSuccess: () => { refreshProfile(); toast({ title: 'Photo added to your portfolio', variant: 'success' }) },
    onError: failed('Photo not added'),
  })

  const deletePortfolio = useMutation({
    mutationFn: (id) => api.delete(`/profile/portfolio/${id}`),
    onSuccess: () => { setRemovingPhoto(null); refreshProfile(); toast({ title: 'Photo removed' }) },
    onError: failed('Photo not removed'),
  })

  const pickFile = (mutation) => (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) mutation.mutate(file)
  }

  return (
    <AppShell>
      <div className="fixly-page max-w-4xl space-y-5">
        <PageHeader
          title="Edit Profile"
          description="Update the information shown on your public profile"
          action={<Link to="/profile"><Button variant="outline">View Public Profile</Button></Link>}
        />

        {/* Photo */}
        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Profile Photo</h3>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={user?.full_name} src={user?.profile_photo} size="xl" />
            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-sky-500 dark:border-slate-700 dark:text-slate-200">
              {uploadPhoto.isPending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Camera className="w-4 h-4" />}
              {uploadPhoto.isPending ? 'Uploading…' : 'Change photo'}
              <input type="file" accept={IMAGE_ACCEPT} className="sr-only" disabled={uploadPhoto.isPending} onChange={pickFile(uploadPhoto)} />
            </label>
            <p className="w-full text-xs text-slate-500 sm:w-auto">JPEG, PNG or WebP, up to 5 MB.</p>
          </div>
        </Card>

        {/* Basic info */}
        <Card className="space-y-4 p-4 sm:p-6">
          <h3 className="font-semibold text-slate-800">Basic Information</h3>
          <Input label="Full Name" value={form.full_name} onChange={set('full_name')} />
          <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="077 123 4567" />
          <Select label="District" value={form.district} onChange={set('district')}>
            <option value="">Select district</option>
            {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
          <Input label="Area / Town" value={form.area} onChange={set('area')} placeholder="e.g. Nugegoda" />
        </Card>

        {/* Worker-specific */}
        {user?.role === 'worker' && (
          <Card className="space-y-4 p-4 sm:p-6">
            <h3 className="font-semibold text-slate-800">Worker Details</h3>
            <Select label="Primary Skill" value={form.primary_skill} onChange={set('primary_skill')}>
              <option value="">Select skill</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input label="Starting price (LKR)" inputMode="decimal" value={form.starting_price} onChange={set('starting_price')} placeholder="e.g. 2500" error={startingPriceError} />
            <Textarea label="Bio" value={form.bio} onChange={set('bio')} placeholder="Describe your experience and expertise..." rows={4} />
          </Card>
        )}

        {/* NIC Verification */}
        {user?.role === 'worker' && (
        <Card id="identity" className="scroll-mt-24 p-4 sm:p-6">
          <h3 className="font-semibold text-slate-800 mb-2">Identity verification</h3>
          <p className="text-sm text-slate-500 mb-4">
            Upload a clear photo of your NIC to get a verified badge. Only Fixly reviewers see it; it is never shown on your profile.
            {' '}See our <Link to="/privacy" className="font-semibold text-sky-700 underline underline-offset-2 dark:text-sky-300">Privacy Policy</Link>.
          </p>
          {nicStatus === 'verified' ? (
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><BadgeCheck className="h-5 w-5" aria-hidden="true" /> Verified — the badge is on your profile</p>
          ) : nicStatus === 'pending' ? (
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300"><Clock className="h-5 w-5" aria-hidden="true" /> Under review — we’ll notify you when it’s checked</p>
          ) : (
            <div className="space-y-3">
              {nicStatus === 'rejected' && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200" role="status">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p><span className="font-semibold">We couldn’t verify your last photo.</span>{nicRejectionReason ? ` Reason: ${nicRejectionReason}.` : ''} Please upload a new, clear photo showing the whole card.</p>
                </div>
              )}
              <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-sky-500 dark:border-slate-700 dark:text-slate-200">
                {uploadNic.isPending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Upload className="w-4 h-4" />}
                {uploadNic.isPending ? 'Uploading…' : nicStatus === 'rejected' ? 'Upload a new photo' : 'Upload NIC'}
                <input type="file" accept={IMAGE_ACCEPT} className="sr-only" disabled={uploadNic.isPending} onChange={pickFile(uploadNic)} />
              </label>
            </div>
          )}
        </Card>
        )}

        {/* Portfolio (workers only) */}
        {user?.role === 'worker' && (
          <Card className="p-4 sm:p-6">
            <h3 className="font-semibold text-slate-800 mb-1">Portfolio photos</h3>
            <p className="mb-4 text-sm text-slate-500">{portfolioPhotos.length} of 10 · Photos of your finished work help customers choose you.</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {portfolioPhotos.map((p, index) => (
                <div key={p.id} className="relative aspect-square">
                  <img src={p.path} alt={`Portfolio photo ${index + 1}`} className="w-full h-full object-cover rounded-xl" />
                  <button type="button" onClick={() => setRemovingPhoto(p)} aria-label={`Remove portfolio photo ${index + 1}`}
                    className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {portfolioPhotos.length < 10 && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-sky-400 focus-within:ring-2 focus-within:ring-sky-500 flex flex-col items-center justify-center cursor-pointer dark:border-slate-700">
                  {uploadPortfolio.isPending ? <span className="mb-1 h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" /> : <Upload className="w-5 h-5 text-slate-500 mb-1" />}
                  <span className="text-xs font-semibold text-slate-500">{uploadPortfolio.isPending ? 'Uploading…' : 'Add photo'}</span>
                  <input type="file" accept={IMAGE_ACCEPT} className="sr-only" disabled={uploadPortfolio.isPending} onChange={pickFile(uploadPortfolio)} />
                </label>
              )}
            </div>
          </Card>
        )}

        <Button variant="primary" size="lg" onClick={() => save.mutate()} loading={save.isPending} disabled={Boolean(startingPriceError)} className="w-full">
          <Save className="w-4 h-4" /> Save profile details
        </Button>
        <p className="-mt-2 text-center text-xs text-slate-500">Photos and your NIC save as soon as you upload them.</p>
      </div>

      <ConfirmDialog
        open={Boolean(removingPhoto)}
        onClose={() => setRemovingPhoto(null)}
        onConfirm={() => deletePortfolio.mutate(removingPhoto.id)}
        loading={deletePortfolio.isPending}
        title="Remove this photo?"
        description="It will be removed from your public portfolio."
        confirmLabel="Remove photo"
        tone="danger"
      >
        {removingPhoto && <img src={removingPhoto.path} alt="" className="h-40 w-full rounded-xl object-cover" />}
      </ConfirmDialog>
    </AppShell>
  )
}

export function SettingsPage() {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  usePageTitle('Settings')

  const setMode = useMutation({
    mutationFn: (mode) => api.put('/profile/dashboard-mode', { mode }),
    onSuccess: () => { refreshUser(); toast({ title: 'Dashboard mode updated', variant: 'success' }) },
    onError: (e) => toast({ title: 'Couldn’t change dashboard mode', description: errorMessage(e), variant: 'error' }),
  })

  // Defaults to true (matches the backend default) until the profile has
  // loaded, so the toggle never flashes "excluded" for a moment on load.
  const aiMatchingOptIn = user?.ai_matching_opt_in !== false
  const setAiMatching = useMutation({
    mutationFn: (optIn) => api.put('/profile/ai-matching-opt-in', { opt_in: optIn }),
    onSuccess: (_data, optIn) => {
      refreshUser()
      toast({
        title: optIn ? "You're now included in AI job matching" : "You've been excluded from AI job matching",
        variant: 'success',
      })
    },
    onError: (e) => toast({ title: 'Couldn’t update AI matching', description: errorMessage(e), variant: 'error' }),
  })

  return (
    <AppShell>
      <div className="fixly-page max-w-4xl space-y-5">
        <PageHeader title="Settings" />
        {user?.role === 'customer' && <EmailVerificationNotice />}

        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold text-slate-800 mb-1">Account</h3>
          <p className="text-sm text-slate-500 mb-4">Your account details</p>
          <div className="space-y-2 text-sm">
            <div className="grid gap-1 border-b border-slate-50 py-2 sm:grid-cols-[auto_1fr] sm:gap-4">
              <span className="text-slate-500">Email</span>
              <span className="break-all font-medium sm:text-right">{user?.email}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">Role</span>
              <span className="font-medium capitalize">{user?.role}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">Email Verified</span>
              <span className={user?.is_email_verified || user?.force_verified ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                {user?.is_email_verified || user?.force_verified ? '✓ Verified' : 'Not Verified'}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold text-slate-800 mb-1">Appearance</h3>
          <p className="text-sm text-slate-500 mb-4">Choose how Fixly should look on this device</p>
          <ThemeModeSelector />
        </Card>

        {user?.role === 'worker' && (
          <Card className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900/30">
                  <Bot className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white">AI Job Matching</h3>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    Lets Fixly's AI recommend you to customers automatically, based on your skills, bio, and past reviews.
                  </p>
                </div>
              </div>
              <Toggle
                checked={aiMatchingOptIn}
                onChange={(next) => setAiMatching.mutate(next)}
                disabled={setAiMatching.isPending}
                label="Include me in AI job matching"
                className="mt-1"
              />
            </div>

            {aiMatchingOptIn ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">✓ Included in AI matching</p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-600 dark:text-emerald-400">
                  When a customer posts a job that fits your skills, our AI agent reads your profile, bio, and past customer
                  reviews to decide if you're a strong match — you may be recommended and invited without sending a
                  proposal yourself.
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">⛔ Excluded from AI matching</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                  You won't be recommended by the AI matching system, so customers will only see you if you send a
                  proposal yourself. Turn this on any time to start getting discovered automatically.
                </p>
              </div>
            )}
          </Card>
        )}

        {user?.role === 'worker' && (
          <Card className="p-4 sm:p-6">
            <h3 className="font-semibold text-slate-800 mb-1">Dashboard Mode</h3>
            <p className="text-sm text-slate-500 mb-4">Choose your preferred dashboard experience</p>
            <div className="grid grid-cols-2 gap-3">
              {[['standard', '🖥️ Standard', 'Full-featured dashboard with all details'], ['simplified', '📱 Simplified', 'Large buttons, fewer options, easier to use']].map(([v, l, d]) => (
                <button key={v} type="button" onClick={() => setMode.mutate(v)} aria-pressed={user?.dashboard_mode === v}
                  className={cn('min-h-28 rounded-2xl border p-3 text-left transition-all sm:p-4', user?.dashboard_mode === v ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40' : 'border-slate-200 hover:border-sky-200 dark:border-slate-700')}>
                  <p className="font-semibold text-sm">{l}</p>
                  <p className="text-xs text-slate-500 mt-1">{d}</p>
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
