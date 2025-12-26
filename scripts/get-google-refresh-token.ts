import {google} from 'googleapis';
import * as readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function question(query: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(query, resolve);
    });
}

async function getRefreshToken() {
    console.log('=== Google Drive Refresh Token Generator ===\n');

    let clientId = process.env.GOOGLE_CLIENT_ID;
    let clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId) {
        clientId = await question('Enter your Google Client ID: ');
    } else {
        console.log(`Using Client ID from .env: ${clientId.substring(0, 20)}...`);
    }

    if (!clientSecret) {
        clientSecret = await question('Enter your Google Client Secret: ');
    } else {
        console.log(`Using Client Secret from .env: ${clientSecret.substring(0, 10)}...`);
    }

    const redirectUri = process.env.GOOGLE_REDIRECT_URL || 'urn:ietf:wg:oauth:2.0:oob';

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
    );

    const scopes = ['https://www.googleapis.com/auth/drive.file'];

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent',
    });

    console.log('\n=== Step 1: Authorize the Application ===');
    console.log('\nPlease visit this URL to authorize the application:');
    console.log('\n' + authUrl + '\n');
    console.log('After authorizing, you will be redirected or shown a code.');
    console.log('Copy that code and paste it below.\n');

    const code = await question('Enter the authorization code: ');

    try {
        const {tokens} = await oauth2Client.getToken(code);

        console.log('\n=== Success! ===\n');
        console.log('Add these to your .env file:\n');
        console.log(`GOOGLE_CLIENT_ID=${clientId}`);
        console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log(`GOOGLE_REDIRECT_URL=${redirectUri}`);

        if (tokens.access_token) {
            console.log(`\nAccess Token (temporary): ${tokens.access_token.substring(0, 20)}...`);
        }

        console.log('\n=== Important Notes ===');
        console.log('- The refresh token does not expire unless revoked');
        console.log('- Keep your refresh token secure and never commit it to version control');
        console.log('- If you lose the refresh token, you will need to generate a new one\n');

        rl.close();
    } catch (error: any) {
        console.error('\n=== Error ===');
        console.error('Failed to get refresh token:', error.message);
        console.error('\nCommon issues:');
        console.error('1. The authorization code may have expired (codes expire quickly)');
        console.error('2. The code may have been used already');
        console.error('3. Check that your Client ID and Secret are correct');
        console.error('4. Make sure you selected the correct OAuth consent screen user type\n');
        rl.close();
        process.exit(1);
    }
}

getRefreshToken().catch((error) => {
    console.error('Unexpected error:', error);
    rl.close();
    process.exit(1);
});

