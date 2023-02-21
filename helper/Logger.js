const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const logger = winston.createLogger({
    level: 'debug',
    maxsize: '500m',
    // format: winston.format.json(),
    transports: [
        // new winston.transports.File({ filename: './logs/ error.log' }),
        new DailyRotateFile({
            filename: './logs/%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            prepend: true,
            level: 'debug',
        })
    ],
});
module.exports = logger;