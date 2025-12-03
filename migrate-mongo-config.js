const mongoUrl = 'mongodb://localhost:27017/mental-health-app' || process.env.MONGO_URL;
const urlMatch = mongoUrl.match(/\/([^/?]+)(\?|$)/);
const defaultDbName = urlMatch ? urlMatch[1] : 'mental-health-app';

const config = {
    mongodb: {
        url: mongoUrl,
        databaseName: process.env.DB_NAME || defaultDbName,
        options: {
        }
    },

    migrationsDir: "migrations",
    changelogCollectionName: "changelog",
    migrationFileExtension: ".js",
    useFileHash: false
};

module.exports = config;

