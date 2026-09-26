import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Users,
  Briefcase,
  FileText,
  Tag,
  Shield,
  Search,
  CheckCircle,
  XCircle,
  ArrowRight,
  Clock3,
  Bot,
  Scale,
  Plus,
  Star,
} from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import {
  Button,
  Input,
  Modal,
} from "../../components/shared/UI";
import { AttentionItem, Card as UiCard, CardHeader, EmptyState, IconChip, Page, PageHeader as UiPageHeader, PersonAvatar, Skeleton, StatTile, StatusBadge, Table, Td, Th } from "../../components/ui";
import { categoryStyle } from "../../lib/tones";
import { useToast } from "../../hooks/useToast";
import { formatDate, cn, pluralize } from "../../lib/utils";
import api from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";

const SUSPEND_REASONS = [
  { value: "abuse", label: "Abusive or threatening behaviour" },
  { value: "fraud", label: "Fraud, scams or fake jobs" },
  { value: "fake_reviews", label: "Fake reviews or rating manipulation" },
  { value: "other", label: "Other" },
];

const NIC_REJECTION_REASONS = [
  { value: "blurry", label: "Photo is blurry or too dark" },
  { value: "cropped", label: "Part of the card is cut off or covered" },
  { value: "name_mismatch", label: "Name doesn’t match the profile" },
  { value: "not_nic", label: "Image isn’t a National Identity Card" },
  { value: "other", label: "Other" },
];

