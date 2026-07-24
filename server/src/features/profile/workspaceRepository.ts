import { z } from 'zod';

export const DurableProfileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1).max(120),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const WorkspaceDocumentSchema = z.object({
  profileId: z.string().min(1),
  revision: z.number().int().min(1),
  payload: z.unknown(),
  updatedAt: z.string().datetime(),
});

export type DurableProfile = z.infer<typeof DurableProfileSchema>;
export type WorkspaceDocument = z.infer<typeof WorkspaceDocumentSchema>;

export interface DurableWorkspaceRepository {
  load(profileId: string): Promise<WorkspaceDocument | null>;
  create(profileId: string, payload: unknown, now?: string): Promise<WorkspaceDocument>;
  save(profileId: string, expectedRevision: number, payload: unknown, now?: string): Promise<WorkspaceDocument>;
}

export class WorkspaceVersionConflictError extends Error {
  constructor(
    public readonly expectedRevision: number,
    public readonly actualRevision: number,
  ) {
    super(`Workspace revision conflict: expected ${expectedRevision}, found ${actualRevision}.`);
    this.name = 'WorkspaceVersionConflictError';
  }
}

export class WorkspaceAlreadyExistsError extends Error {
  constructor(profileId: string) {
    super(`A workspace already exists for profile ${profileId}.`);
    this.name = 'WorkspaceAlreadyExistsError';
  }
}

/**
 * Contract test adapter only. Production implementations must use durable,
 * authenticated storage and must never silently fall back to process memory.
 */
export class InMemoryDurableWorkspaceRepository implements DurableWorkspaceRepository {
  private readonly documents = new Map<string, WorkspaceDocument>();

  async load(profileId: string): Promise<WorkspaceDocument | null> {
    const document = this.documents.get(profileId);
    return document ? structuredClone(document) : null;
  }

  async create(profileId: string, payload: unknown, now = new Date().toISOString()): Promise<WorkspaceDocument> {
    if (this.documents.has(profileId)) throw new WorkspaceAlreadyExistsError(profileId);
    const document = WorkspaceDocumentSchema.parse({ profileId, revision: 1, payload, updatedAt: now });
    this.documents.set(profileId, structuredClone(document));
    return structuredClone(document);
  }

  async save(
    profileId: string,
    expectedRevision: number,
    payload: unknown,
    now = new Date().toISOString(),
  ): Promise<WorkspaceDocument> {
    const current = this.documents.get(profileId);
    if (!current) throw new WorkspaceVersionConflictError(expectedRevision, 0);
    if (current.revision !== expectedRevision) {
      throw new WorkspaceVersionConflictError(expectedRevision, current.revision);
    }
    const document = WorkspaceDocumentSchema.parse({
      profileId,
      revision: current.revision + 1,
      payload,
      updatedAt: now,
    });
    this.documents.set(profileId, structuredClone(document));
    return structuredClone(document);
  }
}
