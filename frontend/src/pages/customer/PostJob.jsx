import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Flame, Lightbulb, MessageSquare, Pencil, Search, Send, Upload, Wallet, X } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Button, Input, Textarea, Select, Card, Spinner } from "../../components/shared/UI";
import { EmailVerificationNotice } from "../../components/shared/EmailVerificationNotice";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { usePageTitle } from "../../hooks/usePageTitle";
import { DISTRICTS, cn, formatCurrency } from "../../lib/utils";
import { errorMessage } from "../../lib/errors";
import { isEmailVerified } from "../../lib/auth";
import { IMAGE_ACCEPT, prepareImage } from "../../lib/images";
import { uploadJobImages } from "../../lib/storage";
import api from "../../lib/api";

const URGENCIES = [
  { value: "today", label: "Today", desc: "Urgent — needs doing as soon as possible", icon: Flame },
  { value: "tomorrow", label: "Tomorrow", desc: "Can wait until tomorrow", icon: CalendarClock },
  { value: "this_week", label: "This week", desc: "Any day in the next few days", icon: CalendarDays },
  { value: "flexible", label: "Flexible", desc: "No rush — whenever suits", icon: Clock },
];

const PRICING_MODES = [
  { value: "ask_quotes", label: "Ask for quotes", desc: "Workers tell you their price. Best if you’re not sure what it costs.", icon: MessageSquare },
  { value: "fixed", label: "Fixed budget", desc: "You set the amount you’ll pay.", icon: Wallet },
  { value: "inspection", label: "After inspection", desc: "The worker visits first, then gives a price.", icon: Search },
];

// What a good description covers for each kind of job.
const CATEGORY_HINTS = {
  Plumbing: ["Where is the problem (kitchen, bathroom, tank)?", "Is it leaking now, blocked, or a new installation?", "Do you have the parts, or should the worker bring them?"],
  Electrical: ["What isn’t working, and since when?", "Does a breaker trip? Any burning smell or sparks?", "How many points, lights or fans are involved?"],
  Carpentry: ["What needs making or repairing?", "Rough sizes (width × height) and the wood or finish you want", "Will you supply materials?"],
  Cleaning: ["Size of the place (bedrooms, bathrooms, sq ft)", "Regular clean, deep clean, or after renovation?", "Any carpets, sofas or windows to include?"],
  Painting: ["Interior or exterior? Roughly how many rooms or square feet?", "Will you supply the paint?", "Any cracks, damp or peeling that need fixing first?"],
  Tiling: ["Area in square feet and where (floor, wall, bathroom)", "Are old tiles being removed?", "Will you supply the tiles?"],
  Welding: ["What needs fabricating or repairing (gate, grille, railing)?", "Rough sizes and the material (iron, steel)", "Is it on-site work or can it be taken to a workshop?"],
  "AC Repair": ["AC brand, type (inverter or not) and capacity (BTU)", "What’s wrong — not cooling, leaking, noisy — or is it a service?", "How many units, and how high are they mounted?"],
  Landscaping: ["Size of the garden or area", "What you want done (cutting, clearing, planting, design)", "Is there green waste to take away?"],
  "General Labour": ["What needs doing and roughly how long it should take", "How many people you need", "Any tools or heavy lifting involved?"],
};

const STEPS = ["Job details", "Location & photos", "Budget & review"];
const EMPTY_FORM = {
  title: "",
  description: "",
  category_id: "",
  urgency: "flexible",
  district: "",
  town: "",
  address: "",
  pricing_mode: "ask_quotes",
  fixed_budget: "",
};
const MAX_PHOTOS = 6;
const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;

function draftKey(userId) {
  return `fixly_job_draft_${userId}`;
}

function readDraft(userId) {
  try {
    const raw = localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const draft = JSON.parse(raw);
    return draft && typeof draft === "object" && draft.form ? draft : null;
  } catch {
    return null;
  }
}

