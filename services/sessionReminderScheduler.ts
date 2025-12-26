import cron from 'node-cron';
import {processSessionReminders} from './sessionReminderService';

class SessionReminderScheduler {
    private task: cron.ScheduledTask | null = null;

    public start(): void {
        if (this.task) {
            this.stop();
        }

        const schedule = '* * * * *';

        console.log('Starting session reminder cron job');
        console.log(`Cron schedule: ${schedule} (every 1 minute)`);

        this.task = cron.schedule(
            schedule,
            async () => {
                try {
                    console.log(`[${new Date().toISOString()}] Running session reminder check...`);
                    await processSessionReminders();
                } catch (error: any) {
                    console.error('Session reminder cron job failed:', error.message);
                }
            },
            {
                scheduled: true,
                timezone: process.env.TZ || 'UTC',
            }
        );

        console.log('Session reminder cron job started successfully');

        setTimeout(async () => {
            try {
                console.log('Running initial session reminder check...');
                await processSessionReminders();
            } catch (error: any) {
                console.error('Initial session reminder check failed:', error.message);
            }
        }, 10000);
    }

    public stop(): void {
        if (this.task) {
            this.task.stop();
            this.task = null;
            console.log('Session reminder cron job stopped');
        }
    }

    public getScheduleInfo(): { schedule: string; description: string } {
        return {
            schedule: '* * * * *',
            description: 'Every 1 minute',
        };
    }
}

export default new SessionReminderScheduler();

