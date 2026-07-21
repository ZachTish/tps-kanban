type SettingsRecord = Record<string, unknown>;

interface PersistenceRequest<TSettings extends object> {
  snapshot: TSettings;
  changedKeys: Set<string>;
  waiters: Array<{
    resolve: () => void;
    reject: (error: unknown) => void;
  }>;
}

export interface SettingsPersistenceOptions<TSettings extends object> {
  loadLatest: () => Promise<unknown>;
  saveMerged: (settings: SettingsRecord) => Promise<void>;
  normalize: (stored: SettingsRecord) => TSettings;
  onPersisted?: (requested: TSettings, persisted: TSettings) => void;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function changedTopLevelKeys<TSettings extends object>(
  previous: TSettings,
  next: TSettings,
): Set<string> {
  const previousRecord = previous as SettingsRecord;
  const nextRecord = next as SettingsRecord;
  const keys = new Set([...Object.keys(previousRecord), ...Object.keys(nextRecord)]);
  return new Set([...keys].filter((key) => !valuesEqual(previousRecord[key], nextRecord[key])));
}

function requireSettingsRecord(value: unknown): SettingsRecord {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('TPS Kanban settings data must be an object');
  }
  return cloneValue(value as SettingsRecord);
}

/**
 * Serializes settings writes without treating the plugin's in-memory snapshot as
 * authoritative for keys changed by another device. Local intent is derived from
 * consecutive locally observed snapshots; each actual write merges only those
 * keys into a freshly loaded raw data object.
 */
export class SettingsPersistenceCoordinator<TSettings extends object> {
  private baseline: TSettings;
  private observed: TSettings;
  private active: PersistenceRequest<TSettings> | null = null;
  private pending: PersistenceRequest<TSettings> | null = null;
  private retryKeys = new Set<string>();
  private drainPromise: Promise<void> | null = null;

  constructor(
    private readonly options: SettingsPersistenceOptions<TSettings>,
    initialBaseline: TSettings,
  ) {
    this.baseline = cloneValue(initialBaseline);
    this.observed = cloneValue(initialBaseline);
  }

  setBaseline(settings: TSettings): void {
    this.baseline = cloneValue(settings);
    this.observed = cloneValue(settings);
    this.retryKeys.clear();
  }

  request(settings: TSettings): Promise<void> {
    const snapshot = cloneValue(settings);
    const changedKeys = changedTopLevelKeys(this.observed, snapshot);
    for (const key of this.retryKeys) changedKeys.add(key);
    this.retryKeys.clear();
    this.observed = cloneValue(snapshot);

    return new Promise<void>((resolve, reject) => {
      const waiter = { resolve, reject };

      if (changedKeys.size === 0) {
        if (this.pending) {
          this.pending.waiters.push(waiter);
        } else if (this.active) {
          this.active.waiters.push(waiter);
        } else {
          resolve();
        }
        return;
      }

      if (this.pending) {
        this.pending.snapshot = snapshot;
        for (const key of changedKeys) this.pending.changedKeys.add(key);
        this.pending.waiters.push(waiter);
      } else {
        this.pending = {
          snapshot,
          changedKeys,
          waiters: [waiter],
        };
      }

      this.ensureDrain();
    });
  }

  private ensureDrain(): void {
    if (this.drainPromise) return;
    this.drainPromise = this.drain().finally(() => {
      this.drainPromise = null;
      // A request can arrive after drain() observes an empty queue but before
      // this completion handler runs. Restarting here closes that window.
      if (this.pending) this.ensureDrain();
    });
  }

  private async drain(): Promise<void> {
    while (this.pending) {
      const request = this.pending;
      this.pending = null;
      this.active = request;

      try {
        const latestRaw = requireSettingsRecord(await this.options.loadLatest());
        const mergedRaw = cloneValue(latestRaw);
        const requestedRecord = request.snapshot as SettingsRecord;

        for (const key of request.changedKeys) {
          if (Object.prototype.hasOwnProperty.call(requestedRecord, key)) {
            mergedRaw[key] = cloneValue(requestedRecord[key]);
          } else {
            delete mergedRaw[key];
          }
        }

        await this.options.saveMerged(mergedRaw);
        const persisted = this.options.normalize(mergedRaw);
        this.reconcileObserved(request.snapshot, persisted);
        this.baseline = cloneValue(persisted);
        this.options.onPersisted?.(request.snapshot, persisted);
        for (const waiter of request.waiters) waiter.resolve();
      } catch (error) {
        const pending = this.pending as PersistenceRequest<TSettings> | null;
        if (pending) {
          // The newest snapshot supersedes the failed attempt. It must carry
          // both its own changes and every still-unsaved key from that attempt.
          for (const key of request.changedKeys) pending.changedKeys.add(key);
          pending.waiters.unshift(...request.waiters);
        } else {
          for (const key of request.changedKeys) this.retryKeys.add(key);
          for (const waiter of request.waiters) waiter.reject(error);
        }
      } finally {
        this.active = null;
      }
    }
  }

  private reconcileObserved(requested: TSettings, persisted: TSettings): void {
    const observedRecord = this.observed as SettingsRecord;
    const requestedRecord = requested as SettingsRecord;
    const persistedRecord = persisted as SettingsRecord;

    for (const key of Object.keys(persistedRecord)) {
      if (valuesEqual(observedRecord[key], requestedRecord[key])) {
        observedRecord[key] = cloneValue(persistedRecord[key]);
      }
    }
  }
}
