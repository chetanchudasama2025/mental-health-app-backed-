import {NextFunction, Request, Response} from 'express';

export const logger = (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);

    const originalJson = res.json;
    res.json = function (body: any) {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;
        const statusColor = statusCode >= 500 ? '🔴' : statusCode >= 400 ? '🟡' : '🟢';

        console.log(`[${timestamp}] ${statusColor} ${req.method} ${req.originalUrl} - ${statusCode} - ${duration}ms`);

        return originalJson.call(this, body);
    };

    next();
};

