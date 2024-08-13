require('dotenv').config()
const { TokenTransactionParser } = require("./TokenTransactionParser.js")
const { Logger } = require('./logger.js')
const path = require('path');
const { MySQLClient } = require('./MySQLClient.js')
const { TokenMonitor } = require('./TokenMonitor.js')

// Example usage
const main = async () => {
    const logger = new Logger('debug', path.join(__dirname, 'app.log'));
    const dbConfig = {
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USERNAME,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    };

    const dbClient = new MySQLClient(dbConfig, logger);
        
    const parser = new TokenTransactionParser(logger, dbClient);
    const monitor = new TokenMonitor(process.env.REFRESH_RATE, logger, dbClient);

    await monitor.initSDKs()

    try {
        /* The code snippet `await dbClient.connect(); await dbClient.checkAndCreateTable(); const
        parser = new TokenTransactionParser(logger, dbClient);` is performing the following actions: */
        await dbClient.connect();
        await dbClient.checkAndCreateTable();

            
        // Start monitoring for trading...
        monitor.start(logger, dbClient); // Starts the timer
    
        // parser.initializeWebSocket();
    } catch (err) {
        logger.error(err);
        monitor.stop()
    }
};

main()