import {connectDatabase} from '../../config/database';
import backupService from '../../services/backupService';

/**
 * Type definitions for Vercel serverless functions
 */
interface VercelRequest {
    method?: string;
    headers: {
        [key: string]: string | string[] | undefined;
    };
    body?: any;
}

interface VercelResponse {
    status: (code: number) => VercelResponse;
    json: (data: any) => void;
    send: (data: any) => void;
}

/**
 * Vercel Cron Job Endpoint for Database Backups
 *
 * This endpoint is called by Vercel Cron according to the schedule
 * defined in vercel.json. It performs the database backup operation.
 *
 * Security: Vercel automatically adds a 'x-vercel-signature' header
 * to verify the request is from Vercel Cron. You can add additional
 * authentication if needed.
 *
 * Note: For better TypeScript support, install @vercel/node:
 * npm install --save-dev @vercel/node
 * Then you can use: import type { VercelRequest, VercelResponse } from '@vercel/node';
 */
export default async function handler(
    req: VercelRequest,
    res: VercelResponse
): Promise<void> {
    if (req.method && req.method !== 'GET' && req.method !== 'POST') {
        res.status(405).json({error: 'Method not allowed. Use GET or POST.'});
        return;
    }

    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        res.status(401).json({error: 'Unauthorized'});
        return;
    }

    try {
        console.log('=== Vercel Cron: Starting Backup ===');
        console.log(`Time: ${new Date().toISOString()}`);

        await connectDatabase();

        await backupService.performBackup();

        console.log('=== Vercel Cron: Backup Completed Successfully ===');

        res.status(200).json({
            success: true,
            message: 'Backup completed successfully',
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('=== Vercel Cron: Backup Failed ===');
        console.error('Error:', error.message);

        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
}

