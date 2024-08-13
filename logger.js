const fs = require('fs');

class Logger {
    constructor(level = 'info', logFilePath = 'app.log') {
        this.levels = ['error', 'warn', 'info', 'debug'];
        this.level = level;
        this.logFilePath = logFilePath;
    }

    setLevel(level) {
        if (this.levels.includes(level)) {
            this.level = level;
        } else {
            console.warn(`Invalid log level: ${level}`);
        }
    }

    log(level, message) {
        if (this.levels.indexOf(level) <= this.levels.indexOf(this.level)) {
            const formattedMessage = this.formatMessage(level, message);
            console[level](formattedMessage);
            this.logToFile(formattedMessage);
        }
    }

    error(message) {
        this.log('error', message);
    }

    warn(message) {
        this.log('warn', message);
    }

    info(message) {
        this.log('info', message);
    }

    debug(message) {
        this.log('debug', message);
    }

    formatMessage(level, message) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    }

    logToFile(message) {
        fs.appendFile(this.logFilePath, message + '\n', (err) => {
            if (err) {
                console.error(`Failed to write to log file: ${err.message}`);
            }
        });
    }
}

module.exports = {
    Logger
}