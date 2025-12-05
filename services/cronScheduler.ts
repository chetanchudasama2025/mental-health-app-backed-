import cron from 'node-cron';
import backupService from './backupService';

class CronScheduler {
  private task: cron.ScheduledTask | null = null;

  /**
   * Check if running on Vercel
   */
  private isVercelEnvironment(): boolean {
    return !!(
        process.env.VERCEL ||
        process.env.VERCEL_ENV ||
        process.env.VERCEL_URL ||
        process.env.USE_VERCEL_CRON === 'true'
    );
  }

  /**
   * Get cron schedule based on BACKUP_FREQUENCY
   */
  private getCronSchedule(): string {
    const frequency = process.env.BACKUP_FREQUENCY?.toLowerCase() || 'daily';

    switch (frequency) {
      case 'daily':
        return '11 17 * * *';

      case 'weekly':
        return '0 2 * * 0';

      case 'monthly':
        return '0 2 1 * *';

      default:
        console.warn(`Invalid BACKUP_FREQUENCY: ${frequency}. Defaulting to daily.`);
        return '0 2 * * *';
    }
  }

  /**
   * Get Vercel Cron schedule format
   * Vercel Cron uses a different format than standard cron
   */
  private getVercelCronSchedule(): string {
    const frequency = process.env.BACKUP_FREQUENCY?.toLowerCase() || 'daily';

    switch (frequency) {
      case 'daily':
        return '0 2 * * *';

      case 'weekly':
        return '0 2 * * 0';

      case 'monthly':
        return '0 2 1 * *';

      default:
        return '0 2 * * *';
    }
  }

  /**
   * Start the cron job
   * On Vercel, this will be skipped as Vercel Cron handles scheduling
   */
  public start(): void {
    if (this.isVercelEnvironment()) {
      console.log('Running on Vercel - using Vercel Cron instead of node-cron');
      console.log('Backup will be handled by Vercel Cron at:', this.getVercelCronSchedule());
      console.log('Make sure vercel.json is configured with the cron schedule');
      return;
    }

    const frequency = process.env.BACKUP_FREQUENCY?.toLowerCase() || 'daily';
    const schedule = this.getCronSchedule();

    if (this.task) {
      this.stop();
    }

    console.log(`Starting backup cron job with frequency: ${frequency}`);
    console.log(`Cron schedule: ${schedule}`);

    this.task = cron.schedule(schedule, async () => {
      try {
        await backupService.performBackup();
      } catch (error: any) {
        console.error('Cron job backup failed:', error.message);
      }
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'UTC',
    });

    console.log('Backup cron job started successfully');
  }

  /**
   * Stop the cron job
   */
  public stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('Backup cron job stopped');
    }
  }

  /**
   * Get the current schedule info
   */
  public getScheduleInfo(): { frequency: string; schedule: string; isVercel: boolean } {
    const frequency = process.env.BACKUP_FREQUENCY?.toLowerCase() || 'daily';
    const isVercel = this.isVercelEnvironment();
    
    return {
      frequency,
      schedule: isVercel ? this.getVercelCronSchedule() : this.getCronSchedule(),
      isVercel,
    };
  }
}

export default new CronScheduler();

