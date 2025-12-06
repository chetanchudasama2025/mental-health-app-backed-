import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './middleware/logger';
import { routes } from './routes/index';
import { connectDatabase } from './config/database';

dotenv.config();                              

const app: Application = express();
const PORT = process.env.PORT || 3000;

const httpServer = createServer(app);

connectDatabase();

// cronScheduler.start();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(logger);

app.use('/api', routes);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

app.use(errorHandler);

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;