function hasContent(form) {
  return Boolean(form.title || form.description || form.category_id || form.district || form.town || form.address || form.fixed_budget);
}

export default function PostJob() {
  const { user } = useAuth();
  usePageTitle("Post a job");
  if (!isEmailVerified(user)) {
    return (
      <AppShell>
        <div className="fixly-page max-w-3xl py-10">
          <EmailVerificationNotice variant="gate" blockedAction="post a job" />
        </div>
      </AppShell>
    );
  }
  return <PostJobForm user={user} />;
}

function validateStep(step, form) {
  const errors = {};
  if (step === 0) {
    if (form.title.trim().length < 5) errors.title = "Give your job a short title (at least 5 characters), e.g. “Fix leaking kitchen tap”.";
    if (!form.category_id) errors.category_id = "Choose the kind of work.";
    if (form.description.trim().length < 20) errors.description = "Describe the job in a sentence or two (at least 20 characters) so workers can quote accurately.";
  }
  if (step === 1) {
    if (!form.district) errors.district = "Choose the district where the work is.";
  }
  if (step === 2) {
    if (form.pricing_mode === "fixed" && (!PRICE_PATTERN.test(form.fixed_budget) || Number(form.fixed_budget) <= 0)) {
      errors.fixed_budget = "Enter your budget in rupees, for example 5000 — or choose “Ask for quotes”.";
    }
  }
  return errors;
}

const FIELD_ORDER = ["title", "category_id", "description", "district", "fixed_budget"];

