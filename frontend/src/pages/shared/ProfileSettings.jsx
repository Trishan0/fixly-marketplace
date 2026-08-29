import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Upload, Camera, Trash2, Save } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Button, Card, Input, Textarea, Select, PageHeader, Avatar } from '../../components/shared/UI'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { DISTRICTS, cn } from '../../lib/utils'
import api from '../../lib/api'
import { ThemeModeSelector } from '../../components/shared/ThemeToggle'

const CATEGORIES = ['Plumbing','Electrical','Carpentry','Cleaning','Painting','Tiling','Welding','AC Repair','Landscaping','General Labour']

const profileForm = (user) => ({
  full_name: user?.full_name || '',
  phone: user?.phone || '',
  district: user?.district || '',
  area: user?.area || '',
  bio: user?.bio || '',
  starting_price: user?.starting_price || '',
  primary_skill: user?.primary_skill || '',
})

export function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const [form, setForm] = useState(() => profileForm(user))
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const save = useMutation({
    mutationFn: () => api.put('/profile/me', form),
    onSuccess: () => { refreshUser(); toast({ title: 'Profile saved!', variant: 'success' }) },
    onError: (e) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'error' }),
  })

  const uploadPhoto = useMutation({
    mutationFn: (file) => {
      const fd = new FormData(); fd.append('photo', file)
      return api.post('/profile/photo', fd)
    },
    onSuccess: () => { refreshUser(); toast({ title: 'Photo updated!', variant: 'success' }) },
  })

  const uploadNic = useMutation({
    mutationFn: (file) => {
      const fd = new FormData(); fd.append('nic_image', file)
      return api.post('/profile/nic-upload', fd)
    },
    onSuccess: () => { refreshUser(); toast({ title: 'NIC uploaded! Pending verification.', variant: 'success' }) },
  })

  const uploadPortfolio = useMutation({
    mutationFn: (file) => {
      const fd = new FormData(); fd.append('photo', file)
      return api.post('/profile/portfolio', fd)
    },
    onSuccess: () => { refreshUser(); toast({ title: 'Photo added!', variant: 'success' }) },
    onError: (e) => toast({ title: 'Failed', description: e.response?.data?.error, variant: 'error' }),
  })

  const deletePortfolio = useMutation({
    mutationFn: (id) => api.delete(`/profile/portfolio/${id}`),
    onSuccess: () => { refreshUser(); toast({ title: 'Photo removed' }) },
  })

  return (
    <AppShell>
      <div className="fixly-page max-w-4xl space-y-5">
        <PageHeader title="Edit Profile" description="Update the information shown on your public profile" />
        <div className="flex justify-end">
          <Link to="/profile">
            <Button variant="outline">View Public Profile</Button>
          </Link>
        </div>

        {/* Photo */}
        <Card className="p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Profile Photo</h3>
          <div className="flex items-center gap-4">
            <Avatar name={user?.full_name} src={user?.profile_photo} size="xl" />
            <label className="cursor-pointer">
              <Button variant="outline" as="span">
                <Camera className="w-4 h-4" /> Change Photo
              </Button>
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && uploadPhoto.mutate(e.target.files[0])} />
            </label>
          </div>
        </Card>

        {/* Basic info */}
        <Card className="p-6 space-y-4">
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
          <Card className="p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">Worker Details</h3>
            <Select label="Primary Skill" value={form.primary_skill} onChange={set('primary_skill')}>
              <option value="">Select skill</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input label="Starting Price" value={form.starting_price} onChange={set('starting_price')} placeholder="e.g. LKR 2,000" />
            <Textarea label="Bio" value={form.bio} onChange={set('bio')} placeholder="Describe your experience and expertise..." rows={4} />
          </Card>
        )}

        {/* NIC Verification */}
        <Card className="p-6">
          <h3 className="font-semibold text-slate-800 mb-2">Identity Verification</h3>
          <p className="text-sm text-slate-500 mb-4">Upload your NIC to get a verified badge on your profile</p>
          <div className="flex items-center gap-3">
            {user?.is_nic_verified ? (
              <span className="text-emerald-600 font-semibold text-sm flex items-center gap-1">✓ Verified</span>
            ) : user?.nic_image_path ? (
              <span className="text-amber-600 font-semibold text-sm">⏳ Under review</span>
            ) : (
              <label className="cursor-pointer">
                <Button variant="outline" as="span">
                  <Upload className="w-4 h-4" /> Upload NIC
                </Button>
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && uploadNic.mutate(e.target.files[0])} />
              </label>
            )}
          </div>
        </Card>

        {/* Portfolio (workers only) */}
        {user?.role === 'worker' && (
          <Card className="p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Portfolio Photos (max 10)</h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {(user?.portfolio_photos || []).map(p => (
                <div key={p.id} className="relative aspect-square">
                  <img src={p.path} alt="" className="w-full h-full object-cover rounded-xl" />
                  <button onClick={() => deletePortfolio.mutate(p.id)}
                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-red-500">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {(user?.portfolio_photos?.length || 0) < 10 && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-sky-400 flex flex-col items-center justify-center cursor-pointer">
                  <Upload className="w-5 h-5 text-slate-400 mb-1" />
                  <span className="text-xs text-slate-400">Add</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && uploadPortfolio.mutate(e.target.files[0])} />
                </label>
              )}
            </div>
          </Card>
        )}

        <Button variant="primary" size="lg" onClick={() => save.mutate()} loading={save.isPending} className="w-full">
          <Save className="w-4 h-4" /> Save Profile
        </Button>
      </div>
    </AppShell>
  )
}

export function SettingsPage() {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()

  const setMode = useMutation({
    mutationFn: (mode) => api.put('/profile/dashboard-mode', { mode }),
    onSuccess: () => { refreshUser(); toast({ title: 'Dashboard mode updated!', variant: 'success' }) },
  })

  return (
    <AppShell>
      <div className="fixly-page max-w-4xl space-y-5">
        <PageHeader title="Settings" />

        <Card className="p-6">
          <h3 className="font-semibold text-slate-800 mb-1">Account</h3>
          <p className="text-sm text-slate-500 mb-4">Your account details</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">Email</span>
              <span className="font-medium">{user?.email}</span>
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

        <Card className="p-6">
          <h3 className="font-semibold text-slate-800 mb-1">Appearance</h3>
          <p className="text-sm text-slate-500 mb-4">Choose how Fixly should look on this device</p>
          <ThemeModeSelector />
        </Card>

        {user?.role === 'worker' && (
          <Card className="p-6">
            <h3 className="font-semibold text-slate-800 mb-1">Dashboard Mode</h3>
            <p className="text-sm text-slate-500 mb-4">Choose your preferred dashboard experience</p>
            <div className="grid grid-cols-2 gap-3">
              {[['standard', '🖥️ Standard', 'Full-featured dashboard with all details'], ['simplified', '📱 Simplified', 'Large buttons, fewer options, easier to use']].map(([v, l, d]) => (
                <button key={v} onClick={() => setMode.mutate(v)}
                  className={cn('p-4 rounded-2xl border text-left transition-all', user?.dashboard_mode === v ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-sky-200')}>
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
