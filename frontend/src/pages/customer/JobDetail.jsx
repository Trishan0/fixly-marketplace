import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Banknote,
  Bot,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  MapPin,
  MessagesSquare,
  Pencil,
  Phone,
  Play,
  Send,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import AgentPanel from "../../components/agent/AgentPanel";
import { AppShell } from "../../components/layout/AppShell";
import { Button, Badge, Card, Avatar, Modal, Input, Select, Textarea, Spinner } from "../../components/shared/UI";
import { ProposalCard } from "../../components/shared/Cards";
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";
import { ErrorFallback } from "../../components/shared/ErrorBoundary";
import { ReportButton } from "../../components/shared/ReportDialog";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../hooks/useToast";
import { usePageTitle } from "../../hooks/usePageTitle";
import { cn, formatCurrency, formatDate, pluralize, URGENCY_LABELS } from "../../lib/utils";
import { errorMessage, errorStatus } from "../../lib/errors";
import { threadPath } from "../../lib/messages";
import api from "../../lib/api";

const DISPUTE_REASONS = [
  { value: "not_received", label: "I haven’t received this payment" },
  { value: "wrong_amount", label: "The amount is different from what I received" },
  { value: "other", label: "Something else" },
];

const PAYMENT_METHODS = { cash: "cash", bank_transfer: "bank transfer", other: "another method" };
const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;

// The happy path of a job, in order. "Proposals" is skipped when a job is
// hired straight from an invite, so each step's time comes from the first
// status at or after it.
const TIMELINE = [
  { key: "posted", label: "Posted" },
  { key: "proposals_received", label: "Proposals received" },
  { key: "assigned", label: "Worker hired" },
  { key: "in_progress", label: "Work started" },
  { key: "completed", label: "Work completed" },
  { key: "payment_recorded", label: "Payment recorded" },
  { key: "reviewed", label: "Reviewed" },
];
const ORDER = TIMELINE.map((step) => step.key);

function failureToast(toast, title) {
  return (error) => toast({ title, description: errorMessage(error), variant: "error" });
}

function JobTimeline({ job }) {
  const events = job.status_events || [];
  const firstAt = (status) => events.find((event) => event.status === status)?.created_at;
  const cancelledAt = firstAt("cancelled");
  // The furthest step reached (a cancelled job keeps the steps it passed).
  const reachedIndex = Math.max(
    ...events.map((event) => ORDER.indexOf(event.status)),
    job.status === "cancelled" ? -1 : ORDER.indexOf(job.status),
    0,
  );
  const currentIndex = job.status === "cancelled" ? -1 : ORDER.indexOf(job.status);

  return (
    <ol className="relative space-y-0" aria-label="Job progress">
      {TIMELINE.map((step, index) => {
        const done = index < reachedIndex || (index === reachedIndex && job.status !== "cancelled" && index === ORDER.length - 1);
        const current = index === currentIndex && !done;
        // Only the proposals step can genuinely be skipped (hiring straight
        // from an invite). Other passed steps without a time predate history.
        const skipped = step.key === "proposals_received" && index < reachedIndex && !firstAt(step.key) && firstAt("assigned");
        const at = firstAt(step.key);
        return (
          <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
            {index < TIMELINE.length - 1 && (
              <span className={cn("absolute left-[11px] top-6 h-[calc(100%-1rem)] w-0.5", index < reachedIndex ? "bg-sky-500" : "bg-slate-200 dark:bg-slate-700")} aria-hidden="true" />
            )}
            <span
              className={cn(
                "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                done && "border-sky-500 bg-sky-500 text-white",
                current && "border-sky-500 bg-white text-sky-600 ring-4 ring-sky-100 dark:bg-slate-900 dark:ring-sky-950",
                !done && !current && "border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-900",
              )}
              aria-hidden="true"
            >
              {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn("text-sm", current ? "font-bold text-slate-900" : done ? "font-medium text-slate-800 dark:text-slate-200" : "text-slate-500")}>
                {step.label}
                <span className="sr-only">{done ? " (done)" : current ? " (current step)" : " (not yet)"}</span>
              </p>
              {at && <p className="text-xs text-slate-500">{formatDate(at)}</p>}
              {skipped && <p className="text-xs text-slate-500">Skipped</p>}
            </div>
          </li>
        );
      })}
      {job.status === "cancelled" && (
        <li className="relative flex gap-3 pt-2">
          <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white" aria-hidden="true">
            <Trash2 className="h-3 w-3" />
          </span>
          <div className="pt-0.5">
            <p className="text-sm font-bold text-red-700 dark:text-red-300">Cancelled</p>
            {cancelledAt && <p className="text-xs text-slate-500">{formatDate(cancelledAt)}</p>}
          </div>
        </li>
      )}
    </ol>
  );
}

