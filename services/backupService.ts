import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { dbConfig } from '../config/database';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const execAsync = promisify(exec);

class BackupService {
  private oauth2Client: any;
  private drive: any;
  private googleDriveFolderId?: string;

  constructor() {
    this.googleDriveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    this.initializeGoogleDrive();
  }

  private initializeGoogleDrive(): void {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URL || 'urn:ietf:wg:oauth:2.0:oob';
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      console.warn('Google Drive credentials not configured. Backups require Google Drive configuration.');
      return;
    }

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Extract database name from MongoDB connection string
   */
  private getDatabaseName(): string {
    const mongoUrl = dbConfig.mongoUrl;
    if (mongoUrl) {
      const match = mongoUrl.match(/\/([^/?]+)(\?|$)/);
      if (match) {
        return match[1];
      }
    }
    if (mongoose.connection.db) {
      return mongoose.connection.db.databaseName;
    }
    return 'mental-health-app';
  }

  /**
   * Create MongoDB backup using mongodump and return as buffer
   */
  private async createMongoBackup(): Promise<{ buffer: Buffer; fileName: string }> {
    const dbName = this.getDatabaseName();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-${dbName}-${timestamp}.gz`;

    try {
      try {
        await execAsync('mongodump --version');
      } catch (error) {
        throw new Error('mongodump is not installed. Please install MongoDB Database Tools.');
      }

      const mongoUrl = dbConfig.mongoUrl;
      if (!mongoUrl) {
        throw new Error('MongoDB connection URL is not configured');
      }

      console.log('Creating MongoDB backup...');

      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const mongodump = spawn('mongodump', [
          '--uri', mongoUrl,
          '--archive',
          '--gzip'
        ], {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        mongodump.stdout?.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        mongodump.stderr?.on('data', (data: Buffer) => {
          const message = data.toString();
          if (!message.includes('writing')) {
            console.warn('Backup warning:', message);
          }
        });

        mongodump.on('error', (error: Error) => {
          reject(new Error(`mongodump process error: ${error.message}`));
        });

        mongodump.on('close', (code: number) => {
          if (code !== 0) {
            reject(new Error(`mongodump process exited with code ${code}`));
            return;
          }
          const buffer = Buffer.concat(chunks);
          console.log(`Backup created successfully in memory (${buffer.length} bytes)`);
          resolve({ buffer, fileName: backupFileName });
        });
      });
    } catch (error: any) {
      console.error('Error creating backup:', error.message);
      throw error;
    }
  }

  /**
   * Alternative backup method using mongoose (if mongodump is not available)
   */
  private async createMongooseBackup(): Promise<{ buffer: Buffer; fileName: string }> {
    const dbName = this.getDatabaseName();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-${dbName}-${timestamp}.json`;

    try {
      const db = mongoose.connection.db;
      if (!db) {
        throw new Error('Database connection not available');
      }

      const collections = await db.listCollections().toArray();
      const backupData: any = {};

      console.log('Creating MongoDB backup using Mongoose...');

      for (const collection of collections) {
        const collectionName = collection.name;
        if (collectionName.startsWith('system.')) {
          continue;
        }

        const data = await db.collection(collectionName).find({}).toArray();
        backupData[collectionName] = data;
        console.log(`Backed up collection: ${collectionName} (${data.length} documents)`);
      }

      const jsonString = JSON.stringify(backupData, null, 2);
      const buffer = Buffer.from(jsonString, 'utf-8');
      console.log(`Backup created successfully in memory (${buffer.length} bytes)`);
      return { buffer, fileName: backupFileName };
    } catch (error: any) {
      console.error('Error creating backup:', error.message);
      throw error;
    }
  }

  /**
   * Find and delete old backup from Google Drive
   */
  private async deleteOldGoogleDriveBackup(): Promise<void> {
    if (!this.drive || !this.googleDriveFolderId) {
      return;
    }

    try {
      const dbName = this.getDatabaseName();

      const response = await this.drive.files.list({
        q: `'${this.googleDriveFolderId}' in parents and name contains 'backup-${dbName}' and trashed=false`,
        fields: 'files(id, name, createdTime)',
        orderBy: 'createdTime desc',
      });

      const files = response.data.files || [];

      for (const file of files) {
        await this.drive.files.delete({
          fileId: file.id!,
        });
        console.log(`Deleted old Google Drive backup: ${file.name}`);
      }
    } catch (error: any) {
      console.error('Error deleting old Google Drive backup:', error.message);
    }
  }

  /**
   * Upload backup buffer to Google Drive
   */
  private async uploadToGoogleDrive(buffer: Buffer, fileName: string): Promise<void> {
    if (!this.drive) {
      throw new Error('Google Drive not configured. Cannot save backup.');
    }

    if (!this.googleDriveFolderId) {
      throw new Error('Google Drive folder ID not configured. Cannot save backup.');
    }

    try {
      const fileMetadata = {
        name: fileName,
        parents: [this.googleDriveFolderId!],
      };

      const stream = Readable.from(buffer);
      const media = {
        mimeType: fileName.endsWith('.gz') ? 'application/gzip' : 'application/json',
        body: stream,
      };

      console.log('Uploading backup to Google Drive...');
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name',
      });

      console.log(`Backup uploaded to Google Drive: ${response.data.name} (ID: ${response.data.id})`);
    } catch (error: any) {
      console.error('Error uploading to Google Drive:', error.message);
      throw error;
    }
  }

  /**
   * Main backup function
   */
  public async performBackup(): Promise<void> {
    try {
      console.log('=== Starting Database Backup ===');
      console.log(`Time: ${new Date().toISOString()}`);

      if (!this.drive) {
        throw new Error('Google Drive not configured. Backups must be saved to Google Drive.');
      }

      await this.deleteOldGoogleDriveBackup();

      let backupData: { buffer: Buffer; fileName: string };
      try {
        backupData = await this.createMongoBackup();
      } catch (error: any) {
        console.log('mongodump not available, using Mongoose backup method...');
        backupData = await this.createMongooseBackup();
      }

      await this.uploadToGoogleDrive(backupData.buffer, backupData.fileName);

      console.log('=== Backup Completed Successfully ===');
    } catch (error: any) {
      console.error('=== Backup Failed ===');
      console.error('Error:', error.message);
      throw error;
    }
  }
}

export default new BackupService();

