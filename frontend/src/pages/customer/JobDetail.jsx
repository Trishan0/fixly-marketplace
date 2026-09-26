import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Play,
  MapPin,
  Clock,
  DollarSign,
  Star,
  Phone,
  Trash2,
  CreditCard,
  Send,
  Bot,
} from "lucide-react";
import AgentPanel from "../../components/agent/AgentPanel";
import { AppShell } from "../../components/layout/AppShell";
import {
  Button,
  Badge,
  Card,
  Avatar,
  Modal,
  Input,
  Select,
  Textarea,
  Spinner,
} from "../../components/shared/UI";
import { ProposalCard } from "../../components/shared/Cards";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../hooks/useToast";
import {
  formatCurrency,
  formatDate,
  URGENCY_LABELS,
} from "../../lib/utils";
import api from "../../lib/api";
import { errorMessage, errorStatus } from "../../lib/errors";
import { usePageTitle } from "../../hooks/usePageTitle";
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";
import { ErrorFallback } from "../../components/shared/ErrorBoundary";

const DISPUTE_REASONS = [
  { value: "not_received", label: "I haven’t received this payment" },
  { value: "wrong_amount", label: "The amount is different from what I received" },
  { value: "other", label: "Something else" },
];

function failureToast(toast, title) {
  return (error) => toast({ title, description: errorMessage(error), variant: "error" });
}

