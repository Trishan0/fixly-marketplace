import { pgTable, text, char, timestamp, uniqueIndex, foreignKey, uuid, varchar, boolean, index, check, integer, unique, numeric, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const schemaMigrations = pgTable("schema_migrations", {
	filename: text().primaryKey().notNull(),
	checksum: char({ length: 64 }).notNull(),
	appliedAt: timestamp("applied_at", { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

export const categories = pgTable("categories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	icon: varchar({ length: 50 }),
	isActive: boolean("is_active").default(true),
	parentId: uuid("parent_id"),
}, (table) => [
	uniqueIndex("uq_categories_name_ci").using("btree", sql`lower((name)::text)`),
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "categories_parent_id_fkey"
		}),
]);

export const reports = pgTable("reports", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	reporterId: uuid("reporter_id"),
	reportedUserId: uuid("reported_user_id"),
	jobId: uuid("job_id"),
	reportType: varchar("report_type", { length: 50 }),
	description: text(),
	status: varchar({ length: 20 }).default('open'),
	resolvedBy: uuid("resolved_by"),
	resolutionNote: text("resolution_note"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
	index("idx_reports_status_created").using("btree", table.status.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.reporterId],
			foreignColumns: [users.id],
			name: "reports_reporter_id_fkey"
		}),
	foreignKey({
			columns: [table.reportedUserId],
			foreignColumns: [users.id],
			name: "reports_reported_user_id_fkey"
		}),
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "reports_job_id_fkey"
		}),
	foreignKey({
			columns: [table.resolvedBy],
			foreignColumns: [users.id],
			name: "reports_resolved_by_fkey"
		}),
	check("reports_report_type_check", sql`(report_type)::text = ANY ((ARRAY['inappropriate_job'::character varying, 'fake_job'::character varying, 'no_show'::character varying, 'abusive_behavior'::character varying, 'fake_review'::character varying, 'price_dispute'::character varying, 'other'::character varying])::text[])`),
	check("reports_status_check", sql`(status)::text = ANY ((ARRAY['open'::character varying, 'reviewing'::character varying, 'dismissed'::character varying, 'warned'::character varying, 'actioned'::character varying])::text[])`),
]);

export const jobPhotos = pgTable("job_photos", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	jobId: uuid("job_id"),
	path: varchar({ length: 500 }).notNull(),
	orderIdx: integer("order_idx").default(0),
}, (table) => [
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "job_photos_job_id_fkey"
		}).onDelete("cascade"),
]);

export const invites = pgTable("invites", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	jobId: uuid("job_id"),
	customerId: uuid("customer_id"),
	workerId: uuid("worker_id"),
	message: text(),
	status: varchar({ length: 20 }).default('pending'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
	index("idx_invites_customer_created").using("btree", table.customerId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("idx_invites_worker_status_created").using("btree", table.workerId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "invites_job_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [users.id],
			name: "invites_customer_id_fkey"
		}),
	foreignKey({
			columns: [table.workerId],
			foreignColumns: [users.id],
			name: "invites_worker_id_fkey"
		}),
	unique("invites_job_id_worker_id_key").on(table.workerId, table.jobId),
	check("invites_status_check", sql`(status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'declined'::character varying])::text[])`),
]);

export const proposals = pgTable("proposals", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	jobId: uuid("job_id"),
	workerId: uuid("worker_id"),
	proposedPrice: numeric("proposed_price", { precision: 12, scale:  2 }),
	inspectionNeeded: boolean("inspection_needed").default(false),
	availability: varchar({ length: 255 }),
	message: text(),
	status: varchar({ length: 20 }).default('pending'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
	index("idx_proposals_job_status").using("btree", table.jobId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	index("idx_proposals_worker_created").using("btree", table.workerId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "proposals_job_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workerId],
			foreignColumns: [users.id],
			name: "proposals_worker_id_fkey"
		}),
	unique("proposals_job_id_worker_id_key").on(table.workerId, table.jobId),
	check("proposals_status_check", sql`(status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'declined'::character varying, 'withdrawn'::character varying])::text[])`),
]);

export const payments = pgTable("payments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	jobId: uuid("job_id"),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	method: varchar({ length: 50 }),
	note: text(),
	recordedBy: uuid("recorded_by"),
	workerConfirmed: boolean("worker_confirmed").default(false),
	disputed: boolean().default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.recordedBy],
			foreignColumns: [users.id],
			name: "payments_recorded_by_fkey"
		}),
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "payments_job_id_fkey"
		}),
	unique("payments_job_id_key").on(table.jobId),
	check("payments_method_check", sql`(method)::text = ANY ((ARRAY['cash'::character varying, 'bank_transfer'::character varying, 'other'::character varying])::text[])`),
]);

