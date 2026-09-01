import { relations } from "drizzle-orm/relations";
import { categories, users, reports, jobs, jobPhotos, invites, proposals, payments, reviews, workerProfiles, workerPortfolioPhotos, agentRuns, agentRunSteps, agentRecommendations, agentMemories, notifications, workerSkills } from "./schema";

export const categoriesRelations = relations(categories, ({one, many}) => ({
	category: one(categories, {
		fields: [categories.parentId],
		references: [categories.id],
		relationName: "categories_parentId_categories_id"
	}),
	categories: many(categories, {
		relationName: "categories_parentId_categories_id"
	}),
	jobs_categoryId: many(jobs, {
		relationName: "jobs_categoryId_categories_id"
	}),
	jobs_subcategoryId: many(jobs, {
		relationName: "jobs_subcategoryId_categories_id"
	}),
	workerSkills: many(workerSkills),
}));

export const reportsRelations = relations(reports, ({one}) => ({
	user_reporterId: one(users, {
		fields: [reports.reporterId],
		references: [users.id],
		relationName: "reports_reporterId_users_id"
	}),
	user_reportedUserId: one(users, {
		fields: [reports.reportedUserId],
		references: [users.id],
		relationName: "reports_reportedUserId_users_id"
	}),
	job: one(jobs, {
		fields: [reports.jobId],
		references: [jobs.id]
	}),
	user_resolvedBy: one(users, {
		fields: [reports.resolvedBy],
		references: [users.id],
		relationName: "reports_resolvedBy_users_id"
	}),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	reports_reporterId: many(reports, {
		relationName: "reports_reporterId_users_id"
	}),
	reports_reportedUserId: many(reports, {
		relationName: "reports_reportedUserId_users_id"
	}),
	reports_resolvedBy: many(reports, {
		relationName: "reports_resolvedBy_users_id"
	}),
	invites_customerId: many(invites, {
		relationName: "invites_customerId_users_id"
	}),
	invites_workerId: many(invites, {
		relationName: "invites_workerId_users_id"
	}),
	proposals: many(proposals),
	payments: many(payments),
	reviews_customerId: many(reviews, {
		relationName: "reviews_customerId_users_id"
	}),
	reviews_workerId: many(reviews, {
		relationName: "reviews_workerId_users_id"
	}),
	agentMemories: many(agentMemories),
	agentRuns: many(agentRuns),
	notifications: many(notifications),
	jobs_customerId: many(jobs, {
		relationName: "jobs_customerId_users_id"
	}),
	jobs_assignedWorkerId: many(jobs, {
		relationName: "jobs_assignedWorkerId_users_id"
	}),
	workerProfiles: many(workerProfiles),
	user: one(users, {
		fields: [users.nicVerifiedBy],
		references: [users.id],
		relationName: "users_nicVerifiedBy_users_id"
	}),
	users: many(users, {
		relationName: "users_nicVerifiedBy_users_id"
	}),
}));

export const jobsRelations = relations(jobs, ({one, many}) => ({
	reports: many(reports),
	jobPhotos: many(jobPhotos),
	invites: many(invites),
	proposals: many(proposals),
	payments: many(payments),
	reviews: many(reviews),
	agentRuns: many(agentRuns),
	user_customerId: one(users, {
		fields: [jobs.customerId],
		references: [users.id],
		relationName: "jobs_customerId_users_id"
	}),
	category_categoryId: one(categories, {
		fields: [jobs.categoryId],
		references: [categories.id],
		relationName: "jobs_categoryId_categories_id"
	}),
	category_subcategoryId: one(categories, {
		fields: [jobs.subcategoryId],
		references: [categories.id],
		relationName: "jobs_subcategoryId_categories_id"
	}),
	user_assignedWorkerId: one(users, {
		fields: [jobs.assignedWorkerId],
		references: [users.id],
		relationName: "jobs_assignedWorkerId_users_id"
	}),
}));

export const jobPhotosRelations = relations(jobPhotos, ({one}) => ({
	job: one(jobs, {
		fields: [jobPhotos.jobId],
		references: [jobs.id]
	}),
}));

export const invitesRelations = relations(invites, ({one}) => ({
	job: one(jobs, {
		fields: [invites.jobId],
		references: [jobs.id]
	}),
	user_customerId: one(users, {
		fields: [invites.customerId],
		references: [users.id],
		relationName: "invites_customerId_users_id"
	}),
	user_workerId: one(users, {
		fields: [invites.workerId],
		references: [users.id],
		relationName: "invites_workerId_users_id"
	}),
}));

export const proposalsRelations = relations(proposals, ({one}) => ({
	job: one(jobs, {
		fields: [proposals.jobId],
		references: [jobs.id]
	}),
	user: one(users, {
		fields: [proposals.workerId],
		references: [users.id]
	}),
}));

export const paymentsRelations = relations(payments, ({one}) => ({
	user: one(users, {
		fields: [payments.recordedBy],
		references: [users.id]
	}),
	job: one(jobs, {
		fields: [payments.jobId],
		references: [jobs.id]
	}),
}));

export const reviewsRelations = relations(reviews, ({one}) => ({
	job: one(jobs, {
		fields: [reviews.jobId],
		references: [jobs.id]
	}),
	user_customerId: one(users, {
		fields: [reviews.customerId],
		references: [users.id],
		relationName: "reviews_customerId_users_id"
	}),
	user_workerId: one(users, {
		fields: [reviews.workerId],
		references: [users.id],
		relationName: "reviews_workerId_users_id"
	}),
}));

export const workerPortfolioPhotosRelations = relations(workerPortfolioPhotos, ({one}) => ({
	workerProfile: one(workerProfiles, {
		fields: [workerPortfolioPhotos.workerId],
		references: [workerProfiles.id]
	}),
}));

export const workerProfilesRelations = relations(workerProfiles, ({one, many}) => ({
	workerPortfolioPhotos: many(workerPortfolioPhotos),
	workerSkills: many(workerSkills),
	user: one(users, {
		fields: [workerProfiles.userId],
		references: [users.id]
	}),
}));

export const agentRunStepsRelations = relations(agentRunSteps, ({one}) => ({
	agentRun: one(agentRuns, {
		fields: [agentRunSteps.runId],
		references: [agentRuns.id]
	}),
}));

export const agentRunsRelations = relations(agentRuns, ({one, many}) => ({
	agentRunSteps: many(agentRunSteps),
	agentRecommendations: many(agentRecommendations),
	user: one(users, {
		fields: [agentRuns.userId],
		references: [users.id]
	}),
	job: one(jobs, {
		fields: [agentRuns.jobId],
		references: [jobs.id]
	}),
}));

export const agentRecommendationsRelations = relations(agentRecommendations, ({one}) => ({
	agentRun: one(agentRuns, {
		fields: [agentRecommendations.runId],
		references: [agentRuns.id]
	}),
}));

export const agentMemoriesRelations = relations(agentMemories, ({one}) => ({
	user: one(users, {
		fields: [agentMemories.userId],
		references: [users.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id]
	}),
}));

export const workerSkillsRelations = relations(workerSkills, ({one}) => ({
	workerProfile: one(workerProfiles, {
		fields: [workerSkills.workerId],
		references: [workerProfiles.id]
	}),
	category: one(categories, {
		fields: [workerSkills.categoryId],
		references: [categories.id]
	}),
}));
