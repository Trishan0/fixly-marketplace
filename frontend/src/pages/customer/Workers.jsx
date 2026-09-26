import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { AppShell } from '../../components/layout/AppShell'
import { Modal, Select, Textarea } from '../../components/shared/UI'
import { Button, Page, PageHeader } from '../../components/ui'
import WorkerCatalog from '../public/WorkerCatalog'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import { usePageTitle } from '../../hooks/usePageTitle'

export default function WorkersPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [inviteWorker, setInviteWorker] = useState(null)
  const [jobId, setJobId] = useState('')
  const [message, setMessage] = useState('')

  usePageTitle('Find workers')
  const { data: myJobs = [] } = useQuery({
    queryKey: ['my-jobs', 'invitable'],
    queryFn: () => api.get('/jobs/my', { params: { group: 'active', limit: 100 } }).then(r =>
      r.data.filter(j => ['posted', 'proposals_received'].includes(j.status))
    ),
    enabled: user?.role === 'customer',
  })

  const sendInvite = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/invites`, { worker_id: inviteWorker.id, message }),
    meta: { track: 'invite_sent', trackProps: () => ({ from: 'worker_list' }) },
    onSuccess: () => {
      setInviteWorker(null)
      setJobId('')
      setMessage('')
      toast({ title: `Invite sent to ${inviteWorker.full_name}`, description: 'We’ll notify you when they respond.', variant: 'success' })
    },
    onError: (e) => toast({ title: 'Invite not sent', description: errorMessage(e), variant: 'error' }),
  })

  return (
    <AppShell>
      <Page>
        <PageHeader
          title="Find workers"
          description="Browse local professionals and invite them to your jobs."
        />
        <WorkerCatalog
          embedded
          onInvite={user?.role === 'customer' ? (worker) => setInviteWorker(worker) : undefined}
        />
      </Page>

      <Modal
        open={!!inviteWorker}
        onClose={() => setInviteWorker(null)}
        title={`Invite ${inviteWorker?.full_name}`}
      >
        <div className="space-y-4">
          {myJobs.length === 0 ? (
            <div className="py-4 text-center">
              <p className="mb-4 text-sm text-fg-muted">You have no open jobs to invite this worker to.</p>
              <Button to={`/jobs/new?invite=${inviteWorker?.id}`}>Post a job and invite {inviteWorker?.full_name?.split(' ')[0]}</Button>
            </div>
          ) : (
            <>
              <Select
                label="Job"
                value={jobId}
                onChange={e => setJobId(e.target.value)}
              >
                <option value="">Choose a job…</option>
                {myJobs.map(j => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </Select>
              <Textarea
                label="Message (optional)"
                rows={3}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Hi! I saw your profile and think you’d be great for this job."
              />
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={() => setInviteWorker(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => sendInvite.mutate()}
                  loading={sendInvite.isPending}
                  disabled={!jobId}
                >
                  Send invite
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </AppShell>
  )
}
