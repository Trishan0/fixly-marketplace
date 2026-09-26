import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Bot, Camera, Clock, Eye, LayoutDashboard, Save, ShieldAlert, Smartphone, Trash2, Upload } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Avatar, Input, Select, Textarea, Toggle } from '../../components/shared/UI'
import { Button, Card, IconChip, Page, PageHeader, StatusBadge, buttonClasses } from '../../components/ui'
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
      <Page width="default">
        <PageHeader
          title="Edit profile"
          description="Update what people see on your public profile."
          actions={<Button to="/profile" variant="secondary"><Eye className="h-4 w-4" aria-hidden="true" /> View public profile</Button>}
        />

        <div className="space-y-6">
          <SettingsSection title="Profile photo" description="A clear, friendly photo of your face builds trust.">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={user?.full_name} src={user?.profile_photo} size="xl" />
              <div className="space-y-1.5">
                <label className={buttonClasses({ variant: 'secondary', className: 'cursor-pointer focus-within:ring-2 focus-within:ring-brand' })}>
                  {uploadPhoto.isPending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Camera className="h-4 w-4" aria-hidden="true" />}
                  {uploadPhoto.isPending ? 'Uploading…' : 'Change photo'}
                  <input type="file" accept={IMAGE_ACCEPT} className="sr-only" disabled={uploadPhoto.isPending} onChange={pickFile(uploadPhoto)} />
                </label>
                <p className="text-xs text-fg-subtle">JPEG, PNG or WebP, up to 5 MB. Saves straight away.</p>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Basic information" description="Your name and where you are. Your phone number is only shared once a job is agreed.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Input label="Full name" value={form.full_name} onChange={set('full_name')} /></div>
              <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="077 123 4567" />
              <Select label="District" value={form.district} onChange={set('district')}>
                <option value="">Choose a district</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
              <div className="sm:col-span-2"><Input label="Area or town" value={form.area} onChange={set('area')} placeholder="e.g. Nugegoda" /></div>
            </div>
          </SettingsSection>

          {user?.role === 'worker' && (
            <SettingsSection title="Work details" description="What you do and roughly what you charge. Customers compare these first.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Main skill" value={form.primary_skill} onChange={set('primary_skill')}>
                  <option value="">Choose a skill</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
                <Input label="Starting price (LKR)" inputMode="decimal" value={form.starting_price} onChange={set('starting_price')} placeholder="e.g. 2500" error={startingPriceError} />
                <div className="sm:col-span-2">
                  <Textarea label="About you" value={form.bio} onChange={set('bio')} placeholder="Your experience, the kind of work you do best, and anything included in your price." rows={4} />
                </div>
              </div>
            </SettingsSection>
          )}

          <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end lg:pl-[calc(16rem+1.5rem)]">
            <p className="text-center text-xs text-fg-subtle sm:mr-auto sm:text-left">Photos and your NIC save as soon as you upload them.</p>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={Boolean(startingPriceError)}>
              <Save className="h-4 w-4" aria-hidden="true" /> Save changes
            </Button>
          </div>

          {user?.role === 'worker' && (
            <SettingsSection id="identity" title="Identity verification" description="Get a verified badge by uploading a photo of your NIC. Only Fixly reviewers see it.">
              {nicStatus === 'verified' ? (
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><BadgeCheck className="h-5 w-5" aria-hidden="true" /> Verified — the badge is on your profile</p>
              ) : nicStatus === 'pending' ? (
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300"><Clock className="h-5 w-5" aria-hidden="true" /> Under review — we’ll notify you when it’s checked</p>
              ) : (
                <div className="space-y-3">
                  {nicStatus === 'rejected' && (
                    <div className="flex items-start gap-2 rounded-control border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200" role="status">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <p><span className="font-semibold">We couldn’t verify your last photo.</span>{nicRejectionReason ? ` Reason: ${nicRejectionReason}.` : ''} Please upload a new, clear photo showing the whole card.</p>
                    </div>
                  )}
                  <label className={buttonClasses({ variant: 'secondary', className: 'cursor-pointer focus-within:ring-2 focus-within:ring-brand' })}>
                    {uploadNic.isPending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
                    {uploadNic.isPending ? 'Uploading…' : nicStatus === 'rejected' ? 'Upload a new photo' : 'Upload NIC'}
                    <input type="file" accept={IMAGE_ACCEPT} className="sr-only" disabled={uploadNic.isPending} onChange={pickFile(uploadNic)} />
                  </label>
                  <p className="text-xs text-fg-subtle">It’s never shown on your profile. See our <Link to="/privacy" className="font-semibold text-brand-text underline underline-offset-2">Privacy Policy</Link>.</p>
                </div>
              )}
            </SettingsSection>
          )}

          {user?.role === 'worker' && (
            <SettingsSection title="Portfolio" description={`${portfolioPhotos.length} of 10 photos. Pictures of finished work help customers choose you.`}>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {portfolioPhotos.map((p, index) => (
                  <div key={p.id} className="relative aspect-square">
                    <img src={p.path} alt={`Portfolio photo ${index + 1}`} className="h-full w-full rounded-control border border-line object-cover" />
                    <button type="button" onClick={() => setRemovingPhoto(p)} aria-label={`Remove portfolio photo ${index + 1}`}
                      className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/60 text-[#fff] hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {portfolioPhotos.length < 10 && (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-control border-2 border-dashed border-line-strong bg-subtle/50 transition-colors hover:border-brand hover:bg-brand-subtle focus-within:ring-2 focus-within:ring-brand">
                    {uploadPortfolio.isPending ? <span className="mb-1 h-5 w-5 animate-spin rounded-full border-2 border-fg-subtle border-t-transparent" /> : <Upload className="mb-1 h-5 w-5 text-fg-subtle" aria-hidden="true" />}
                    <span className="text-xs font-semibold text-fg-muted">{uploadPortfolio.isPending ? 'Uploading…' : 'Add photo'}</span>
                    <input type="file" accept={IMAGE_ACCEPT} className="sr-only" disabled={uploadPortfolio.isPending} onChange={pickFile(uploadPortfolio)} />
                  </label>
                )}
              </div>
            </SettingsSection>
          )}
        </div>
      </Page>

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
        {removingPhoto && <img src={removingPhoto.path} alt="" className="h-40 w-full rounded-control object-cover" />}
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

  const emailVerified = user?.is_email_verified || user?.force_verified
  return (
    <AppShell>
      <Page width="default">
        <PageHeader title="Settings" description="Your account and how Fixly works for you." />
        {user?.role === 'customer' && <div className="mb-6"><EmailVerificationNotice /></div>}

        <div className="space-y-6">
          <SettingsSection title="Account" description="The details you sign in with.">
            <dl className="divide-y divide-line text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                <dt className="text-fg-muted">Email</dt>
                <dd className="break-all font-medium text-fg">{user?.email}</dd>
              </div>
              <div className="flex items-center justify-between gap-2 py-3">
                <dt className="text-fg-muted">Account type</dt>
                <dd className="font-medium capitalize text-fg">{user?.role}</dd>
              </div>
              <div className="flex items-center justify-between gap-2 pt-3">
                <dt className="text-fg-muted">Email status</dt>
                <dd>{emailVerified
                  ? <StatusBadge tone="emerald">Verified</StatusBadge>
                  : <StatusBadge tone="amber">Not verified</StatusBadge>}</dd>
              </div>
            </dl>
          </SettingsSection>

          <SettingsSection title="Appearance" description="Choose how Fixly looks on this device.">
            <ThemeModeSelector />
          </SettingsSection>

          {user?.role === 'worker' && (
            <SettingsSection title="AI job matching" description="Let Fixly’s assistant recommend you to customers based on your skills, bio and reviews.">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <IconChip icon={Bot} tone="violet" />
                  <div>
                    <p className="text-sm font-semibold text-fg">Include me in AI matching</p>
                    <p className="mt-0.5 text-[13px] leading-5 text-fg-muted">
                      {aiMatchingOptIn
                        ? 'You may be recommended and invited to jobs that fit your skills, without sending a proposal first.'
                        : 'You won’t be recommended automatically. Customers only see you when you send a proposal.'}
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
            </SettingsSection>
          )}

          {user?.role === 'worker' && (
            <SettingsSection title="Dashboard" description="Pick the home screen that suits you best.">
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Dashboard mode">
                {[
                  ['standard', LayoutDashboard, 'Standard', 'Everything at a glance: stats, jobs and your profile.'],
                  ['simplified', Smartphone, 'Simple', 'Big buttons and fewer options. Easier on a phone.'],
                ].map(([value, Icon, label, description]) => {
                  const selected = user?.dashboard_mode === value
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setMode.mutate(value)}
                      className={cn(
                        'flex items-start gap-3 rounded-control border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                        selected ? 'border-brand bg-brand-subtle ring-1 ring-brand' : 'border-line bg-surface hover:border-line-strong hover:bg-subtle',
                      )}
                    >
                      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', selected ? 'text-brand-text' : 'text-fg-subtle')} aria-hidden="true" />
                      <span>
                        <span className="block text-sm font-semibold text-fg">{label}</span>
                        <span className="mt-0.5 block text-[13px] leading-5 text-fg-muted">{description}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </SettingsSection>
          )}
        </div>
      </Page>
    </AppShell>
  )
}

/** Settings row: what the section is on the left, the controls in a card on the right. */
function SettingsSection({ id, title, description, children }) {
  return (
    <section id={id} className="grid scroll-mt-24 gap-3 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-6" aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="lg:pt-1">
        <h2 id={id ? `${id}-title` : undefined} className="text-[15px] font-semibold text-fg">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-5 text-fg-muted">{description}</p>}
      </div>
      <Card className="p-4 sm:p-5">{children}</Card>
    </section>
  )
}