export const reviews = pgTable("reviews", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	jobId: uuid("job_id"),
	customerId: uuid("customer_id"),
	workerId: uuid("worker_id"),
	rating: integer(),
	feedback: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
	index("idx_reviews_worker_created").using("btree", table.workerId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "reviews_job_id_fkey"
		}),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [users.id],
			name: "reviews_customer_id_fkey"
		}),
	foreignKey({
			columns: [table.workerId],
			foreignColumns: [users.id],
			name: "reviews_worker_id_fkey"
		}),
	unique("reviews_job_id_key").on(table.jobId),
	check("reviews_rating_check", sql`(rating >= 1) AND (rating <= 5)`),
]);

export const workerPortfolioPhotos = pgTable("worker_portfolio_photos", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workerId: uuid("worker_id"),
	path: varchar({ length: 500 }).notNull(),
	orderIdx: integer("order_idx").default(0),
}, (table) => [
	foreignKey({
			columns: [table.workerId],
			foreignColumns: [workerProfiles.id],
			name: "worker_portfolio_photos_worker_id_fkey"
		}).onDelete("cascade"),
]);

export const rateLimitBuckets = pgTable("rate_limit_buckets", {
	keyHash: varchar("key_hash", { length: 64 }).primaryKey().notNull(),
	count: integer().default(1).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'date' }).notNull(),
}, (table) => [
	index("idx_rate_limit_buckets_expires_at").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	check("rate_limit_buckets_count_check", sql`count > 0`),
]);

export const agentRunSteps = pgTable("agent_run_steps", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	runId: uuid("run_id").notNull(),
	stepIndex: integer("step_index").default(0).notNull(),
	stepName: varchar("step_name", { length: 100 }).notNull(),
	inputJson: jsonb("input_json"),
	outputJson: jsonb("output_json"),
	decision: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
	index("idx_agent_run_steps_run_id").using("btree", table.runId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.runId],
			foreignColumns: [agentRuns.id],
			name: "agent_run_steps_run_id_fkey"
		}).onDelete("cascade"),
]);

export const agentRecommendations = pgTable("agent_recommendations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	runId: uuid("run_id").notNull(),
	entityType: varchar("entity_type", { length: 20 }).notNull(),
	entityId: uuid("entity_id").notNull(),
	score: numeric({ precision: 5, scale:  4 }).notNull(),
	factorsJson: jsonb("factors_json"),
	rationale: text(),
	rank: integer().notNull(),
	actionTaken: varchar("action_taken", { length: 30 }),
	actionAt: timestamp("action_at", { withTimezone: true, mode: 'date' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
	index("idx_agent_recommendations_rank").using("btree", table.runId.asc().nullsLast().op("int4_ops"), table.rank.asc().nullsLast().op("int4_ops")),
	index("idx_agent_recommendations_run_id").using("btree", table.runId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.runId],
			foreignColumns: [agentRuns.id],
			name: "agent_recommendations_run_id_fkey"
		}).onDelete("cascade"),
	check("agent_recommendations_entity_type_check", sql`(entity_type)::text = ANY ((ARRAY['worker'::character varying, 'job'::character varying])::text[])`),
	check("agent_recommendations_score_check", sql`(score >= (0)::numeric) AND (score <= (1)::numeric)`),
]);

export const agentMemories = pgTable("agent_memories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	scope: varchar({ length: 50 }).notNull(),
	key: varchar({ length: 100 }).notNull(),
	valueJson: jsonb("value_json").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
	index("idx_agent_memories_user_scope").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.scope.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "agent_memories_user_id_fkey"
		}).onDelete("cascade"),
	unique("agent_memories_user_id_scope_key_key").on(table.userId, table.scope, table.key),
]);

export const agentRuns = pgTable("agent_runs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	agentType: varchar("agent_type", { length: 30 }).notNull(),
	objective: text(),
	planJson: jsonb("plan_json"),
	status: varchar({ length: 50 }).default('pending').notNull(),
	jobId: uuid("job_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'date' }),
}, (table) => [
	index("idx_agent_runs_created").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_agent_runs_job_id").using("btree", table.jobId.asc().nullsLast().op("uuid_ops")),
	index("idx_agent_runs_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_agent_runs_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "agent_runs_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "agent_runs_job_id_fkey"
		}).onDelete("set null"),
	check("agent_runs_agent_type_check", sql`(agent_type)::text = ANY ((ARRAY['match'::character varying, 'proposal'::character varying])::text[])`),
	check("agent_runs_status_check", sql`(status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying, 'awaiting_confirmation'::character varying, 'confirmed'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'error'::character varying])::text[])`),
]);

export const notifications = pgTable("notifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	type: varchar({ length: 50 }).notNull(),
	title: varchar({ length: 255 }),
	body: text(),
	isRead: boolean("is_read").default(false),
	meta: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
	index("idx_notifications_user_read_created").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.isRead.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notifications_user_id_fkey"
		}).onDelete("cascade"),
]);