export default function JobDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [payModal, setPayModal] = useState(false);
  const [priceModal, setPriceModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [payment, setPayment] = useState({
    amount: "",
    method: "cash",
    note: "",
  });
  const [agreedPrice, setAgreedPrice] = useState("");
  const [review, setReview] = useState({ rating: 5, feedback: "" });
  // One confirmation at a time: { kind, proposal? }
  const [confirming, setConfirming] = useState(null);

  const { data: job, isLoading, error: jobError, refetch: refetchJob } = useQuery({
    queryKey: ["job", id],
    queryFn: () => api.get(`/jobs/${id}`).then((r) => r.data),
  });
  usePageTitle(job?.title || "Job details");

  const { data: proposals = [] } = useQuery({
    queryKey: ["proposals", id],
    queryFn: () => api.get(`/jobs/${id}/proposals`).then((r) => r.data),
    enabled: !!job,
  });

  const isOwner = user?.id === job?.customer_id;
  const isAssignedWorker = user?.id === job?.assigned_worker_id;
  const isWorker = user?.role === "worker";
  const myProposal = isWorker ? proposals[0] : null;

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["job", id] });
    qc.invalidateQueries({ queryKey: ["proposals", id] });
    qc.invalidateQueries({ queryKey: ["my-jobs"] });
    qc.invalidateQueries({ queryKey: ["assigned-jobs"] });
  };
  const closeConfirm = () => setConfirming(null);

  const acceptProposal = useMutation({
    mutationFn: (pid) => api.put(`/proposals/${pid}/accept`),
    onSuccess: (_data, pid) => {
      const hired = proposals.find((p) => p.id === pid);
      closeConfirm();
      toast({
        title: `${hired?.worker_name || "Worker"} is hired`,
        description: "You can now see each other’s phone numbers. Agree a start time with them.",
        variant: "success",
      });
      refetch();
    },
    onError: failureToast(toast, "Couldn’t hire this worker"),
  });

  const declineProposal = useMutation({
    mutationFn: (pid) => api.put(`/proposals/${pid}/decline`),
    onSuccess: () => {
      closeConfirm();
      toast({ title: "Proposal declined", description: "We’ve let the worker know." });
      refetch();
    },
    onError: failureToast(toast, "Couldn’t decline this proposal"),
  });

  const updateStatus = useMutation({
    mutationFn: (status) => api.put(`/jobs/${id}/status`, { status }),
    onSuccess: (_data, status) => {
      closeConfirm();
      toast({
        title: status === "in_progress" ? "Job marked as started" : "Job marked as complete",
        description: status === "in_progress"
          ? "The customer has been notified."
          : "The customer has been notified and can now record the payment.",
        variant: "success",
      });
      refetch();
    },
    onError: failureToast(toast, "Couldn’t update the job"),
  });

  const refreshPayments = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["earnings"] });
  };

  const recordPayment = useMutation({
    mutationFn: () => api.post(`/jobs/${id}/payment`, payment),
    onSuccess: () => {
      setPayModal(false);
      toast({
        title: "Payment recorded",
        description: "We’ve asked the worker to confirm they received it.",
        variant: "success",
      });
      refreshPayments();
    },
    onError: failureToast(toast, "Payment not recorded"),
  });

  const confirmPayment = useMutation({
    mutationFn: () => api.put(`/payments/${job.payment_id}/confirm`),
    onSuccess: () => {
      toast({ title: "Payment confirmed", description: "Thanks — the customer has been notified.", variant: "success" });
      refreshPayments();
    },
    onError: failureToast(toast, "Couldn’t confirm the payment"),
  });

  const disputePayment = useMutation({
    mutationFn: (reason) => api.put(`/payments/${job.payment_id}/dispute`, { reason }),
    onSuccess: () => {
      closeConfirm();
      toast({ title: "Payment disputed", description: "We’ve shared your reason with the customer. Try to resolve it with them directly." });
      refreshPayments();
    },
    onError: failureToast(toast, "Couldn’t dispute the payment"),
  });

  const setFinalPrice = useMutation({
    mutationFn: () =>
      api.put(`/jobs/${id}/final-price`, { final_price: agreedPrice }),
    onSuccess: () => {
      setPriceModal(false);
      toast({ title: "Agreed price saved", description: "The worker has been notified.", variant: "success" });
      refetch();
    },
    onError: failureToast(toast, "Price not saved"),
  });

  const submitReview = useMutation({
    mutationFn: () => api.post(`/jobs/${id}/review`, review),
    onSuccess: () => {
      setReviewModal(false);
      toast({ title: "Review published", description: "Thanks for helping other customers choose well.", variant: "success" });
      refetch();
    },
    onError: failureToast(toast, "Review not submitted"),
  });

  const cancelJob = useMutation({
    mutationFn: () => api.delete(`/jobs/${id}`),
    onSuccess: () => {
      closeConfirm();
      qc.invalidateQueries({ queryKey: ["my-jobs"] });
      toast({ title: "Job cancelled", description: "Workers can no longer send proposals for it." });
      navigate("/jobs");
    },
    onError: failureToast(toast, "Couldn’t cancel the job"),
  });

  if (isLoading)
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <Spinner />
        </div>
      </AppShell>
    );
  if (!job) {
    const status = errorStatus(jobError);
    const copy = status === 403
      ? { title: "You don’t have access to this job", description: "Only the customer who posted it, the hired worker, and invited workers can view it." }
      : status === 404
        ? { title: "This job doesn’t exist", description: "It may have been removed, or the link is wrong." }
        : { title: "We couldn’t load this job", description: "Check your connection and try again." };
    return (
      <AppShell>
        <ErrorFallback {...copy} onRetry={status === 403 || status === 404 ? undefined : () => refetchJob()} />
      </AppShell>
    );
  }

  const canCancel =
    isOwner &&
    ![
      "in_progress",
      "completed",
      "payment_recorded",
      "reviewed",
      "cancelled",
    ].includes(job.status);
  const canRecordPayment = isOwner && job.status === "completed";
  const canReview =
    isOwner && ["completed", "payment_recorded"].includes(job.status);
  const canMarkStarted = isAssignedWorker && job.status === "assigned";
  const canMarkDone = isAssignedWorker && job.status === "in_progress";
  const canSendProposal =
    isWorker &&
    !isAssignedWorker &&
    ["posted", "proposals_received"].includes(job.status) &&
    !myProposal;
  const canSetFinalPrice =
    isOwner &&
    ["assigned", "in_progress", "completed"].includes(job.status) &&
    job.pricing_mode !== "fixed";

  return (
    <AppShell>
      <div className="fixly-page max-w-6xl space-y-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex min-h-11 items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {/* Job header */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge status={job.status} />
                {job.urgency && (
                  <span className="text-sm text-slate-500">
                    {URGENCY_LABELS[job.urgency]}
                  </span>
                )}
                {job.category_name && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    {job.category_name}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-slate-900">{job.title}</h1>
              <div className="flex items-center flex-wrap gap-4 mt-3 text-sm text-slate-500">
                {job.district && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {job.district}
                    {job.town ? `, ${job.town}` : ""}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDate(job.created_at)}
                </span>
                {job.final_price && (
                  <span className="flex items-center gap-1 font-semibold text-emerald-600">
                    <DollarSign className="w-4 h-4" />
                    {formatCurrency(job.final_price)}
                  </span>
                )}
              </div>
            </div>
            {job.pricing_mode === "fixed" && job.fixed_budget && (
              <div className="sm:text-right">
                <p className="text-xs text-slate-400">Fixed Budget</p>
                <p className="text-xl font-bold text-sky-700">
                  {formatCurrency(job.fixed_budget)}
                </p>
              </div>
            )}
          </div>

          {job.description && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70">
              <p className="text-sm text-slate-700 leading-relaxed">
                {job.description}
              </p>
            </div>
          )}

          {job.address && (
            <p className="mt-3 text-sm text-slate-500">📍 {job.address}</p>
          )}

          {/* Photos */}
          {job.photos?.length > 0 && (
            <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
              {job.photos.map((p) => (
                <img
                  key={p.id}
                  src={p.path}
                  alt=""
                  className="w-24 h-24 rounded-xl object-cover flex-shrink-0"
                />
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-5 grid grid-cols-1 gap-2 border-t border-slate-100 pt-5 min-[380px]:grid-cols-2 [&>a]:block [&>a_button]:w-full [&>button]:w-full dark:border-slate-800 sm:flex sm:flex-wrap sm:[&>a_button]:w-auto sm:[&>button]:w-auto">
            {/* AI Match Agent button — visible to job owner on active jobs */}
            {isOwner && ["posted", "proposals_received"].includes(job.status) && (
              <Button
                id="run-match-agent-btn"
                variant="primary"
                className="bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 shadow-md shadow-sky-200 dark:shadow-sky-900/30"
                onClick={() => setAgentOpen(true)}
              >
                <Bot className="w-4 h-4" /> Find Matching Workers
              </Button>
            )}
            {canSendProposal && (
              <Link to={`/jobs/${job.id}/propose`}>
                <Button variant="primary">
                  <Send className="w-4 h-4" /> Send Proposal
                </Button>
              </Link>
            )}
            {myProposal && (
              <Link to={`/jobs/${job.id}/propose`}>
                <Button variant="outline">
                  {myProposal.status === "declined"
                    ? "Proposal Rejected"
                    : myProposal.status === "accepted"
                      ? "Proposal Accepted"
                      : "Proposal Sent"}
                </Button>
              </Link>
            )}
            {canSetFinalPrice && (
              <Button
                variant="outline"
                onClick={() => {
                  setAgreedPrice(job.final_price || "");
                  setPriceModal(true);
                }}
              >
                {job.final_price ? "Update Agreed Price" : "Set Agreed Price"}
              </Button>
            )}
            {isAssignedWorker &&
              job.status === "payment_recorded" &&
              job.payment_id &&
              !job.payment_worker_confirmed &&
              !job.payment_disputed && (
                <>
                  <Button
                    variant="success"
                    onClick={() => confirmPayment.mutate()}
                    loading={confirmPayment.isPending}
                  >
                    Confirm Payment Received
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setConfirming({ kind: "dispute" })}
                  >
                    Dispute payment
                  </Button>
                </>
              )}
            {canMarkStarted && (
              <Button
                variant="primary"
                onClick={() => updateStatus.mutate("in_progress")}
                loading={updateStatus.isPending}
              >
                <Play className="w-4 h-4" /> Mark as started
              </Button>
            )}
            {canMarkDone && (
              <Button
                variant="success"
                onClick={() => setConfirming({ kind: "complete" })}
              >
                <CheckCircle2 className="w-4 h-4" /> Mark as complete
              </Button>
            )}
            {canRecordPayment && (
              <Button
                variant="primary"
                onClick={() => {
                  setPayment((p) => ({
                    ...p,
                    amount: job.final_price || p.amount,
                  }));
                  setPayModal(true);
                }}
              >
                <CreditCard className="w-4 h-4" /> Record Payment
              </Button>
            )}
            {canReview && (
              <Button variant="secondary" onClick={() => setReviewModal(true)}>
                <Star className="w-4 h-4" /> Leave Review
              </Button>
            )}
            {canCancel && (
              <Button
                variant="danger"
                onClick={() => setConfirming({ kind: "cancel" })}
              >
                <Trash2 className="w-4 h-4" /> Cancel job
              </Button>
            )}
          </div>
        </Card>

        {myProposal && (
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 mb-3">Your Proposal</h3>
            <div className="flex items-center gap-3 mb-3">
              <Badge status={myProposal.status} />
              {myProposal.proposed_price && (
                <span className="text-sm font-semibold text-sky-700">
                  {formatCurrency(myProposal.proposed_price)}
                </span>
              )}
              {myProposal.inspection_needed && (
                <span className="text-sm text-amber-600 font-medium">
                  Inspection needed
                </span>
              )}
            </div>
            {myProposal.availability && (
              <p className="text-sm text-slate-500">
                Availability: {myProposal.availability}
              </p>
            )}
            {myProposal.message && (
              <p className="text-sm text-slate-600 mt-2">
                {myProposal.message}
              </p>
            )}
          </Card>
        )}

        {job.payment_disputed && (isOwner || isAssignedWorker) && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30" role="status">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                {isOwner ? "The worker disputed this payment" : "You disputed this payment"}
              </p>
              {job.payment_dispute_reason && (
                <p className="mt-1 text-amber-800 dark:text-amber-300">Reason: {job.payment_dispute_reason}</p>
              )}
              <p className="mt-1 text-amber-800 dark:text-amber-300">
                Please talk to each other to sort it out. See our <Link to="/safety" className="font-semibold underline underline-offset-2">safety tips on payments</Link>.
              </p>
            </div>
          </div>
        )}

        {job.final_price && (
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 mb-2">Agreed Price</h3>
            <p className="text-xl font-bold text-emerald-600">
              {formatCurrency(job.final_price)}
            </p>
          </Card>
        )}

        {job.customer_id && (
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 mb-3">Posted By</h3>
            <div className="flex items-center gap-3">
              <Avatar
                name={job.customer_name}
                src={job.customer_photo}
                size="lg"
              />
              <div>
                <p className="font-semibold text-slate-900">
                  {job.customer_name}
                </p>
                {(job.district || job.town) && (
                  <p className="text-sm text-slate-500">
                    {[job.district, job.town].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
              <Link to={`/customers/${job.customer_id}`} className="ml-auto">
                <Button variant="outline" size="sm">
                  View Profile
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* Assigned worker contact reveal */}
        {job.assigned_worker_id && (
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 mb-3">
              Assigned Worker
            </h3>
            <div className="flex items-center gap-3">
              <Avatar
                name={job.assigned_worker_name}
                src={job.assigned_worker_photo}
                size="lg"
              />
              <div>
                <p className="font-semibold text-slate-900">
                  {job.assigned_worker_name}
                </p>
                <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                  <Phone className="w-3.5 h-3.5" />{" "}
                  {job.assigned_worker_phone || "-"}
                </p>
              </div>
              <Link
                to={`/workers/${job.assigned_worker_id}`}
                className="ml-auto"
              >
                <Button variant="outline" size="sm">
                  View Profile
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* Proposals */}
        {(isOwner || isAssignedWorker) && (
          <div>
            <h2 className="font-bold text-slate-900 mb-4">
              Proposals ({proposals.length})
            </h2>
            {proposals.length === 0 ? (
              <Card className="p-6 text-center text-slate-500 text-sm">
                No proposals yet. Workers will send proposals soon.
              </Card>
            ) : (
              <div className="space-y-4">
                {proposals.map((p) => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    isOwner={isOwner}
                    onAccept={() => setConfirming({ kind: "hire", proposal: p })}
                    onDecline={() => setConfirming({ kind: "decline", proposal: p })}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <Modal
        open={payModal}
        onClose={() => setPayModal(false)}
        title="Record Payment"
      >
        <div className="space-y-4">
          <Input
            label="Amount (LKR) *"
            type="number"
            value={payment.amount}
            onChange={(e) =>
              setPayment((p) => ({ ...p, amount: e.target.value }))
            }
            placeholder="5000"
          />
          <Select
            label="Payment Method"
            value={payment.method}
            onChange={(e) =>
              setPayment((p) => ({ ...p, method: e.target.value }))
            }
          >
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="other">Other</option>
          </Select>
          <Textarea
            label="Note (optional)"
            value={payment.note}
            onChange={(e) =>
              setPayment((p) => ({ ...p, note: e.target.value }))
            }
            placeholder="Any additional details..."
            rows={2}
          />
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setPayModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => recordPayment.mutate()}
              loading={recordPayment.isPending}
              className="flex-1"
            >
              Record Payment
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={priceModal}
        onClose={() => setPriceModal(false)}
        title="Set Agreed Price"
      >
        <div className="space-y-4">
          <Input
            label="Agreed Price (LKR) *"
            type="number"
            value={agreedPrice}
            onChange={(e) => setAgreedPrice(e.target.value)}
            placeholder="5000"
          />
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setPriceModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => setFinalPrice.mutate()}
              loading={setFinalPrice.isPending}
              className="flex-1"
            >
              Save Price
            </Button>
          </div>
        </div>
      </Modal>

      {/* Review Modal */}
      <Modal
        open={reviewModal}
        onClose={() => setReviewModal(false)}
        title="Leave a Review"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Rating
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setReview((r) => ({ ...r, rating: n }))}
                  className={`flex h-11 w-11 items-center justify-center text-3xl transition-transform hover:scale-110 ${n <= review.rating ? "text-amber-400" : "text-slate-200 dark:text-slate-700"}`}
                  aria-label={`${n} star${n === 1 ? '' : 's'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <Textarea
            label="Feedback"
            value={review.feedback}
            onChange={(e) =>
              setReview((r) => ({ ...r, feedback: e.target.value }))
            }
            placeholder="Share your experience with this worker..."
            rows={3}
          />
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setReviewModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => submitReview.mutate()}
              loading={submitReview.isPending}
              className="flex-1"
            >
              Submit Review
            </Button>
          </div>
        </div>
      </Modal>

      {(() => {
        const proposal = confirming?.proposal;
        const others = proposals.filter((p) => p.status === "pending" && p.id !== proposal?.id).length;
        const price = proposal?.proposed_price ? formatCurrency(proposal.proposed_price) : null;
        return (
          <>
            <ConfirmDialog
              open={confirming?.kind === "hire"}
              onClose={closeConfirm}
              onConfirm={() => acceptProposal.mutate(proposal.id)}
              loading={acceptProposal.isPending}
              title={`Hire ${proposal?.worker_name || "this worker"}?`}
              confirmLabel="Hire worker"
              description={
                <>
                  {price ? <>You’re hiring {proposal?.worker_name} for <strong>{price}</strong>. </> : <>{proposal?.worker_name} will confirm a price after inspecting the job. </>}
                  You’ll both be able to see each other’s phone number.
                  {others > 0 && <> The other {others} pending {others === 1 ? "proposal" : "proposals"} will be declined automatically.</>}
                </>
              }
            />
            <ConfirmDialog
              open={confirming?.kind === "decline"}
              onClose={closeConfirm}
              onConfirm={() => declineProposal.mutate(proposal.id)}
              loading={declineProposal.isPending}
              title={`Decline ${proposal?.worker_name || "this"}’s proposal?`}
              description="The worker will be told their proposal wasn’t chosen. You can’t undo this."
              confirmLabel="Decline proposal"
              tone="danger"
            />
            <ConfirmDialog
              open={confirming?.kind === "cancel"}
              onClose={closeConfirm}
              onConfirm={() => cancelJob.mutate()}
              loading={cancelJob.isPending}
              title="Cancel this job?"
              description={
                proposals.length > 0
                  ? `Workers will no longer be able to send proposals, and the ${proposals.length} ${proposals.length === 1 ? "worker who has" : "workers who have"} already applied won’t be able to be hired. You can’t undo this.`
                  : "Workers will no longer be able to find it or send proposals. You can’t undo this."
              }
              confirmLabel="Cancel job"
              cancelLabel="Keep job"
              tone="danger"
            />
            <ConfirmDialog
              open={confirming?.kind === "complete"}
              onClose={closeConfirm}
              onConfirm={() => updateStatus.mutate("completed")}
              loading={updateStatus.isPending}
              title="Mark this job as complete?"
              description="Only do this when the work is finished. We’ll ask the customer to record the payment and leave a review."
              confirmLabel="Mark as complete"
              tone="success"
            />
            <ConfirmDialog
              open={confirming?.kind === "dispute"}
              onClose={closeConfirm}
              onConfirm={(reason) => disputePayment.mutate(reason)}
              loading={disputePayment.isPending}
              title="Dispute this payment?"
              description={`The customer recorded ${formatCurrency(job.payment_amount)} by ${String(job.payment_method || "").replace("_", " ")}. Tell them what’s wrong so you can sort it out.`}
              confirmLabel="Dispute payment"
              tone="danger"
              reason={{ label: "What’s the problem?", placeholder: "For example: I received LKR 3,000, not LKR 4,000.", required: true, options: DISPUTE_REASONS }}
            />
          </>
        );
      })()}

      {/* ── Agent Panel slide-in modal ── */}
      {agentOpen && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Match Agent">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setAgentOpen(false)}
          />
          {/* Panel */}
          <div className="relative mt-auto flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-slide-in-right dark:bg-slate-900 sm:ml-auto sm:mt-0 sm:h-full sm:max-w-lg sm:rounded-none">
            <AgentPanel
              mode="match"
              jobId={id}
              onClose={() => setAgentOpen(false)}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}
