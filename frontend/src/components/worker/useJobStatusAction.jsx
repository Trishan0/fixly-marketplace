import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { useToast } from '../../hooks/useToast'
import { errorMessage } from '../../lib/errors'
import api from '../../lib/api'

/**
 * Start / complete actions for a worker's assigned jobs.
 * Starting happens straight away; completing asks first, because it tells
 * the customer the work is done and moves the job to payment.
 * `isPending(job)` is true only for the row being updated.
 */
export function useJobStatusAction() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [confirmJob, setConfirmJob] = useState(null)

  const mutation = useMutation({
    mutationFn: ({ job, status }) => api.put(`/jobs/${job.id}/status`, { status }),
    meta: { track: 'job_status_changed', trackProps: ({ status }) => ({ status, by: 'worker' }) },
    onSuccess: (_data, { job, status }) => {
      setConfirmJob(null)
      toast({
        title: status === 'in_progress' ? 'Job marked as started' : 'Job marked as complete',
        description: status === 'in_progress'
          ? `We’ve let the customer know you’ve started “${job.title}”.`
          : 'The customer has been asked to record the payment.',
        variant: 'success',
      })
      qc.invalidateQueries({ queryKey: ['assigned-jobs'] })
      qc.invalidateQueries({ queryKey: ['job', job.id] })
    },
    onError: (error) => toast({ title: 'Couldn’t update the job', description: errorMessage(error), variant: 'error' }),
  })

  const start = (job) => mutation.mutate({ job, status: 'in_progress' })
  const requestComplete = (job) => setConfirmJob(job)
  const isPending = (job) => mutation.isPending && mutation.variables?.job.id === job.id

  const dialog = (
    <ConfirmDialog
      open={Boolean(confirmJob)}
      onClose={() => setConfirmJob(null)}
      onConfirm={() => mutation.mutate({ job: confirmJob, status: 'completed' })}
      loading={mutation.isPending && mutation.variables?.status === 'completed'}
      title="Mark this job as complete?"
      description={confirmJob ? `Only do this when “${confirmJob.title}” is finished. We’ll ask the customer to record the payment and leave a review.` : ''}
      confirmLabel="Mark as complete"
      tone="success"
    />
  )

  return { start, requestComplete, isPending, dialog }
}
