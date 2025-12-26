import cron from 'node-cron';
import backupService from './backupService';

class CronScheduler {
    private task: cron.ScheduledTask | null = null;

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
     * Start the cron job
     */
    public start(): void {
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
    public getScheduleInfo(): { frequency: string; schedule: string } {
        const frequency = process.env.BACKUP_FREQUENCY?.toLowerCase() || 'daily';
        return {
            frequency,
            schedule: this.getCronSchedule(),
        };
    }
}

export default new CronScheduler();