export const jobs = pgTable("jobs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	customerId: uuid("customer_id"),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	categoryId: uuid("category_id"),
	subcategoryId: uuid("subcategory_id"),
	district: varchar({ length: 100 }),
	town: varchar({ length: 100 }),
	address: text(),
	urgency: varchar({ length: 50 }),
	pricingMode: varchar("pricing_mode", { length: 30 }),
	fixedBudget: numeric("fixed_budget", { precision: 12, scale:  2 }),
	status: varchar({ length: 30 }).default('posted'),
	assignedWorkerId: uuid("assigned_worker_id"),
	finalPrice: numeric("final_price", { precision: 12, scale:  2 }),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
	index("idx_jobs_assigned_worker_status").using("btree", table.assignedWorkerId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	index("idx_jobs_category_district").using("btree", table.categoryId.asc().nullsLast().op("uuid_ops"), table.district.asc().nullsLast().op("uuid_ops")),
	index("idx_jobs_customer_created").using("btree", table.customerId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("idx_jobs_status_active_created").using("btree", table.status.asc().nullsLast().op("bool_ops"), table.isActive.asc().nullsLast().op("bool_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [users.id],
			name: "jobs_customer_id_fkey"
		}),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "jobs_category_id_fkey"
		}),
	foreignKey({
			columns: [table.subcategoryId],
			foreignColumns: [categories.id],
			name: "jobs_subcategory_id_fkey"
		}),
	foreignKey({
			columns: [table.assignedWorkerId],
			foreignColumns: [users.id],
			name: "jobs_assigned_worker_id_fkey"
		}),
	check("jobs_urgency_check", sql`(urgency)::text = ANY ((ARRAY['today'::character varying, 'tomorrow'::character varying, 'this_week'::character varying, 'flexible'::character varying])::text[])`),
	check("jobs_pricing_mode_check", sql`(pricing_mode)::text = ANY ((ARRAY['fixed'::character varying, 'ask_quotes'::character varying, 'inspection'::character varying])::text[])`),
	check("jobs_status_check", sql`(status)::text = ANY ((ARRAY['posted'::character varying, 'proposals_received'::character varying, 'assigned'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'payment_recorded'::character varying, 'reviewed'::character varying, 'cancelled'::character varying])::text[])`),
]);

export const workerSkills = pgTable("worker_skills", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workerId: uuid("worker_id"),
	categoryId: uuid("category_id"),
	isPrimary: boolean("is_primary").default(false),
}, (table) => [
	uniqueIndex("uq_worker_skills_worker_category").using("btree", table.workerId.asc().nullsLast().op("uuid_ops"), table.categoryId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.workerId],
			foreignColumns: [workerProfiles.id],
			name: "worker_skills_worker_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "worker_skills_category_id_fkey"
		}),
]);

export const workerProfiles = pgTable("worker_profiles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	bio: text(),
	startingPrice: varchar("starting_price", { length: 100 }),
	primarySkill: varchar("primary_skill", { length: 100 }),
	totalJobsDone: integer("total_jobs_done").default(0),
	avgRating: numeric("avg_rating", { precision: 3, scale:  2 }).default('0'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "worker_profiles_user_id_fkey"
		}).onDelete("cascade"),
	unique("worker_profiles_user_id_key").on(table.userId),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	fullName: varchar("full_name", { length: 255 }).notNull(),
	phone: varchar({ length: 20 }),
	role: varchar({ length: 20 }).notNull(),
	area: varchar({ length: 100 }),
	district: varchar({ length: 100 }),
	profilePhoto: varchar("profile_photo", { length: 500 }),
	isEmailVerified: boolean("is_email_verified").default(false),
	emailVerifyToken: varchar("email_verify_token", { length: 255 }),
	isNicVerified: boolean("is_nic_verified").default(false),
	nicImagePath: varchar("nic_image_path", { length: 500 }),
	nicVerifiedBy: uuid("nic_verified_by"),
	forceVerified: boolean("force_verified").default(false),
	isSuspended: boolean("is_suspended").default(false),
	dashboardMode: varchar("dashboard_mode", { length: 20 }).default('standard'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).defaultNow(),
	emailVerifyTokenHash: varchar("email_verify_token_hash", { length: 255 }),
	emailVerifyExpiresAt: timestamp("email_verify_expires_at", { withTimezone: true, mode: 'date' }),
	passwordResetTokenHash: varchar("password_reset_token_hash", { length: 255 }),
	passwordResetExpiresAt: timestamp("password_reset_expires_at", { withTimezone: true, mode: 'date' }),
}, (table) => [
	index("idx_users_email_verify_token_hash").using("btree", table.emailVerifyTokenHash.asc().nullsLast().op("text_ops")),
	index("idx_users_password_reset_token_hash").using("btree", table.passwordResetTokenHash.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.nicVerifiedBy],
			foreignColumns: [table.id],
			name: "users_nic_verified_by_fkey"
		}),
	unique("users_email_key").on(table.email),
	check("users_role_check", sql`(role)::text = ANY ((ARRAY['customer'::character varying, 'worker'::character varying, 'admin'::character varying])::text[])`),
]);