function PostJobForm({ user }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const inviteWorkerId = params.get("invite");
  const [initialDraft] = useState(() => readDraft(user.id));
  const [step, setStep] = useState(() => Math.min(Math.max(Number(initialDraft?.step) || 0, 0), STEPS.length - 1));
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, ...(initialDraft?.form || {}) }));
  const [draftRestored, setDraftRestored] = useState(() => Boolean(initialDraft && hasContent(initialDraft.form)));
  const [errors, setErrors] = useState({});
  const [photos, setPhotos] = useState([]);
  const [preparingPhotos, setPreparingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photosRef = useRef(photos);
  const headingRef = useRef(null);

  const set = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  // Keep an autosaved draft (text only — photos can't be stored) so leaving
  // the page or losing signal doesn't lose the job.
  useEffect(() => {
    try {
      if (hasContent(form)) localStorage.setItem(draftKey(user.id), JSON.stringify({ form, step, savedAt: Date.now() }));
    } catch {
      // storage unavailable (private mode); the form still works
    }
  }, [form, step, user.id]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview)), []);

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get("/jobs/categories").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const topCategories = categories.filter((c) => !c.parent_id);
  const category = categories.find((c) => c.id === form.category_id);
  const hints = category ? CATEGORY_HINTS[category.name] : null;

  const { data: inviteWorker } = useQuery({
    queryKey: ["worker", inviteWorkerId],
    queryFn: () => api.get(`/workers/${inviteWorkerId}`).then((r) => r.data),
    enabled: Boolean(inviteWorkerId),
  });

  const clearDraft = () => {
    try { localStorage.removeItem(draftKey(user.id)); } catch { /* ignore */ }
  };

  const startOver = () => {
    clearDraft();
    setForm(EMPTY_FORM);
    setStep(0);
    setErrors({});
    setDraftRestored(false);
  };

  const createJob = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        fixed_budget: form.pricing_mode === "fixed" ? form.fixed_budget : undefined,
      };
      const { data } = await api.post("/jobs", payload);
      const result = { ...data };
      if (photos.length > 0) {
        try {
          await uploadJobImages(photos.map((photo) => photo.file), data.id);
        } catch (error) {
          result.photoUploadFailed = true;
          result.photoUploadError = error.message;
        }
      }
      if (inviteWorkerId) {
        try {
          await api.post(`/jobs/${data.id}/invites`, { worker_id: inviteWorkerId });
          result.invited = true;
        } catch (error) {
          result.inviteError = errorMessage(error);
        }
      }
      return result;
    },
    meta: { track: "job_posted", trackProps: (_vars, data) => ({ category: category?.name, pricing_mode: form.pricing_mode, urgency: form.urgency, photos: photos.length, invited: Boolean(data?.invited) }) },
    onSuccess: (data) => {
      clearDraft();
      qc.invalidateQueries({ queryKey: ["my-jobs"] });
      const inviteNote = data.invited
        ? ` We’ve invited ${inviteWorker?.full_name || "the worker"}.`
        : data.inviteError ? ` We couldn’t send the invite: ${data.inviteError}` : "";
      toast({
        title: data.photoUploadFailed ? "Job posted without photos" : "Job posted",
        description: data.photoUploadFailed
          ? `Your job is live, but its photos couldn’t be uploaded. You don’t need to post it again.${inviteNote}`
          : `Workers nearby can now send you proposals.${inviteNote}`,
        variant: data.photoUploadFailed || data.inviteError ? "warning" : "success",
      });
      navigate(`/jobs/${data.id}`);
    },
    onError: (err) => toast({ title: "Job not posted", description: errorMessage(err), variant: "error" }),
  });

  const handlePhotos = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    setPhotoError("");
    if (files.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    const messages = [];
    if (files.length > room) messages.push(`You can add up to ${MAX_PHOTOS} photos; only the first ${room} were added.`);
    setPreparingPhotos(true);
    const prepared = [];
    for (const file of files.slice(0, room)) {
      try {
        const ready = await prepareImage(file);
        prepared.push({ file: ready, preview: URL.createObjectURL(ready) });
      } catch (error) {
        messages.push(error.message);
      }
    }
    setPreparingPhotos(false);
    setPhotos((current) => [...current, ...prepared]);
    if (messages.length) setPhotoError(messages.join(" "));
  };

  const removePhoto = (index) => {
    setPhotos((current) => {
      URL.revokeObjectURL(current[index].preview);
      return current.filter((_, i) => i !== index);
    });
  };

  const goTo = (nextStep) => {
    setStep(nextStep);
    setErrors({});
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const next = () => {
    const found = validateStep(step, form);
    setErrors(found);
    const first = FIELD_ORDER.find((key) => found[key]);
    if (first) {
      document.getElementById(`job-${first}`)?.focus();
      return;
    }
    if (step < STEPS.length - 1) goTo(step + 1);
    else createJob.mutate();
  };

  const urgency = URGENCIES.find((u) => u.value === form.urgency);
  const pricing = PRICING_MODES.find((p) => p.value === form.pricing_mode);

  return (
    <AppShell>
      <div className="fixly-page max-w-3xl pb-28 sm:pb-6">
        <div className="mb-5 sm:mb-6">
          <button type="button" onClick={() => navigate(-1)} className="mb-3 flex min-h-11 items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back
          </button>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Post a job</h1>
          <p ref={headingRef} tabIndex={-1} className="text-sm text-slate-600 outline-none dark:text-slate-300" aria-live="polite">
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
            {hasContent(form) && <span className="text-slate-500"> · Draft saved</span>}
          </p>
        </div>

        <div className="mb-5 flex items-center gap-2" aria-hidden="true">
          {STEPS.map((label, index) => (
            <div key={label} className={cn("h-1.5 flex-1 rounded-full transition-all duration-300", index <= step ? "bg-sky-600" : "bg-slate-200 dark:bg-slate-700")} />
          ))}
        </div>

        {draftRestored && (
          <div className="mb-4 flex flex-col gap-2 rounded-card border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100 sm:flex-row sm:items-center sm:justify-between" role="status">
            <span>We restored the job you started earlier. Photos need adding again.</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={startOver}>Start over</Button>
              <Button size="sm" variant="secondary" onClick={() => setDraftRestored(false)}>Continue</Button>
            </div>
          </div>
        )}

        {inviteWorker && (
          <div className="mb-4 rounded-card border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-100" role="status">
            <Send className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
            When you post this job, we’ll invite <strong>{inviteWorker.full_name}</strong> to it.
          </div>
        )}

        <Card className="mb-6 p-4 sm:p-6">
          {step === 0 && (
            <div className="space-y-5">
              <Input
                id="job-title"
                label="Job title"
                placeholder="e.g. Fix leaking kitchen tap"
                maxLength={120}
                value={form.title}
                onChange={set("title")}
                error={errors.title}
              />
              <Select id="job-category_id" label="Type of work" value={form.category_id} onChange={set("category_id")} error={errors.category_id} disabled={categoriesLoading}>
                <option value="">{categoriesLoading ? "Loading…" : "Choose a category"}</option>
                {topCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <fieldset>
                <legend className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">When do you need it?</legend>
                <div className="grid grid-cols-2 gap-2">
                  {URGENCIES.map(({ value, label, desc, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, urgency: value }))}
                      aria-pressed={form.urgency === value}
                      className={cn("min-h-20 rounded-xl border p-3 text-left transition-all", form.urgency === value ? "border-sky-500 bg-sky-50 dark:bg-sky-950/40" : "border-slate-200 hover:border-sky-200 dark:border-slate-700")}
                    >
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Icon className="h-4 w-4 text-sky-600 dark:text-sky-300" aria-hidden="true" />{label}</p>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{desc}</p>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-2">
                <Textarea
                  id="job-description"
                  label="Describe the job"
                  placeholder="What needs doing, where, and what result you expect."
                  value={form.description}
                  onChange={set("description")}
                  rows={6}
                  maxLength={4000}
                  error={errors.description}
                />
                <p className="text-right text-xs text-slate-500">{form.description.length}/4000</p>
                <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  <p className="flex items-center gap-1.5 font-semibold"><Lightbulb className="h-4 w-4" aria-hidden="true" />{hints ? `Helpful details for ${category.name.toLowerCase()} jobs` : "What makes a good description"}</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-800 dark:text-amber-200">
                    {(hints || ["What the problem is and where", "Sizes, quantities or brands if you know them", "Whether you’ll supply materials"]).map((hint) => <li key={hint}>{hint}</li>)}
                  </ul>
                  <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-300">Don’t include your phone number — you can share it once you hire someone.</p>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <Select id="job-district" label="District" value={form.district} onChange={set("district")} error={errors.district}>
                <option value="">Choose a district</option>
                {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>
              <Input label="Town or area" placeholder="e.g. Nugegoda" maxLength={100} value={form.town} onChange={set("town")} />
              <div>
                <Input label="Address or landmark (optional)" placeholder="e.g. Near Nugegoda Market, Temple Road" value={form.address} onChange={set("address")} />
                <p className="mt-1.5 text-xs text-slate-500">Only the worker you hire can see this.</p>
              </div>
              <div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Photos (optional)</p>
                    <p className="mt-1 text-xs text-slate-500">Photos help workers quote accurately. JPEG, PNG, WebP or iPhone photos.</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-slate-500">{photos.length}/{MAX_PHOTOS}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {photos.map((photo, index) => (
                    <div key={photo.preview} className="relative aspect-square overflow-hidden rounded-xl">
                      <img src={photo.preview} className="h-full w-full object-cover" alt={`Photo ${index + 1} of ${photos.length}`} />
                      <button type="button" onClick={() => removePhoto(index)} className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white" aria-label={`Remove photo ${index + 1}`}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 transition-all hover:border-sky-400 focus-within:ring-2 focus-within:ring-sky-500 dark:border-slate-700">
                      {preparingPhotos ? <Spinner /> : <Upload className="mb-1 h-5 w-5 text-slate-500" aria-hidden="true" />}
                      <span className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{preparingPhotos ? "Preparing…" : "Add photos"}</span>
                      <input type="file" accept={IMAGE_ACCEPT} multiple onChange={handlePhotos} className="sr-only" disabled={preparingPhotos} />
                    </label>
                  )}
                </div>
                {photoError && <p role="alert" className="mt-2 text-sm text-red-600">{photoError}</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">How should workers price it?</legend>
                <div className="space-y-2">
                  {PRICING_MODES.map(({ value, label, desc, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { setForm((f) => ({ ...f, pricing_mode: value })); setErrors((e) => ({ ...e, fixed_budget: "" })); }}
                      aria-pressed={form.pricing_mode === value}
                      className={cn("flex min-h-16 w-full items-start gap-3 rounded-xl border p-4 text-left transition-all", form.pricing_mode === value ? "border-sky-500 bg-sky-50 dark:bg-sky-950/40" : "border-slate-200 hover:border-sky-200 dark:border-slate-700")}
                    >
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden="true" />
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">{label}</span>
                        <span className="block text-xs text-slate-600 dark:text-slate-400">{desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
              {form.pricing_mode === "fixed" && (
                <Input id="job-fixed_budget" label="Your budget (LKR)" inputMode="decimal" placeholder="5000" value={form.fixed_budget} onChange={set("fixed_budget")} error={errors.fixed_budget} />
              )}

              <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
                <h2 className="mb-3 text-base font-bold text-slate-900">Check your job</h2>
                <dl className="divide-y divide-slate-100 rounded-card bg-slate-50 px-4 text-sm dark:divide-slate-800 dark:bg-slate-900/70">
                  <ReviewRow label="Title" value={form.title} onEdit={() => goTo(0)} />
                  <ReviewRow label="Type of work" value={category?.name} onEdit={() => goTo(0)} />
                  <ReviewRow label="When" value={urgency?.label} onEdit={() => goTo(0)} />
                  <ReviewRow label="Description" value={form.description.length > 120 ? `${form.description.slice(0, 117)}…` : form.description} onEdit={() => goTo(0)} />
                  <ReviewRow label="Location" value={[form.town, form.district].filter(Boolean).join(", ")} onEdit={() => goTo(1)} />
                  <ReviewRow label="Photos" value={photos.length ? `${photos.length} photo${photos.length === 1 ? "" : "s"}` : "None"} onEdit={() => goTo(1)} />
                  <ReviewRow label="Pricing" value={form.pricing_mode === "fixed" && form.fixed_budget && PRICE_PATTERN.test(form.fixed_budget) ? `${pricing?.label}: ${formatCurrency(form.fixed_budget)}` : pricing?.label} />
                </dl>
                <p className="mt-3 text-xs text-slate-500">
                  Your job will be visible to workers on Fixly. By posting you agree to our <Link to="/terms" className="font-semibold underline underline-offset-2">Terms</Link>.
                </p>
              </div>
            </div>
          )}
        </Card>

        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 flex gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          {step > 0 && (
            <Button variant="secondary" onClick={() => goTo(step - 1)} className="flex-1">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back
            </Button>
          )}
          <Button variant="primary" onClick={next} loading={createJob.isPending} disabled={preparingPhotos} className="flex-1">
            {step < STEPS.length - 1
              ? <>Next <ChevronRight className="h-4 w-4" aria-hidden="true" /></>
              : <><Check className="h-4 w-4" aria-hidden="true" /> Post job</>}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function ReviewRow({ label, value, onEdit }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-3 py-2.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="break-words font-medium text-slate-800 dark:text-slate-200">{value || "—"}</dd>
      {onEdit ? (
        <button type="button" onClick={onEdit} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-white hover:text-sky-700 dark:hover:bg-slate-800 dark:hover:text-sky-300" aria-label={`Edit ${label.toLowerCase()}`}>
          <Pencil className="h-4 w-4" />
        </button>
      ) : <span className="w-11" />}
    </div>
  );
}
