import type { Job } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { ExpireLapsedCodesJob } from '../jobs/expire-lapsed-codes.job';
import { MaintenanceQueue } from './maintenance-queue';

const jobNamed = (name: string) => ({ name }) as Job;

describe('MaintenanceQueue.process', () => {
  it('hands the nightly expiry to its job', async () => {
    const run = vi.fn().mockResolvedValue({ tenants: 2 });
    const queue = new MaintenanceQueue({ run } as unknown as ExpireLapsedCodesJob);
    await expect(queue.process(jobNamed(ExpireLapsedCodesJob.NAME))).resolves.toEqual({
      tenants: 2,
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('fails a job it has no handler for, so it lands in the failed set', async () => {
    const queue = new MaintenanceQueue({ run: vi.fn() } as unknown as ExpireLapsedCodesJob);
    await expect(queue.process(jobNamed('generate-fees'))).rejects.toThrow(
      'No handler for job «generate-fees»',
    );
  });

  it('reports unhealthy before it has started', async () => {
    const queue = new MaintenanceQueue({ run: vi.fn() } as unknown as ExpireLapsedCodesJob);
    await expect(queue.healthy()).resolves.toBe(false);
  });
});
