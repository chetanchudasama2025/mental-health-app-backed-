import express, {Application} from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {createServer} from 'http';
import {errorHandler} from './middleware/errorHandler';
import {logger} from './middleware/logger';
import {routes} from './routes/index';
import {connectDatabase} from './config/database';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

const httpServer = createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.use(logger);

app.use('/api', routes);

app.get('/health', (_req: express.Request, res: express.Response) => {
    res.status(200).json({status: 'OK', message: 'Server is running'});
});

app.use(errorHandler);

const startServer = async (): Promise<void> => {
    try {
        await connectDatabase();

        // cronScheduler.start();
        // sessionReminderScheduler.start();

        httpServer.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app;

