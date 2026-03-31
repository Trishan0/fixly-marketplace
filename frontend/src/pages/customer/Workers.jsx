import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { AppShell } from '../../components/layout/AppShell'
import { Modal, Select, Textarea, Button, PageHeader } from '../../components/shared/UI'
import WorkerCatalog from '../public/WorkerCatalog'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/api'

export default function WorkersPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [inviteWorker, setInviteWorker] = useState(null)
  const [jobId, setJobId] = useState('')
  const [message, setMessage] = useState('')

  const { data: myJobs = [] } = useQuery({
    queryKey: ['my-jobs-postable'],
    queryFn: () => api.get('/jobs/my').then(r =>
      r.data.filter(j => ['posted', 'proposals_received'].includes(j.status))
    ),
    enabled: user?.role === 'customer',
  })

  const sendInvite = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/invites`, { worker_id: inviteWorker.id, message }),
    onSuccess: () => {
      setInviteWorker(null)
      setJobId('')
      setMessage('')
      toast({ title: `Invite sent to ${inviteWorker.full_name}!`, variant: 'success' })
    },
    onError: (e) => toast({ title: 'Failed to send invite', description: e.response?.data?.error, variant: 'error' }),
  })

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto">
        <PageHeader
          title="Find Workers"
          description="Browse verified local professionals and invite them to your jobs"
        />
        <WorkerCatalog
          embedded
          onInvite={user?.role === 'customer' ? (worker) => setInviteWorker(worker) : undefined}
        />
      </div>

      <Modal
        open={!!inviteWorker}
        onClose={() => setInviteWorker(null)}
        title={`Invite ${inviteWorker?.full_name}`}
      >
        <div className="space-y-4">
          {myJobs.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-slate-500 text-sm mb-4">You have no active jobs to invite this worker to.</p>
              <a href="/jobs/new">
                <Button variant="primary">Post a Job First</Button>
              </a>
            </div>
          ) : (
            <>
              <Select
                label="Select Job *"
                value={jobId}
                onChange={e => setJobId(e.target.value)}
              >
                <option value="">Choose a job...</option>
                {myJobs.map(j => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </Select>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Message (optional)</label>
                <textarea
                  className="fixly-input resize-none"
                  rows={3}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Hi! I saw your profile and think you'd be great for this job..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setInviteWorker(null)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => sendInvite.mutate()}
                  loading={sendInvite.isPending}
                  disabled={!jobId}
                  className="flex-1"
                >
                  Send Invite
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </AppShell>
  )
}
