import type { InferSelectModel } from 'drizzle-orm';
import { agentRuns, payments, users } from './schema.js';

type User = InferSelectModel<typeof users>;
type Payment = InferSelectModel<typeof payments>;
type AgentRun = InferSelectModel<typeof agentRuns>;

// These assignments deliberately fail typechecking if the generated contract
// stops representing PostgreSQL UUID, NUMERIC, TIMESTAMPTZ, JSONB, or nullable
// columns as the application persistence boundary expects.
declare const user: User;
declare const payment: Payment;
declare const agentRun: AgentRun;

const uuid: string = user.id;
const nullablePhone: string | null = user.phone;
const monetaryAmount: string = payment.amount;
const nullableRecordedAt: Date | null = payment.createdAt;
const jsonPayload: unknown = agentRun.planJson;

void uuid;
void nullablePhone;
void monetaryAmount;
void nullableRecordedAt;
void jsonPayload;
