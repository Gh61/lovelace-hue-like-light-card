/* eslint no-console: 0 */
import { Consts } from '../types/consts';
import { Func } from '../types/functions';
import logging from '../logging.json';

export enum LogLevel {
    Trace = 'trace',
    Debug = 'debug',
    Info = 'info',
    Warn = 'warn',
    Error = 'error',
    Off = 'off'
}

export interface LoggingConfig {
    readonly default: string;
    readonly categories: Record<string, string>;
}

export type LogMessage = string | Func<string>;

export class ConsoleLogger {
    private static readonly DefaultConfig: LoggingConfig = Consts.Dev ? logging.dev : logging.prod;
    private static readonly SeverityOrder = [LogLevel.Trace, LogLevel.Debug, LogLevel.Info, LogLevel.Warn, LogLevel.Error, LogLevel.Off];
    private static readonly CategorySeparator = '.';

    private readonly _category: string;
    private readonly _config: LoggingConfig;
    private readonly _minLevel: LogLevel;

    public constructor(category: string, config = ConsoleLogger.DefaultConfig) {
        this._category = category;
        this._config = config;
        this._minLevel = ConsoleLogger.resolveLevel(category, config);
    }

    public subCategory(name: string): ConsoleLogger {
        return new ConsoleLogger(this._category + ConsoleLogger.CategorySeparator + name, this._config);
    }

    public isEnabled(level: LogLevel): boolean {
        return ConsoleLogger.SeverityOrder.indexOf(level) >= ConsoleLogger.SeverityOrder.indexOf(this._minLevel);
    }

    public trace(message: LogMessage, ...data: unknown[]) {
        this.log(LogLevel.Trace, message, data);
    }

    public debug(message: LogMessage, ...data: unknown[]) {
        this.log(LogLevel.Debug, message, data);
    }

    public info(message: LogMessage, ...data: unknown[]) {
        this.log(LogLevel.Info, message, data);
    }

    public warn(message: LogMessage, ...data: unknown[]) {
        this.log(LogLevel.Warn, message, data);
    }

    public error(message: LogMessage, ...data: unknown[]) {
        this.log(LogLevel.Error, message, data);
    }

    private log(level: LogLevel, message: LogMessage, data: unknown[]) {
        if (!this.isEnabled(level))
            return;

        const text = typeof message === 'function' ? message() : message;
        ConsoleLogger.writeToConsole(level, `[${this._category}] ${text}`, data);
    }

    private static writeToConsole(level: LogLevel, text: string, data: unknown[]) {
        switch (level) {
            case LogLevel.Error:
                console.error(text, ...data);
                break;
            case LogLevel.Warn:
                console.warn(text, ...data);
                break;
            default:
                console.info(text, ...data);
                break;
        }
    }

    private static resolveLevel(category: string, config: LoggingConfig): LogLevel {
        let current = category;
        while (current) {
            const level = config.categories[current];
            if (level != null)
                return ConsoleLogger.parseLevel(level, current);

            current = ConsoleLogger.getParentCategory(current);
        }

        return ConsoleLogger.parseLevel(config.default, 'default');
    }

    private static getParentCategory(category: string): string {
        const separatorIndex = category.lastIndexOf(ConsoleLogger.CategorySeparator);
        return separatorIndex > 0 ? category.substring(0, separatorIndex) : '';
    }

    private static parseLevel(plain: string, category: string): LogLevel {
        const levels = Object.values(LogLevel) as string[];
        if (levels.includes(plain))
            return plain as LogLevel;

        throw new Error(`Log level '${plain}' of category '${category}' was not recognized. Allowed values are: ${levels.join(', ')}`);
    }
}