function ActionButton({ action, className }) {
  const Icon = action.icon;
  const content = <>{Icon && <Icon className="h-4 w-4" aria-hidden="true" />}{action.label}</>;
  if (action.to) {
    return (
      <Link to={action.to} className={cn(action.variant === "secondary" ? "fixly-btn-secondary" : "fixly-btn-primary", "w-full gap-2 text-sm", className)}>
        {content}
      </Link>
    );
  }
  return (
    <Button variant={action.variant || "primary"} className={cn("w-full", className)} onClick={action.onClick} loading={action.loading}>
      {content}
    </Button>
  );
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
  const [payment, setPayment] = useState({ amount: "", method: "cash", note: "" });
  const [paymentError, setPaymentError] = useState("");
  const [agreedPrice, setAgreedPrice] = useState("");
  const [priceError, setPriceError] = useState("");
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
    qc.invalidateQueries({ queryKey: ["my-proposals"] });
  };
  const closeConfirm = () => setConfirming(null);

  const acceptProposal = useMutation({
    mutationFn: (pid) => api.put(`/proposals/${pid}/accept`),
    meta: { track: "worker_hired" },
    onSuccess: (_data, pid) => {
      const hired = proposals.find((p) => p.id === pid);
      closeConfirm();
      toast({ title: `${hired?.worker_name || "Worker"} is hired`, description: "You can now see each other’s phone numbers. Agree a start time with them.", variant: "success" });
      refetch();
    },
    onError: failureToast(toast, "Couldn’t hire this worker"),
  });

  const declineProposal = useMutation({
    mutationFn: (pid) => api.put(`/proposals/${pid}/decline`),
    meta: { track: "proposal_declined" },
    onSuccess: () => {
      closeConfirm();
      toast({ title: "Proposal declined", description: "We’ve let the worker know." });
      refetch();
    },
    onError: failureToast(toast, "Couldn’t decline this proposal"),
  });

  const withdrawProposal = useMutation({
    mutationFn: (pid) => api.put(`/proposals/${pid}/withdraw`),
    meta: { track: "proposal_withdrawn" },
    onSuccess: () => {
      closeConfirm();
      toast({ title: "Proposal withdrawn", description: "We’ve told the customer you’re no longer available." });
      refetch();
      qc.invalidateQueries({ queryKey: ["job-feed"] });
    },
    onError: failureToast(toast, "Couldn’t withdraw"),
  });

  const updateStatus = useMutation({
    mutationFn: (status) => api.put(`/jobs/${id}/status`, { status }),
    meta: { track: "job_status_changed", trackProps: (status) => ({ status, by: "worker" }) },
    onSuccess: (_data, status) => {
      closeConfirm();
      toast({
        title: status === "in_progress" ? "Job marked as started" : "Job marked as complete",
        description: status === "in_progress" ? "The customer has been notified." : "The customer has been notified and can now record the payment.",
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
    meta: { track: "payment_recorded", trackProps: () => ({ method: payment.method }) },
    onSuccess: () => {
      setPayModal(false);
      toast({ title: "Payment recorded", description: "We’ve asked the worker to confirm they received it.", variant: "success" });
      refreshPayments();
    },
    onError: failureToast(toast, "Payment not recorded"),
  });

  const confirmPayment = useMutation({
    mutationFn: () => api.put(`/payments/${job.payment_id}/confirm`),
    meta: { track: "payment_confirmed" },
    onSuccess: () => {
      toast({ title: "Payment confirmed", description: "Thanks — the customer has been notified.", variant: "success" });
      refreshPayments();
    },
    onError: failureToast(toast, "Couldn’t confirm the payment"),
  });

  const disputePayment = useMutation({
    mutationFn: (reason) => api.put(`/payments/${job.payment_id}/dispute`, { reason }),
    meta: { track: "payment_disputed" },
    onSuccess: () => {
      closeConfirm();
      toast({ title: "Payment disputed", description: "We’ve shared your reason with the customer. Try to resolve it with them directly." });
      refreshPayments();
    },
    onError: failureToast(toast, "Couldn’t dispute the payment"),
  });

  const setFinalPrice = useMutation({
    mutationFn: () => api.put(`/jobs/${id}/final-price`, { final_price: agreedPrice }),
    meta: { track: "agreed_price_set" },
    onSuccess: () => {
      setPriceModal(false);
      toast({ title: "Agreed price saved", description: "The worker has been notified.", variant: "success" });
      refetch();
    },
    onError: failureToast(toast, "Price not saved"),
  });

  const submitReview = useMutation({
    mutationFn: () => api.post(`/jobs/${id}/review`, review),
    meta: { track: "review_submitted", trackProps: () => ({ rating: review.rating }) },
    onSuccess: () => {
      setReviewModal(false);
      toast({ title: "Review published", description: "Thanks for helping other customers choose well.", variant: "success" });
      refetch();
    },
    onError: failureToast(toast, "Review not submitted"),
  });

  const cancelJob = useMutation({
    mutationFn: () => api.delete(`/jobs/${id}`),
    meta: { track: "job_cancelled", trackProps: () => ({ proposals: proposals.length }) },
    onSuccess: () => {
      closeConfirm();
      qc.invalidateQueries({ queryKey: ["my-jobs"] });
      toast({ title: "Job cancelled", description: "Workers can no longer send proposals for it." });
      navigate("/jobs");
    },
    onError: failureToast(toast, "Couldn’t cancel the job"),
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center"><Spinner /></div>
      </AppShell>
    );
  }
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

  const open = job.is_active !== false && ["posted", "proposals_received"].includes(job.status);
  const pendingProposals = proposals.filter((p) => p.status === "pending");
  const canCancel = isOwner && !["in_progress", "completed", "payment_recorded", "reviewed", "cancelled"].includes(job.status);
  const canSetFinalPrice = isOwner && ["assigned", "in_progress", "completed"].includes(job.status) && job.pricing_mode !== "fixed";
  const workerThread = job.assigned_worker_id ? threadPath(job.id, job.assigned_worker_id) : null;
  const paymentAwaitingWorker = job.status === "payment_recorded" && job.payment_id && !job.payment_worker_confirmed && !job.payment_disputed;

  const openPayment = () => {
    setPayment((p) => ({ ...p, amount: job.final_price ? String(Number(job.final_price)) : p.amount }));
    setPaymentError("");
    setPayModal(true);
  };
  const openAgreedPrice = () => {
    setAgreedPrice(job.final_price ? String(Number(job.final_price)) : "");
    setPriceError("");
    setPriceModal(true);
  };
  const scrollToProposals = () => document.getElementById("proposals")?.scrollIntoView({ behavior: "smooth", block: "start" });

  // One clear next step for whoever is looking at the job.
  let next = null;
  if (job.status === "cancelled") {
    next = { title: "This job was cancelled", text: "It’s no longer visible to workers." };
  } else if (job.is_active === false) {
    next = { title: "This job was taken down", text: isOwner ? "Workers can’t see it. See the reason below." : "It’s no longer available." };
  } else if (isOwner) {
    switch (job.status) {
      case "posted":
        next = {
          title: "Waiting for proposals",
          text: "Workers nearby can see your job. Invite someone directly, or let our assistant suggest good matches.",
          primary: { label: "Find matching workers", icon: Bot, onClick: () => setAgentOpen(true) },
          secondary: [{ label: "Browse and invite workers", icon: Users, to: "/find-workers", variant: "secondary" }],
        };
        break;
      case "proposals_received":
        next = {
          title: pendingProposals.length > 0 ? `Review ${pluralize(pendingProposals.length, "proposal")}` : "Waiting for proposals",
          text: pendingProposals.length > 0 ? "Compare prices, availability and reviews, message workers with questions, then hire one." : "Workers who applied have withdrawn. You can invite others.",
          primary: pendingProposals.length > 0 ? { label: "Review proposals", icon: Users, onClick: scrollToProposals } : { label: "Browse and invite workers", icon: Users, to: "/find-workers" },
          secondary: [{ label: "Find more matches", icon: Bot, onClick: () => setAgentOpen(true), variant: "secondary" }],
        };
        break;
      case "assigned":
        next = {
          title: `Agree a start time with ${job.assigned_worker_name}`,
          text: "They’ll mark the job as started when they begin.",
          primary: { label: "Message worker", icon: MessagesSquare, to: workerThread },
          secondary: canSetFinalPrice ? [{ label: job.final_price ? "Update agreed price" : "Set agreed price", icon: Banknote, onClick: openAgreedPrice, variant: "secondary" }] : [],
        };
        break;
      case "in_progress":
        next = {
          title: "Work in progress",
          text: `${job.assigned_worker_name} has started. They’ll mark it complete when they’re done.`,
          primary: { label: "Message worker", icon: MessagesSquare, to: workerThread },
          secondary: canSetFinalPrice ? [{ label: job.final_price ? "Update agreed price" : "Set agreed price", icon: Banknote, onClick: openAgreedPrice, variant: "secondary" }] : [],
        };
        break;
      case "completed":
        next = {
          title: "Record the payment",
          text: "Once you’ve paid the worker, record it here so you both have a record.",
          primary: { label: "Record payment", icon: Banknote, onClick: openPayment },
          secondary: [{ label: "Leave a review", icon: Star, onClick: () => setReviewModal(true), variant: "secondary" }],
        };
        break;
      case "payment_recorded":
        next = {
          title: job.payment_disputed ? "The worker disputed the payment" : "Leave a review",
          text: job.payment_disputed
            ? "Talk to the worker to sort it out. Fixly may contact you both."
            : `${job.payment_worker_confirmed ? "The worker confirmed your payment. " : "We’ve asked the worker to confirm your payment. "}Tell other customers how it went.`,
          primary: job.payment_disputed ? { label: "Message worker", icon: MessagesSquare, to: workerThread } : { label: "Leave a review", icon: Star, onClick: () => setReviewModal(true) },
        };
        break;
      case "reviewed":
        next = { title: "Job finished", text: "Thanks for reviewing. You can hire this worker again any time.", primary: { label: "Post another job", icon: Send, to: "/jobs/new", variant: "secondary" } };
        break;
      default:
        break;
    }
  } else if (isAssignedWorker) {
    switch (job.status) {
      case "assigned":
        next = {
          title: "You’re hired",
          text: "Agree a start time with the customer, then mark the job as started when you begin.",
          primary: { label: "Mark as started", icon: Play, onClick: () => updateStatus.mutate("in_progress"), loading: updateStatus.isPending },
          secondary: [{ label: "Message customer", icon: MessagesSquare, to: threadPath(job.id, user.id), variant: "secondary" }],
        };
        break;
      case "in_progress":
        next = {
          title: "Work in progress",
          text: "When the work is finished, mark it complete so the customer can pay and review.",
          primary: { label: "Mark as complete", icon: CheckCircle2, onClick: () => setConfirming({ kind: "complete" }), variant: "success" },
          secondary: [{ label: "Message customer", icon: MessagesSquare, to: threadPath(job.id, user.id), variant: "secondary" }],
        };
        break;
      case "completed":
        next = { title: "Waiting for payment", text: "The customer has been asked to record the payment.", primary: { label: "Message customer", icon: MessagesSquare, to: threadPath(job.id, user.id), variant: "secondary" } };
        break;
      case "payment_recorded":
        next = paymentAwaitingWorker
          ? {
              title: `Confirm ${formatCurrency(job.payment_amount)}`,
              text: `The customer recorded ${formatCurrency(job.payment_amount)} by ${PAYMENT_METHODS[job.payment_method] || "payment"}. Confirm once you’ve received it.`,
              primary: { label: "Confirm payment received", icon: CheckCircle2, onClick: () => confirmPayment.mutate(), loading: confirmPayment.isPending, variant: "success" },
              secondary: [{ label: "Dispute payment", icon: AlertTriangle, onClick: () => setConfirming({ kind: "dispute" }), variant: "outline" }],
            }
          : { title: job.payment_disputed ? "You disputed this payment" : "Payment confirmed", text: job.payment_disputed ? "Talk to the customer to resolve it. Fixly may contact you both." : "The customer can now leave a review." };
        break;
      case "reviewed":
        next = { title: "Job finished", text: "The customer left a review on your profile.", primary: { label: "View your profile", to: `/workers/${user.id}`, variant: "secondary" } };
        break;
      default:
        break;
    }
  } else if (isWorker) {
    if (!myProposal) {
      next = open
        ? { title: "Interested in this job?", text: "Send your price and availability to the customer.", primary: { label: "Send proposal", icon: Send, to: `/jobs/${job.id}/propose` } }
        : { title: "This job isn’t taking proposals", text: "The customer may have hired someone already." };
    } else if (myProposal.status === "pending") {
      const needsQuote = !myProposal.proposed_price && !myProposal.inspection_needed;
      next = {
        title: needsQuote ? "Add your price" : "Waiting for the customer",
        text: needsQuote ? "You accepted the invite. Send your quote so the customer can hire you." : "The customer is reviewing proposals. You’ll be notified when they decide.",
        primary: needsQuote
          ? { label: "Send your quote", icon: Pencil, to: `/jobs/${job.id}/propose` }
          : { label: "Message customer", icon: MessagesSquare, to: threadPath(job.id, user.id) },
        secondary: [
          ...(needsQuote ? [] : [{ label: "Edit proposal", icon: Pencil, to: `/jobs/${job.id}/propose`, variant: "secondary" }]),
          { label: "Withdraw proposal", onClick: () => setConfirming({ kind: "withdraw", proposal: myProposal }), variant: "ghost" },
        ],
      };
    } else {
      next = {
        title: myProposal.status === "declined" ? "The customer chose someone else" : "You withdrew your proposal",
        text: "Keep an eye on new jobs nearby.",
        primary: { label: "Browse open jobs", to: "/jobs/feed", variant: "secondary" },
      };
    }
  }

  const header = (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge status={job.status} />
            {job.urgency && <span className="text-sm text-slate-500">{URGENCY_LABELS[job.urgency]}</span>}
            {job.category_name && <span className="fixly-pill-sky">{job.category_name}</span>}
          </div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{job.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
            {job.district && (
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden="true" />{[job.town, job.district].filter(Boolean).join(", ")}</span>
            )}
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden="true" />Posted {formatDate(job.created_at)}</span>
          </div>
        </div>
        <div className="sm:text-right">
          {job.final_price ? (
            <>
              <p className="text-xs text-slate-500">Agreed price</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(job.final_price)}</p>
            </>
          ) : job.pricing_mode === "fixed" && job.fixed_budget ? (
            <>
              <p className="text-xs text-slate-500">Budget</p>
              <p className="text-xl font-bold text-sky-700 dark:text-sky-300">{formatCurrency(job.fixed_budget)}</p>
            </>
          ) : (
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{job.pricing_mode === "inspection" ? "Price after inspection" : "Open to quotes"}</p>
          )}
        </div>
      </div>

      {job.description && (
        <p className="mt-4 whitespace-pre-line rounded-card bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 dark:bg-slate-900/70 dark:text-slate-200">{job.description}</p>
      )}
      {job.address && (isOwner || isAssignedWorker) && (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-slate-600 dark:text-slate-300"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{job.address}</p>
      )}
      {job.photos?.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {job.photos.map((p, index) => (
            <a key={p.id} href={p.path} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl focus-visible:ring-2 focus-visible:ring-sky-500">
              <img src={p.path} alt={`Job photo ${index + 1} of ${job.photos.length}`} className="h-24 w-24 rounded-xl object-cover" />
            </a>
          ))}
        </div>
      )}
    </Card>
  );

  const nextCard = next && (
    <Card className="p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Next step</p>
      <h2 className="mt-1 text-lg font-bold text-slate-900">{next.title}</h2>
      {next.text && <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{next.text}</p>}
      {(next.primary || next.secondary?.length > 0) && (
        <div className="mt-4 space-y-2">
          {next.primary && <ActionButton action={next.primary} />}
          {next.secondary?.map((action) => <ActionButton key={action.label} action={action} />)}
        </div>
      )}
      {canCancel && (
        <button type="button" onClick={() => setConfirming({ kind: "cancel" })} className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40">
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Cancel job
        </button>
      )}
    </Card>
  );

  const alerts = (
    <>
      {job.is_active === false && isOwner && (
        <div className="flex items-start gap-3 rounded-card border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30" role="status">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-300" aria-hidden="true" />
          <div className="text-sm text-red-800 dark:text-red-200">
            <p className="font-semibold">Fixly took this job down</p>
            {job.flag_reason && <p className="mt-1">Reason: {job.flag_reason}</p>}
            <p className="mt-1">Workers can’t see it or send proposals. If you think this is a mistake, <Link to="/contact" className="font-semibold underline underline-offset-2">contact us</Link>.</p>
          </div>
        </div>
      )}
      {job.payment_disputed && (isOwner || isAssignedWorker) && (
        <div className="flex items-start gap-3 rounded-card border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30" role="status">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-200">{isOwner ? "The worker disputed this payment" : "You disputed this payment"}</p>
            {job.payment_dispute_reason && <p className="mt-1 text-amber-800 dark:text-amber-300">Reason: {job.payment_dispute_reason}</p>}
            <p className="mt-1 text-amber-800 dark:text-amber-300">
              Please talk to each other to sort it out. See our <Link to="/safety" className="font-semibold underline underline-offset-2">safety tips on payments</Link>.
            </p>
          </div>
        </div>
      )}
    </>
  );

  const people = (
    <>
      {job.customer_id && !isOwner && (
        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-500">Posted by</h2>
          <div className="flex items-center gap-3">
            <Avatar name={job.customer_name} src={job.customer_photo} size="lg" />
            <div className="min-w-0">
              <Link to={`/customers/${job.customer_id}`} className="font-semibold text-slate-900 hover:text-sky-700 dark:hover:text-sky-300">{job.customer_name}</Link>
              {isAssignedWorker && job.customer_phone && (
                <a href={`tel:${job.customer_phone.replace(/\s+/g, "")}`} className="mt-0.5 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-sky-700 dark:text-sky-300">
                  <Phone className="h-4 w-4" aria-hidden="true" /> {job.customer_phone}
                </a>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            <ReportButton jobId={job.id} reportedUserId={job.customer_id} subject={job.customer_name} />
          </div>
        </Card>
      )}
      {job.assigned_worker_id && (
        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-500">{isAssignedWorker ? "You’re hired" : "Hired worker"}</h2>
          <div className="flex items-center gap-3">
            <Avatar name={job.assigned_worker_name} src={job.assigned_worker_photo} size="lg" />
            <div className="min-w-0">
              <Link to={`/workers/${job.assigned_worker_id}`} className="font-semibold text-slate-900 hover:text-sky-700 dark:hover:text-sky-300">{job.assigned_worker_name}</Link>
              {job.assigned_worker_phone && isOwner && (
                <a href={`tel:${job.assigned_worker_phone.replace(/\s+/g, "")}`} className="mt-0.5 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-sky-700 dark:text-sky-300">
                  <Phone className="h-4 w-4" aria-hidden="true" /> {job.assigned_worker_phone}
                </a>
              )}
            </div>
          </div>
          {isOwner && (
            <div className="mt-3 flex flex-wrap gap-1">
              <Link to={workerThread} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/40">
                <MessagesSquare className="h-4 w-4" aria-hidden="true" /> Message
              </Link>
              <ReportButton jobId={job.id} reportedUserId={job.assigned_worker_id} subject={job.assigned_worker_name} />
            </div>
          )}
        </Card>
      )}
    </>
  );

  return (
    <AppShell>
      <div className="fixly-page max-w-6xl space-y-5">
        <button type="button" onClick={() => navigate(-1)} className="flex min-h-11 items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back
        </button>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* On phones the next step comes first; on desktop it sits in the side column. */}
          <div className="space-y-5 lg:hidden">{nextCard}</div>

          <div className="min-w-0 space-y-5">
            {header}
            {alerts}

            {myProposal && (
              <Card className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold text-slate-900">Your proposal</h2>
                  <Badge status={myProposal.status} />
                </div>
                <p className="mt-2 text-lg font-bold text-sky-700 dark:text-sky-300">
                  {myProposal.proposed_price ? formatCurrency(myProposal.proposed_price) : myProposal.inspection_needed ? "Price after inspection" : "No price sent yet"}
                </p>
                {myProposal.availability && <p className="text-sm text-slate-600 dark:text-slate-300">Availability: {myProposal.availability}</p>}
                {myProposal.message && myProposal.message !== "Accepted via invite" && (
                  <p className="mt-2 whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">{myProposal.message}</p>
                )}
              </Card>
            )}

            {isOwner && (
              <section id="proposals" className="scroll-mt-24">
                <h2 className="mb-4 font-bold text-slate-900">
                  Proposals {proposals.length > 0 && <span className="font-normal text-slate-500">({proposals.length})</span>}
                </h2>
                {proposals.length === 0 ? (
                  <Card className="p-6 text-center text-sm text-slate-600 dark:text-slate-300">
                    {open ? "No proposals yet. Most jobs get their first proposal within a day — or invite workers yourself." : "No proposals were sent for this job."}
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
                        messageTo={job.status !== "cancelled" ? threadPath(job.id, p.worker_id) : null}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className="space-y-5">
            <div className="hidden lg:block">{nextCard}</div>
            <Card className="p-4 sm:p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-500">Progress</h2>
              <JobTimeline job={job} />
            </Card>
            {people}
          </aside>
        </div>
      </div>

      {/* Payment */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Record payment">
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!PRICE_PATTERN.test(String(payment.amount)) || Number(payment.amount) <= 0) {
              setPaymentError("Enter the amount you paid in rupees, for example 5000.");
              return;
            }
            recordPayment.mutate();
          }}
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">Fixly doesn’t take payments. Record what you paid {job.assigned_worker_name} so you both have a record — they’ll be asked to confirm it.</p>
          <Input
            label="Amount paid (LKR)"
            inputMode="decimal"
            value={payment.amount}
            onChange={(e) => { setPayment((p) => ({ ...p, amount: e.target.value })); setPaymentError(""); }}
            placeholder="5000"
            error={paymentError}
          />
          <Select label="How did you pay?" value={payment.method} onChange={(e) => setPayment((p) => ({ ...p, method: e.target.value }))}>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="other">Other</option>
          </Select>
          <Textarea label="Note (optional)" value={payment.note} onChange={(e) => setPayment((p) => ({ ...p, note: e.target.value }))} placeholder="e.g. Transfer reference, or what the amount covers" rows={2} />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setPayModal(false)}>Cancel</Button>
            <Button type="submit" loading={recordPayment.isPending}>Record payment</Button>
          </div>
        </form>
      </Modal>

      <Modal open={priceModal} onClose={() => setPriceModal(false)} title={job.final_price ? "Update agreed price" : "Set agreed price"}>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!PRICE_PATTERN.test(String(agreedPrice)) || Number(agreedPrice) <= 0) {
              setPriceError("Enter the price you agreed in rupees, for example 5000.");
              return;
            }
            setFinalPrice.mutate();
          }}
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">Record the price you and {job.assigned_worker_name} agreed, so it’s clear when it’s time to pay.</p>
          <Input label="Agreed price (LKR)" inputMode="decimal" value={agreedPrice} onChange={(e) => { setAgreedPrice(e.target.value); setPriceError(""); }} placeholder="5000" error={priceError} />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setPriceModal(false)}>Cancel</Button>
            <Button type="submit" loading={setFinalPrice.isPending}>Save price</Button>
          </div>
        </form>
      </Modal>

      <Modal open={reviewModal} onClose={() => setReviewModal(false)} title={`Review ${job.assigned_worker_name || "the worker"}`}>
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Overall rating</legend>
            <div className="flex gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={review.rating === n}
                  onClick={() => setReview((r) => ({ ...r, rating: n }))}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl text-3xl transition-transform hover:scale-110 ${n <= review.rating ? "text-amber-400" : "text-slate-300 dark:text-slate-600"}`}
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                >
                  ★
                </button>
              ))}
            </div>
          </fieldset>
          <Textarea label="Your review" value={review.feedback} onChange={(e) => setReview((r) => ({ ...r, feedback: e.target.value }))} placeholder="How was the quality, timekeeping and communication?" rows={4} />
          <p className="text-xs text-slate-500">Reviews are public and help other customers choose.</p>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setReviewModal(false)}>Cancel</Button>
            <Button onClick={() => submitReview.mutate()} loading={submitReview.isPending}>Publish review</Button>
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
              open={confirming?.kind === "withdraw"}
              onClose={closeConfirm}
              onConfirm={() => withdrawProposal.mutate(proposal.id)}
              loading={withdrawProposal.isPending}
              title="Withdraw your proposal?"
              description="The customer will be told you’re no longer available. You can’t apply to this job again."
              confirmLabel="Withdraw proposal"
              cancelLabel="Keep proposal"
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
              description={`The customer recorded ${formatCurrency(job.payment_amount)} by ${PAYMENT_METHODS[job.payment_method] || "payment"}. Tell them what’s wrong so you can sort it out.`}
              confirmLabel="Dispute payment"
              tone="danger"
              reason={{ label: "What’s the problem?", placeholder: "For example: I received LKR 3,000, not LKR 4,000.", required: true, options: DISPUTE_REASONS }}
            />
          </>
        );
      })()}

      {agentOpen && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Find matching workers">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAgentOpen(false)} />
          <div className="relative mt-auto flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-overlay bg-white shadow-2xl animate-slide-in-right dark:bg-slate-900 sm:ml-auto sm:mt-0 sm:h-full sm:max-w-lg sm:rounded-none">
            <AgentPanel mode="match" jobId={id} onClose={() => { setAgentOpen(false); refetch(); }} />
          </div>
        </div>
      )}
    </AppShell>
  );
}
