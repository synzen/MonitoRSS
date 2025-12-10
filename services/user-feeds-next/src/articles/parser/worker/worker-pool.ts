/**
 * Generic worker pool implementation using Bun's native Worker API.
 * Manages a pool of workers with automatic scaling and task queuing.
 */

import type { WorkerTaskMessage, WorkerResponse } from "./types";

export interface WorkerPoolOptions {
  /** Path to worker file */
  workerPath: string;
  /** Minimum workers to keep running (default: 1) */
  minWorkers?: number;
  /** Maximum workers to spawn (default: CPU count) */
  maxWorkers?: number;
  /** Kill idle workers after this time in ms (default: 30000) */
  idleTimeoutMs?: number;
}

interface PendingTask<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

interface WorkerInfo {
  worker: Worker;
  busy: boolean;
  lastUsed: number;
}

export class WorkerPool<TPayload, TResult> {
  private workers: WorkerInfo[] = [];
  private pendingTasks: Map<string, PendingTask<TResult>> = new Map();
  private taskQueue: Array<{
    id: string;
    payload: TPayload;
    taskTimeoutMs?: number;
  }> = [];
  private taskIdCounter = 0;
  private readonly options: Required<WorkerPoolOptions>;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: WorkerPoolOptions) {
    const cpuCount =
      typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 4;

    this.options = {
      minWorkers: options.minWorkers ?? 1,
      maxWorkers: options.maxWorkers ?? cpuCount ?? 4,
      idleTimeoutMs: options.idleTimeoutMs ?? 30000,
      workerPath: options.workerPath,
    };

    // Create minimum workers on startup
    for (let i = 0; i < this.options.minWorkers; i++) {
      this.createWorker();
    }

    // Start cleanup interval for idle workers
    this.cleanupInterval = setInterval(() => this.cleanupIdleWorkers(), 10000);
  }

  private createWorker(): WorkerInfo {
    const worker = new Worker(this.options.workerPath);
    const info: WorkerInfo = {
      worker,
      busy: false,
      lastUsed: Date.now(),
    };

    worker.onmessage = (event: MessageEvent<WorkerResponse<TResult>>) => {
      this.handleWorkerMessage(info, event.data);
    };

    worker.onerror = (event) => {
      // Handle worker errors - reject any pending task
      this.handleWorkerError(info, new Error(event.message));
    };

    this.workers.push(info);
    return info;
  }

  private handleWorkerMessage(
    workerInfo: WorkerInfo,
    response: WorkerResponse<TResult>
  ): void {
    const pending = this.pendingTasks.get(response.id);
    if (!pending) return;

    // Clear timeout
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }
    this.pendingTasks.delete(response.id);

    // Mark worker as available
    workerInfo.busy = false;
    workerInfo.lastUsed = Date.now();

    // Resolve or reject
    if (response.success) {
      pending.resolve(response.data);
    } else {
      const error = new Error(response.error.message);
      error.name = response.error.name;
      // Attach feedText for InvalidFeedException
      if (response.error.feedText) {
        (error as Error & { feedText?: string }).feedText =
          response.error.feedText;
      }
      pending.reject(error);
    }

    // Process next queued task
    this.processQueue();
  }

  private handleWorkerError(workerInfo: WorkerInfo, error: Error): void {
    // Find any pending task for this worker and reject it
    // Since we don't track which task belongs to which worker in the pending map,
    // we rely on timeouts to handle stuck tasks

    // Terminate the problematic worker
    workerInfo.worker.terminate();
    const index = this.workers.indexOf(workerInfo);
    if (index !== -1) {
      this.workers.splice(index, 1);
    }

    // Ensure we maintain minimum workers
    while (this.workers.length < this.options.minWorkers) {
      this.createWorker();
    }
  }

  private cleanupIdleWorkers(): void {
    const now = Date.now();
    const idleWorkers = this.workers.filter(
      (w) => !w.busy && now - w.lastUsed > this.options.idleTimeoutMs
    );

    // Keep at least minWorkers
    const toRemove = Math.min(
      idleWorkers.length,
      this.workers.length - this.options.minWorkers
    );

    for (let i = 0; i < toRemove; i++) {
      const worker = idleWorkers[i]!;
      worker.worker.terminate();
      const index = this.workers.indexOf(worker);
      if (index !== -1) {
        this.workers.splice(index, 1);
      }
    }
  }

  private getAvailableWorker(): WorkerInfo | null {
    return this.workers.find((w) => !w.busy) || null;
  }

  private processQueue(): void {
    if (this.taskQueue.length === 0) return;

    let worker = this.getAvailableWorker();

    // Scale up if needed and allowed
    if (!worker && this.workers.length < this.options.maxWorkers) {
      worker = this.createWorker();
    }

    if (!worker) return;

    const task = this.taskQueue.shift();
    if (!task) return;

    this.executeTask(worker, task.id, task.payload);
  }

  private executeTask(
    workerInfo: WorkerInfo,
    id: string,
    payload: TPayload
  ): void {
    workerInfo.busy = true;

    const message: WorkerTaskMessage<TPayload> = {
      id,
      type: "task",
      payload,
    };

    workerInfo.worker.postMessage(message);
  }

  /**
   * Execute a task in the worker pool.
   * Returns a promise that resolves with the result or rejects with an error.
   */
  async exec(
    payload: TPayload,
    options?: { timeout?: number }
  ): Promise<TResult> {
    const id = `task-${++this.taskIdCounter}`;

    return new Promise<TResult>((resolve, reject) => {
      // Set up timeout if specified
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      if (options?.timeout) {
        timeoutId = setTimeout(() => {
          this.pendingTasks.delete(id);
          reject(new Error(`Task timed out after ${options.timeout}ms`));
        }, options.timeout);
      }

      this.pendingTasks.set(id, { resolve, reject, timeoutId });

      // Try to execute immediately or queue
      const worker = this.getAvailableWorker();
      if (worker) {
        this.executeTask(worker, id, payload);
      } else if (this.workers.length < this.options.maxWorkers) {
        const newWorker = this.createWorker();
        this.executeTask(newWorker, id, payload);
      } else {
        // Queue the task
        this.taskQueue.push({ id, payload, taskTimeoutMs: options?.timeout });
      }
    });
  }

  /**
   * Terminate all workers and clean up resources.
   */
  async terminate(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Reject all pending tasks
    for (const [, pending] of this.pendingTasks) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      pending.reject(new Error("Worker pool terminated"));
    }
    this.pendingTasks.clear();

    // Terminate all workers
    for (const workerInfo of this.workers) {
      workerInfo.worker.terminate();
    }
    this.workers = [];
    this.taskQueue = [];
  }

  /**
   * Get pool statistics.
   */
  stats(): {
    totalWorkers: number;
    busyWorkers: number;
    queuedTasks: number;
    pendingTasks: number;
  } {
    return {
      totalWorkers: this.workers.length,
      busyWorkers: this.workers.filter((w) => w.busy).length,
      queuedTasks: this.taskQueue.length,
      pendingTasks: this.pendingTasks.size,
    };
  }
}
