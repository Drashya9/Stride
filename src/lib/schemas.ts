import { z } from "zod";
import { METRIC_NAMES, PRIORITIES, ROLES, STATUSES } from "./constants";

/** Zod schemas shared by route handlers (validation) and the client (types). */

const id = z.uuid();

export const CreateWorkspaceInput = z.object({
  name: z.string().trim().min(2).max(60),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,5}$/, "2–6 letters/digits, starting with a letter"),
});

export const CreateIssueInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20_000).default(""),
  status: z.enum(STATUSES).default("todo"),
  priority: z.enum(PRIORITIES).default("none"),
  assigneeId: z.string().min(1).nullable().default(null),
  labelIds: z.array(id).max(20).default([]),
});

export const UpdateIssueInput = z
  .object({
    baseVersion: z.number().int().positive(),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(20_000).optional(),
    priority: z.enum(PRIORITIES).optional(),
    assigneeId: z.string().min(1).nullable().optional(),
    labelIds: z.array(id).max(20).optional(),
  })
  .refine((v) => Object.keys(v).length > 1, "Nothing to update");

export const MoveIssueInput = z.object({
  baseVersion: z.number().int().positive(),
  status: z.enum(STATUSES),
  /** Issue that should end up directly above the moved one (same column). */
  afterId: id.nullable().optional(),
  /** Issue that should end up directly below the moved one (same column). */
  beforeId: id.nullable().optional(),
});

export const CreateCommentInput = z.object({
  body: z.string().trim().min(1).max(10_000),
});

export const CreateLabelInput = z.object({
  name: z.string().trim().min(1).max(30),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const CreateInviteInput = z.object({
  email: z.email().optional().or(z.literal("").transform(() => undefined)),
  role: z.enum(ROLES).default("member"),
});

export const AcceptInviteInput = z.object({
  token: z.string().min(20).max(200),
});

export const UpdateMemberInput = z.object({
  role: z.enum(ROLES),
});

export const LinkRepoInput = z.object({
  repoFullName: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/, "Use the owner/repo format"),
});

export const MetricsInput = z.object({
  metrics: z
    .array(
      z.object({
        name: z.enum(METRIC_NAMES),
        valueMs: z.number().min(0).max(600_000),
        tags: z.record(z.string(), z.string().max(60)).optional(),
      }),
    )
    .min(1)
    .max(50),
});

export type CreateIssueInput = z.input<typeof CreateIssueInput>;
export type UpdateIssueInput = z.input<typeof UpdateIssueInput>;
export type MoveIssueInput = z.input<typeof MoveIssueInput>;
