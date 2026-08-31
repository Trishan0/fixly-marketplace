import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, Upload, X } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import {
  Button,
  Input,
  Textarea,
  Select,
  Card,
} from "../../components/shared/UI";
import { useToast } from "../../hooks/useToast";
import { DISTRICTS, cn } from "../../lib/utils";
import api from "../../lib/api";
import { uploadJobImages } from "../../lib/storage";

const URGENCIES = [
  { value: "today", label: "🔥 Today", desc: "Need it done ASAP" },
  { value: "tomorrow", label: "📅 Tomorrow", desc: "Can wait until tomorrow" },
  {
    value: "this_week",
    label: "📆 This Week",
    desc: "Flexible within the week",
  },
  {
    value: "flexible",
    label: "🕐 Flexible",
    desc: "No rush, whenever available",
  },
];

const PRICING_MODES = [
  { value: "fixed", label: "💰 Fixed Budget", desc: "I know my budget" },
  {
    value: "ask_quotes",
    label: "💬 Ask for Quotes",
    desc: "Let workers name their price",
  },
  {
    value: "inspection",
    label: "🔍 After Inspection",
    desc: "Price determined after site visit",
  },
];

const STEPS = ["Job details", "Location & photos", "Budget & review"];

export default function PostJob() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category_id: "",
    subcategory_id: "",
    urgency: "flexible",
    district: "",
    town: "",
    address: "",
    pricing_mode: "ask_quotes",
    fixed_budget: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get("/jobs/categories").then((r) => r.data),
  });

  const createJob = useMutation({
    mutationFn: async () => {
      const payload = { ...form, fixed_budget: form.fixed_budget || undefined };
      const { data } = await api.post("/jobs", payload);
      if (photos.length > 0) {
        try {
          await uploadJobImages(photos.map(photo => photo.file), data.id);
        } catch (error) {
          return { ...data, photoUploadFailed: true, photoUploadError: error.message };
        }
      }
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: data.photoUploadFailed ? "Job posted without photos" : "Job posted!",
        description: data.photoUploadFailed
          ? "Your job is live, but its photos could not be uploaded. You can continue safely without posting it twice."
          : "Workers can now send you proposals.",
        variant: data.photoUploadFailed ? "warning" : "success",
      });
      navigate(`/jobs/${data.id}`);
    },
    onError: (err) => {
      toast({
        title: "Failed to post job",
        description: err.response?.data?.error,
        variant: "error",
      });
    },
  });

  const handlePhotos = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 6 - photos.length);
    const newPhotos = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((p) => [...p, ...newPhotos]);
  };

  const stepContent = [
    <div key="details" className="space-y-5">
      <Input
        label="Job Title *"
        placeholder="e.g. Fix leaking kitchen pipe"
        value={form.title}
        onChange={set("title")}
        required
      />
      <Select
        label="Category *"
        value={form.category_id}
        onChange={set("category_id")}
      >
        <option value="">Select a category</option>
        {categories
          .filter((c) => !c.parent_id)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </Select>
      <div>
        <p className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Urgency
        </p>
        <div className="grid grid-cols-2 gap-2">
          {URGENCIES.map((u) => (
            <button
              key={u.value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, urgency: u.value }))}
              aria-pressed={form.urgency === u.value}
              className={cn(
                "min-h-20 rounded-xl border p-3 text-left transition-all",
                form.urgency === u.value
                  ? "border-sky-500 bg-sky-50 dark:bg-sky-950/40"
                  : "border-slate-200 hover:border-sky-200 dark:border-slate-700",
              )}
            >
              <p className="text-sm font-semibold">{u.label}</p>
              <p className="text-xs text-slate-500">{u.desc}</p>
            </button>
          ))}
        </div>
      </div>
      <Textarea
        label="Describe the problem *"
        placeholder="Explain what needs to be done in detail..."
        value={form.description}
        onChange={set("description")}
        rows={5}
        required
      />
      <p className="text-xs text-slate-400">
        Tip: Good descriptions attract better workers. Include the problem, any
        relevant measurements, and what outcome you expect.
      </p>
    </div>,

    <div key="location" className="space-y-5">
      <Select
        label="District *"
        value={form.district}
        onChange={set("district")}
      >
        <option value="">Select district</option>
        {DISTRICTS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </Select>
      <Input
        label="Town / Area"
        placeholder="e.g. Nugegoda"
        value={form.town}
        onChange={set("town")}
      />
      <Input
        label="Address / Landmark"
        placeholder="e.g. Near Nugegoda Market, Temple Road"
        value={form.address}
        onChange={set("address")}
      />
      <div>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Job photos</p>
            <p className="mt-1 text-xs text-slate-400">Optional, but photos help workers quote accurately.</p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-slate-400">{photos.length}/6</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {photos.map((photo, index) => (
            <div key={photo.preview} className="relative aspect-square overflow-hidden rounded-xl">
              <img src={photo.preview} className="h-full w-full object-cover" alt={`Job preview ${index + 1}`} />
              <button type="button" onClick={() => setPhotos(photos.filter((_, photoIndex) => photoIndex !== index))} className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white" aria-label={`Remove photo ${index + 1}`}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {photos.length < 6 && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 transition-all hover:border-sky-400 dark:border-slate-700">
              <Upload className="mb-1 h-5 w-5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">Add photo</span>
              <input type="file" accept="image/*" multiple onChange={handlePhotos} className="hidden" />
            </label>
          )}
        </div>
      </div>
    </div>,

    <div key="budget" className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">How should workers price this job?</p>
      <div className="space-y-2">
        {PRICING_MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setForm((f) => ({ ...f, pricing_mode: m.value }))}
            aria-pressed={form.pricing_mode === m.value}
            className={cn(
              "min-h-16 w-full rounded-xl border p-4 text-left transition-all",
              form.pricing_mode === m.value
                ? "border-sky-500 bg-sky-50 dark:bg-sky-950/40"
                : "border-slate-200 hover:border-sky-200 dark:border-slate-700",
            )}
          >
            <p className="font-semibold text-sm">{m.label}</p>
            <p className="text-xs text-slate-500">{m.desc}</p>
          </button>
          ))}
        </div>
      </div>
      {form.pricing_mode === "fixed" && (
        <Input
          label="Your Budget (LKR)"
          type="number"
          placeholder="5000"
          value={form.fixed_budget}
          onChange={set("fixed_budget")}
        />
      )}
      <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
        <h2 className="mb-3 text-base font-bold text-slate-900">Review your job</h2>
      <div className="space-y-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-900/70">
        <ReviewRow label="Title" value={form.title} />
        <ReviewRow
          label="Category"
          value={categories.find((c) => c.id === form.category_id)?.name || "-"}
        />
        <ReviewRow
          label="Urgency"
          value={URGENCIES.find((u) => u.value === form.urgency)?.label}
        />
        <ReviewRow
          label="Location"
          value={[form.district, form.town].filter(Boolean).join(", ") || "-"}
        />
        <ReviewRow
          label="Pricing"
          value={
            PRICING_MODES.find((p) => p.value === form.pricing_mode)?.label
          }
        />
        {form.pricing_mode === "fixed" && form.fixed_budget && (
          <ReviewRow
            label="Budget"
            value={`LKR ${Number(form.fixed_budget).toLocaleString()}`}
          />
        )}
        <ReviewRow
          label="Photos"
          value={`${photos.length} photo${photos.length !== 1 ? "s" : ""}`}
        />
      </div>
      <p className="text-xs text-slate-400">
        By posting, this job will be visible to all workers in the platform.
      </p>
      </div>
    </div>,
  ];

  const canNext = () => {
    if (step === 0) return form.title && form.category_id && form.description;
    if (step === 1) return form.district;
    return true;
  };

  return (
    <AppShell>
      <div className="fixly-page max-w-3xl pb-24 sm:pb-5 md:pb-6">
        <div className="mb-5 sm:mb-8">
          <button
            onClick={() => navigate(-1)}
            className="mb-3 flex min-h-11 items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700 sm:mb-4"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">Post a job</h1>
          <p className="text-slate-500 text-sm">
            Step {step + 1} of {STEPS.length} - {STEPS[step]}
          </p>
        </div>

        {/* Progress */}
        <div className="mb-5 flex items-center gap-2 sm:mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1.5 rounded-full flex-1 transition-all duration-300",
                i <= step ? "bg-sky-600" : "bg-slate-200",
              )}
            />
          ))}
        </div>

        <Card className="mb-6 p-4 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {stepContent[step]}
            </motion.div>
          </AnimatePresence>
        </Card>

        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 flex gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          {step > 0 && (
            <Button
              variant="secondary"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button
              variant="primary"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className="flex-1"
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => createJob.mutate()}
              loading={createJob.isPending}
              className="flex-1"
            >
              <Check className="w-4 h-4" /> Post Job
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="break-words text-right font-medium text-slate-800 dark:text-slate-200">{value || "-"}</span>
    </div>
  );
}
