import { ConsoleLogger, LoggingConfig, LogLevel } from '../src/core/console-logger';
import logging from '../src/logging.json';

const config: LoggingConfig = {
    default: 'warn',
    categories: {
        'HueNotify': 'debug',
        'HueNotify.Hass': 'off',
        'Verbose': 'trace'
    }
};

describe('ConsoleLogger', () => {
    let infoSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        infoSpy = jest.spyOn(console, 'info').mockImplementation();
        warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        errorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should use the default level for an unknown category', () => {
        const log = new ConsoleLogger('Unknown', config);

        expect(log.isEnabled(LogLevel.Info)).toBe(false);
        expect(log.isEnabled(LogLevel.Warn)).toBe(true);
        expect(log.isEnabled(LogLevel.Error)).toBe(true);
    });

    it('should use the level of the category', () => {
        const log = new ConsoleLogger('HueNotify', config);

        expect(log.isEnabled(LogLevel.Trace)).toBe(false);
        expect(log.isEnabled(LogLevel.Debug)).toBe(true);
    });

    it('should prefer the level of the more specific category', () => {
        const log = new ConsoleLogger('HueNotify.Hass', config);

        expect(log.isEnabled(LogLevel.Error)).toBe(false);
    });

    it('should inherit the level of the nearest parent category', () => {
        const log = new ConsoleLogger('HueNotify.Other.Deep', config);

        expect(log.isEnabled(LogLevel.Trace)).toBe(false);
        expect(log.isEnabled(LogLevel.Debug)).toBe(true);
    });

    it('should not match a category that only shares the name prefix', () => {
        const log = new ConsoleLogger('HueNotifyOther', config);

        expect(log.isEnabled(LogLevel.Debug)).toBe(false);
    });

    it('should create sub-category logger with the same config', () => {
        const log = new ConsoleLogger('HueNotify', config).subCategory('Hass');

        expect(log.isEnabled(LogLevel.Error)).toBe(false);

        const deep = new ConsoleLogger('HueNotify', config).subCategory('Other').subCategory('Deep');
        deep.debug('message');

        expect(infoSpy).toHaveBeenCalledWith('[HueNotify.Other.Deep] message');
    });

    it('should write with category prefix and data to the matching console method', () => {
        const log = new ConsoleLogger('Verbose', config);
        const error = new Error('test');

        log.trace('trace');
        log.debug('debug');
        log.info('info');
        log.warn('warn');
        log.error('error', error);

        expect(infoSpy).toHaveBeenCalledTimes(3);
        expect(infoSpy).toHaveBeenCalledWith('[Verbose] trace');
        expect(warnSpy).toHaveBeenCalledWith('[Verbose] warn');
        expect(errorSpy).toHaveBeenCalledWith('[Verbose] error', error);
    });

    it('should not write messages below the level', () => {
        const log = new ConsoleLogger('Unknown', config);

        log.info('info');

        expect(infoSpy).not.toHaveBeenCalled();
    });

    it('should build a lazy message only when it is written', () => {
        const log = new ConsoleLogger('HueNotify', config);
        const skipped = jest.fn(() => 'skipped');
        const written = jest.fn(() => 'written');

        log.trace(skipped);
        log.debug(written);

        expect(skipped).not.toHaveBeenCalled();
        expect(infoSpy).toHaveBeenCalledWith('[HueNotify] written');
    });

    it('should throw on unknown level', () => {
        const invalid: LoggingConfig = { default: 'warn', categories: { 'Bad': 'verbose' } };

        expect(() => new ConsoleLogger('Bad', invalid)).toThrow(/'verbose'/);
    });

    it('should have valid levels in logging.json', () => {
        for (const variant of [logging.dev, logging.prod] as LoggingConfig[]) {
            expect(() => new ConsoleLogger('Any', variant)).not.toThrow();
            for (const category in variant.categories) {
                expect(() => new ConsoleLogger(category, variant)).not.toThrow();
            }
        }
    });
});