function PrivateNicImage({ src, alt = "NIC" }) {
  const isPrivate = src?.includes('.private.blob.vercel-storage.com');
  const [loadedImage, setLoadedImage] = useState({ src: '', url: '' });

  useEffect(() => {
    if (!isPrivate) return undefined;

    let active = true;
    let objectUrl;
    api.get('/uploads/private', { params: { url: src }, responseType: 'blob' })
      .then(response => {
        objectUrl = URL.createObjectURL(response.data);
        if (active) setLoadedImage({ src, url: objectUrl });
      })
      .catch(() => { if (active) setLoadedImage({ src, url: '' }); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isPrivate, src]);

  const imageUrl = isPrivate
    ? (loadedImage.src === src ? loadedImage.url : '')
    : src;

  if (!imageUrl) {
    return <div className="mb-3 flex h-36 w-full items-center justify-center rounded-control border border-line bg-subtle text-sm text-fg-subtle">Loading private document…</div>;
  }
  return <a href={imageUrl} target="_blank" rel="noreferrer" className="mb-3 block"><img src={imageUrl} alt={alt} className="h-36 w-full rounded-control border border-line object-cover" /></a>;
}

// Admin Dashboard
export function AdminDashboard() {
  usePageTitle("Admin overview");
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get("/admin/stats").then((r) => r.data),
    refetchInterval: 60000,
  });

  const { data: workers = [] } = useQuery({
    queryKey: ["admin-workers-dashboard"],
    queryFn: () => api.get("/admin/workers").then((r) => r.data),
    refetchInterval: 60000,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["admin-reports-dashboard"],
    queryFn: () => api.get("/admin/reports").then((r) => r.data),
    refetchInterval: 60000,
  });

  const pendingWorkers = workers.filter(
    (w) => w.nic_image_path && !w.is_nic_verified,
  );
  const openReports = reports.filter((r) => r.status === "open");
  const openDisputes = stats?.open_disputes ?? 0;
  const attention = [
    pendingWorkers.length > 0 && {
      key: "nic", icon: Shield, tone: "emerald",
      title: `${pendingWorkers.length} NIC ${pendingWorkers.length === 1 ? "review" : "reviews"} waiting`,
      detail: "Check the photo and verify or reject", to: "/admin/workers", action: "Review",
    },
    openReports.length > 0 && {
      key: "reports", icon: FileText, tone: "rose",
      title: `${openReports.length} open ${openReports.length === 1 ? "report" : "reports"}`,
      detail: "Users and jobs flagged by the community", to: "/admin/reports", action: "Review",
    },
    openDisputes > 0 && {
      key: "disputes", icon: Scale, tone: "amber",
      title: `${openDisputes} payment ${openDisputes === 1 ? "dispute" : "disputes"}`,
      detail: "Workers who say a payment is wrong", to: "/admin/disputes", action: "Resolve",
    },
  ].filter(Boolean);

  const tools = [
    { to: "/admin/users", icon: Users, tone: "sky", title: "Users", desc: "Search accounts, suspend abuse, adjust verification" },
    { to: "/admin/workers", icon: Shield, tone: "emerald", title: "Worker verification", desc: "Review NIC photos and verified badges" },
    { to: "/admin/jobs", icon: Briefcase, tone: "indigo", title: "Jobs", desc: "Search every job and take down rule-breaking posts" },
    { to: "/admin/reports", icon: FileText, tone: "rose", title: "Reports", desc: "Act on reports from customers and workers" },
    { to: "/admin/disputes", icon: Scale, tone: "amber", title: "Payment disputes", desc: "Close out disagreements about payments" },
    { to: "/admin/categories", icon: Tag, tone: "violet", title: "Categories", desc: "Keep services clean, active and easy to browse" },
  ];

  return (
    <AppShell>
      <Page>
        <UiPageHeader title="Admin overview" description="Marketplace activity and the queues that need you." />
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <StatTile icon={Users} tone="sky" label="Users" value={stats?.total_users} note="All accounts" to="/admin/users" />
            <StatTile icon={Shield} tone="violet" label="Workers" value={stats?.total_workers} note="Service providers" to="/admin/workers" />
            <StatTile icon={Briefcase} tone="indigo" label="Jobs" value={stats?.total_jobs} note="Ever posted" to="/admin/jobs" />
            <StatTile icon={Clock3} tone="teal" label="Open jobs" value={stats?.open_jobs} note="Waiting for a worker" />
            <StatTile icon={FileText} tone="rose" label="Open reports" value={stats?.open_reports} note="Need moderation" to="/admin/reports" />
            <StatTile icon={Bot} tone="amber" label="AI opted out" value={stats?.ai_matching_opted_out} note="Workers not matched by AI" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <UiCard aria-labelledby="admin-attention" className="self-start">
              <CardHeader
                id="admin-attention"
                title="Needs attention"
                actions={attention.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{attention.length}</span>}
              />
              {attention.length === 0 ? (
                <div className="flex flex-col items-center px-5 py-8 text-center">
                  <IconChip icon={CheckCircle} tone="emerald" />
                  <p className="mt-3 text-sm font-semibold text-fg">All queues are clear</p>
                  <p className="mt-0.5 text-[13px] text-fg-muted">New reviews, reports and disputes show up here.</p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {attention.map(({ key, ...item }) => <AttentionItem key={key} {...item} />)}
                </ul>
              )}
            </UiCard>

            <UiCard aria-labelledby="admin-tools">
              <CardHeader id="admin-tools" title="Admin tools" />
              <ul className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
                {tools.map(({ to, icon, tone, title, desc }) => (
                  <li key={to} className="sm:border-b sm:border-line sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0">
                    <Link to={to} className="group flex items-start gap-3 px-4 py-4 transition-colors hover:bg-subtle sm:px-5">
                      <IconChip icon={icon} tone={tone} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 text-sm font-semibold text-fg">
                          {title}
                          <ArrowRight className="h-4 w-4 text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-5 text-fg-muted">{desc}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </UiCard>
          </div>
        </div>
      </Page>
    </AppShell>
  );
}

// Admin Users
export function AdminUsers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const debouncedSearch = useDebouncedValue(search.trim());
  usePageTitle("Users");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", { search: debouncedSearch, role }],
    queryFn: () =>
      api.get("/admin/users", { params: { search: debouncedSearch || undefined, role: role || undefined } }).then((r) => r.data),
  });

  const ACTION_MESSAGES = {
    suspend: (data) => (data.suspended ? "User suspended" : "User reinstated"),
    "force-verify": (data) => (data.force_verified ? "Email verification bypassed" : "Email bypass removed"),
    "verify-nic": (data) => (data.verified ? "NIC verified" : "NIC badge removed"),
  };

  const update = useMutation({
    mutationFn: ({ id, action, data }) =>
      api.put(`/admin/users/${id}/${action}`, data),
    onSuccess: (_result, { action, data }) => {
      toast({ title: ACTION_MESSAGES[action]?.(data) || "Updated", variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-workers"] });
      setSelectedUser(null);
      setSuspendTarget(null);
    },
    onError: (e) =>
      toast({
        title: "Action failed",
        description: errorMessage(e),
        variant: "error",
      }),
  });
  const toggleSuspension = (u) => {
    if (u.is_suspended) update.mutate({ id: u.id, action: "suspend", data: { suspended: false } });
    else setSuspendTarget(u);
  };
  const isUpdating = (u, action) => update.isPending && update.variables?.id === u.id && update.variables?.action === action;

  const users = data?.users || [];

  return (
    <AppShell>
      <Page>
        <UiPageHeader title="Users" description={data ? `${data.total || 0} accounts` : "Search and manage accounts."} />

        <UiCard as="div" className="mb-5 p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
              <input type="search" aria-label="Search users" className="fixly-input pl-9" placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select aria-label="Filter by role" className="fixly-input fixly-select sm:w-40" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All roles</option>
              <option value="customer">Customers</option>
              <option value="worker">Workers</option>
            </select>
          </div>
        </UiCard>

        {isLoading ? (
          <UiCard className="space-y-3 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11 w-full" />)}</UiCard>
        ) : users.length === 0 ? (
          <UiCard><EmptyState icon={Users} title="No users found" description="Try a different name, email or role." /></UiCard>
        ) : (
          <>
            <ul className="space-y-3 md:hidden">
              {users.map((u) => (
                <UiCard as="li" key={u.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <PersonAvatar name={u.full_name} src={u.profile_photo} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-fg">{u.full_name}</p>
                      <p className="break-all text-xs text-fg-muted">{u.email}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5"><RoleBadge role={u.role} /><UserFlags user={u} /></div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4">
                    <Button size="sm" variant="secondary" onClick={() => setSelectedUser(u)}>Manage</Button>
                    <Button size="sm" variant={u.is_suspended ? "success" : "danger-ghost"} onClick={() => toggleSuspension(u)} loading={isUpdating(u, "suspend")}>
                      {u.is_suspended ? "Reinstate" : "Suspend"}
                    </Button>
                  </div>
                </UiCard>
              ))}
            </ul>
            <UiCard className="hidden overflow-hidden md:block">
              <Table>
                <thead>
                  <tr><Th>User</Th><Th>Role</Th><Th>District</Th><Th>Status</Th><Th align="right">Actions</Th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="transition-colors hover:bg-subtle/60 [&:last-child>td]:border-b-0">
                      <Td>
                        <div className="flex items-center gap-3">
                          <PersonAvatar name={u.full_name} src={u.profile_photo} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-fg">{u.full_name}</p>
                            <p className="truncate text-xs text-fg-muted">{u.email}</p>
                          </div>
                        </div>
                      </Td>
                      <Td><RoleBadge role={u.role} /></Td>
                      <Td className="text-fg-muted">{u.district || "—"}</Td>
                      <Td><div className="flex flex-wrap gap-1.5"><UserFlags user={u} /></div></Td>
                      <Td align="right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => setSelectedUser(u)}>Manage</Button>
                          <Button size="sm" variant={u.is_suspended ? "success" : "danger-ghost"} onClick={() => toggleSuspension(u)} loading={isUpdating(u, "suspend")}>
                            {u.is_suspended ? "Reinstate" : "Suspend"}
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </UiCard>
          </>
        )}
      </Page>

      {/* User detail modal */}
      <Modal
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.full_name}
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Email", selectedUser.email],
                ["Role", selectedUser.role],
                ["District", selectedUser.district || "-"],
                ["Joined", formatDate(selectedUser.created_at)],
              ].map(([l, v]) => (
                <div key={l} className="min-w-0">
                  <p className="text-xs text-fg-subtle">{l}</p>
                  <p className="break-words font-medium text-fg">{v}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3 border-t border-line pt-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">
                  <span className="block font-medium text-fg">Skip email verification</span>
                  <span className="block text-xs text-fg-muted">Lets them post and apply before confirming their email</span>
                </span>
                <Button
                  size="sm"
                  variant={selectedUser.force_verified ? "danger-ghost" : "secondary"}
                  onClick={() =>
                    update.mutate({
                      id: selectedUser.id,
                      action: "force-verify",
                      data: { force_verified: !selectedUser.force_verified },
                    })
                  }
                  loading={update.isPending}
                >
                  {selectedUser.force_verified ? "Undo" : "Skip"}
                </Button>
              </div>
              {selectedUser.role === "worker" && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">
                    <span className="block font-medium text-fg">Verified badge</span>
                    <span className="block text-xs text-fg-muted">Shown on the worker’s profile and cards</span>
                  </span>
                  <Button
                    size="sm"
                    variant={selectedUser.is_nic_verified ? "danger-ghost" : "success"}
                    onClick={() =>
                      update.mutate({
                        id: selectedUser.id,
                        action: "verify-nic",
                        data: { verified: !selectedUser.is_nic_verified },
                      })
                    }
                    loading={update.isPending}
                  >
                    {selectedUser.is_nic_verified ? "Remove badge" : "Verify"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(suspendTarget)}
        onClose={() => setSuspendTarget(null)}
        onConfirm={(reason) => update.mutate({ id: suspendTarget.id, action: "suspend", data: { suspended: true, reason } })}
        loading={update.isPending}
        title={`Suspend ${suspendTarget?.full_name || "this user"}?`}
        description="They’ll be blocked from Fixly straight away, and a worker’s profile will be hidden from customers. You can reinstate them later. The reason is saved in the audit log."
        confirmLabel="Suspend user"
        tone="danger"
        reason={{ label: "Why are you suspending this account?", placeholder: "Add details, e.g. report IDs or what happened.", required: true, options: SUSPEND_REASONS }}
      />
    </AppShell>
  );
}

// Admin Workers
export function AdminWorkers() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: workers = [], isLoading } = useQuery({
    queryKey: ["admin-workers"],
    queryFn: () => api.get("/admin/workers").then((r) => r.data),
  });

  const [rejecting, setRejecting] = useState(null);
  usePageTitle("Workers");

  const verify = useMutation({
    mutationFn: ({ id }) => api.put(`/admin/users/${id}/verify-nic`, { verified: true }),
    onSuccess: (_data, worker) => {
      toast({ title: `${worker.full_name} is verified`, description: "We’ve notified them and added the badge to their profile.", variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-workers"] });
    },
    onError: (e) => toast({ title: "Couldn’t verify", description: errorMessage(e), variant: "error" }),
  });

  const reject = useMutation({
    mutationFn: ({ worker, reason }) => api.put(`/admin/users/${worker.id}/reject-nic`, { reason }),
    onSuccess: (_data, { worker }) => {
      setRejecting(null);
      toast({ title: "NIC rejected", description: `We’ve told ${worker.full_name} why and asked for a new photo.` });
      qc.invalidateQueries({ queryKey: ["admin-workers"] });
    },
    onError: (e) => toast({ title: "Couldn’t reject", description: errorMessage(e), variant: "error" }),
  });

  const pending = workers.filter((w) => w.nic_image_path && !w.is_nic_verified);
  return (
    <AppShell>
      <Page>
        <UiPageHeader title="Worker verification" description="Check NIC photos and manage verified badges." />
        <div className="space-y-6">
          {pending.length > 0 && (
            <section aria-labelledby="pending-nic">
              <h2 id="pending-nic" className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-fg">
                Waiting for review
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{pending.length}</span>
              </h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pending.map((w) => (
                  <UiCard as="article" key={w.id} className="border-amber-200 p-4 dark:border-amber-500/30 sm:p-5">
                    <div className="mb-3 flex items-start gap-3">
                      <PersonAvatar name={w.full_name} src={w.profile_photo} size="md" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-fg">{w.full_name}</p>
                        <p className="truncate text-[13px] text-fg-muted">{[w.primary_skill, w.district].filter(Boolean).join(" · ") || "Profile incomplete"}</p>
                      </div>
                    </div>
                    {w.nic_image_path && <PrivateNicImage src={w.nic_image_path} alt={`NIC photo for ${w.full_name}`} />}
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="success" size="sm" onClick={() => verify.mutate(w)} loading={verify.isPending && verify.variables?.id === w.id}>
                        <CheckCircle className="h-4 w-4" aria-hidden="true" /> Verify
                      </Button>
                      <Button variant="danger-ghost" size="sm" onClick={() => setRejecting(w)}>
                        <XCircle className="h-4 w-4" aria-hidden="true" /> Reject
                      </Button>
                    </div>
                  </UiCard>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="all-workers">
            <h2 id="all-workers" className="mb-3 text-[15px] font-semibold text-fg">All workers <span className="font-normal text-fg-subtle">({workers.length})</span></h2>
            {isLoading ? (
              <UiCard className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-11 w-full" />)}</UiCard>
            ) : (
              <>
                <ul className="space-y-3 md:hidden">
                  {workers.map((w) => (
                    <UiCard as="li" key={w.id} className="flex items-center gap-3 p-4">
                      <PersonAvatar name={w.full_name} src={w.profile_photo} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-fg">{w.full_name}</p>
                        <p className="truncate text-[13px] text-fg-muted">{w.primary_skill || "Skill not set"} · {pluralize(w.total_jobs_done || 0, "job")}</p>
                      </div>
                      <NicStatus worker={w} />
                    </UiCard>
                  ))}
                </ul>
                <UiCard className="hidden overflow-hidden md:block">
                  <Table>
                    <thead>
                      <tr><Th>Worker</Th><Th>Skill</Th><Th align="right">Rating</Th><Th align="right">Jobs</Th><Th>NIC</Th></tr>
                    </thead>
                    <tbody>
                      {workers.map((w) => (
                        <tr key={w.id} className="transition-colors hover:bg-subtle/60 [&:last-child>td]:border-b-0">
                          <Td>
                            <Link to={`/workers/${w.id}`} className="flex items-center gap-3 hover:text-brand-text">
                              <PersonAvatar name={w.full_name} src={w.profile_photo} />
                              <span className="min-w-0">
                                <span className="block truncate font-medium">{w.full_name}</span>
                                <span className="block truncate text-xs text-fg-muted">{w.district || "—"}</span>
                              </span>
                            </Link>
                          </Td>
                          <Td className="text-fg-muted">{w.primary_skill || "—"}</Td>
                          <Td align="right">{w.avg_rating ? <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />{Number(w.avg_rating).toFixed(1)}</span> : "—"}</Td>
                          <Td align="right">{w.total_jobs_done || 0}</Td>
                          <Td><NicStatus worker={w} /></Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </UiCard>
              </>
            )}
          </section>
        </div>
      </Page>

      <ConfirmDialog
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        onConfirm={(reason) => reject.mutate({ worker: rejecting, reason })}
        loading={reject.isPending}
        title={`Reject ${rejecting?.full_name || "this"}’s NIC?`}
        description="The image will be deleted and the worker will see your reason and be asked to upload a new one."
        confirmLabel="Reject NIC"
        tone="danger"
        reason={{ label: "What’s wrong with the photo?", placeholder: "Anything else the worker should know", required: true, options: NIC_REJECTION_REASONS }}
      />
    </AppShell>
  );
}

// Admin Categories
export function AdminCategories() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newCat, setNewCat] = useState({ name: "", icon: "" });
  const [adding, setAdding] = useState(false);

  const { data: cats = [], isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => api.get("/admin/categories").then((r) => r.data),
  });

  usePageTitle("Categories");
  const add = useMutation({
    mutationFn: () => api.post("/admin/categories", newCat),
    onSuccess: () => {
      toast({ title: "Category added", variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      setNewCat({ name: "", icon: "" });
      setAdding(false);
    },
  });

  const toggle = useMutation({
    mutationFn: ({ id, is_active }) =>
      api.put(`/admin/categories/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
  });

  return (
    <AppShell>
      <Page width="narrow">
        <UiPageHeader
          title="Categories"
          description="The services customers can post jobs for."
          actions={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Add category</Button>}
        />

        {isLoading ? (
          <UiCard className="space-y-3 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</UiCard>
        ) : (
          <UiCard>
            <ul className="divide-y divide-line">
              {cats.map((c) => {
                const { icon, tone } = categoryStyle(c.name);
                return (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <IconChip icon={icon} tone={c.is_active ? tone : "slate"} size="sm" />
                    <span className={cn("flex-1 text-sm font-medium", c.is_active ? "text-fg" : "text-fg-subtle line-through")}>{c.name}</span>
                    {!c.is_active && <StatusBadge tone="slate">Hidden</StatusBadge>}
                    <Button size="sm" variant={c.is_active ? "ghost" : "secondary"} onClick={() => toggle.mutate({ id: c.id, is_active: !c.is_active })} loading={toggle.isPending && toggle.variables?.id === c.id}>
                      {c.is_active ? "Hide" : "Show"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </UiCard>
        )}
      </Page>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a category"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={newCat.name}
            onChange={(e) => setNewCat((c) => ({ ...c, name: e.target.value }))}
            placeholder="e.g. Solar Installation"
          />
          <Input
            label="Icon (emoji)"
            value={newCat.icon}
            onChange={(e) => setNewCat((c) => ({ ...c, icon: e.target.value }))}
            placeholder="e.g. ☀️"
          />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => setAdding(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => add.mutate()}
              loading={add.isPending}
              disabled={!newCat.name}
            >
              Add category
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}

function RoleBadge({ role }) {
  return <StatusBadge tone={role === "worker" ? "violet" : role === "admin" ? "rose" : "sky"}>{role === "worker" ? "Worker" : role === "admin" ? "Admin" : "Customer"}</StatusBadge>;
}

function UserFlags({ user }) {
  return (
    <>
      {user.is_suspended && <StatusBadge tone="rose">Suspended</StatusBadge>}
      {user.is_nic_verified && <StatusBadge tone="sky">ID verified</StatusBadge>}
      {user.is_email_verified ? <StatusBadge tone="emerald">Email verified</StatusBadge> : user.force_verified ? <StatusBadge tone="indigo">Email skipped</StatusBadge> : <StatusBadge tone="amber">Email unverified</StatusBadge>}
    </>
  );
}

function NicStatus({ worker }) {
  if (worker.is_nic_verified) return <StatusBadge tone="emerald">Verified</StatusBadge>;
  if (worker.nic_image_path) return <StatusBadge tone="amber">Pending</StatusBadge>;
  return <StatusBadge tone="slate">Not uploaded</StatusBadge>;
}
