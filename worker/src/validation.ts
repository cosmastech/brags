import { z } from 'zod';

export const DIMENSIONS = [
  'scope',
  'ownership',
  'ambiguity',
  'perseverance',
  'conflict-resolution',
  'growth',
  'communication',
  'leadership',
] as const;

export const STATES = ['inbox', 'active', 'archived', 'merged'] as const;

const visibility = z.enum(['private', 'work_internal', 'public']);
const confidence = z.enum(['low', 'medium', 'high']);
const dimension = z.enum(DIMENSIONS);
const slug = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'id must be a lowercase slug (letters, digits, dashes)');
const isodate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

// `quote` from RECORD_SCHEMA.md is intentionally absent: the warehouse stores
// distilled facts and links, never raw source content.
export const EvidenceInput = z.object({
  type: z.string().min(1).max(100),
  url: z.string().max(2000).optional(),
  title: z.string().max(500).optional(),
  visibility: visibility.optional(),
  note: z.string().max(2000).optional(),
});

export const BehavioralInput = z.object({
  signal: z.string().min(1).max(100),
  supports: z.array(dimension).max(8).default([]),
  basis: z.string().min(1).max(2000),
  confidence,
});

export const BragInput = z
  .object({
    id: slug,
    date: isodate,
    source: z.string().min(1).max(100),
    source_url: z.string().max(2000).optional(),
    title: z.string().min(1).max(500),
    summary: z.string().min(1).max(5000),
    project: z.string().max(200).optional(),
    role: z.string().max(2000).optional(),
    impact: z.string().max(2000).optional(),
    tags: z.array(z.string().max(100)).max(50).default([]),
    people: z.array(z.string().max(100)).max(50).default([]),
    visibility,
    public_safe: z.boolean(),
    confidence: confidence.default('medium'),
    needs_review: z.boolean().default(false),
    notes: z.string().max(5000).optional(),
    state: z.enum(['inbox', 'active']).default('inbox'),
    evidence: z.array(EvidenceInput).max(50).default([]),
    behavioral_evidence: z.array(BehavioralInput).max(20).default([]),
    created_at: z.string().max(40).optional(),
    updated_at: z.string().max(40).optional(),
  })
  .refine((b) => b.visibility !== 'public' || b.public_safe, {
    message: 'visibility=public requires public_safe=true',
  });

// Patch semantics: absent field = leave unchanged, null = clear the column.
export const BragPatch = z
  .object({
    date: isodate,
    source: z.string().min(1).max(100),
    source_url: z.string().max(2000).nullable(),
    title: z.string().min(1).max(500),
    summary: z.string().min(1).max(5000),
    project: z.string().max(200).nullable(),
    role: z.string().max(2000).nullable(),
    impact: z.string().max(2000).nullable(),
    tags: z.array(z.string().max(100)).max(50),
    people: z.array(z.string().max(100)).max(50),
    visibility,
    public_safe: z.boolean(),
    confidence,
    needs_review: z.boolean(),
    notes: z.string().max(5000).nullable(),
  })
  .partial();

export const StoryInput = z.object({
  id: slug,
  title: z.string().min(1).max(500),
  date: isodate,
  status: z.enum(['draft', 'ready']).default('draft'),
  dimensions: z.array(dimension).max(8).default([]),
  behaviors: z.array(z.string().max(100)).max(20).default([]),
  body_md: z.string().max(50000).default(''),
  last_reviewed_at: z.string().max(40).optional(),
  source_brag_ids: z.array(slug).max(50).default([]),
  created_at: z.string().max(40).optional(),
  updated_at: z.string().max(40).optional(),
});

export const StoryPatch = StoryInput.omit({ id: true, created_at: true, updated_at: true }).partial();

export const MergeInput = z.object({
  canonical_id: slug,
  other_ids: z.array(slug).min(1).max(50),
  reason: z.string().max(2000).optional(),
});

export const ArchiveInput = z.object({ reason: z.string().min(1).max(2000) });

export const QueryInput = z.object({ sql: z.string().min(1).max(10000) });

export type BragIn = z.infer<typeof BragInput>;
export type BragPatchIn = z.infer<typeof BragPatch>;
export type StoryIn = z.infer<typeof StoryInput>;
export type StoryPatchIn = z.infer<typeof StoryPatch>;
