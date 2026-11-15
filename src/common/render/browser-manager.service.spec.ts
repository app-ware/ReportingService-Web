import { resolveBrowserExecutablePath } from './browser-manager.service';

describe('resolveBrowserExecutablePath', () => {
  it('preserves Playwright default resolution when its managed executable exists', () => {
    expect(
      resolveBrowserExecutablePath({
        playwrightExecutablePath: '/playwright/chrome',
        fileExists: (candidate) => candidate === '/playwright/chrome',
      }),
    ).toBeUndefined();
  });

  it('gives an explicit executable path precedence', () => {
    expect(
      resolveBrowserExecutablePath({
        configuredPath: ' C:\\Portable\\chrome.exe ',
        playwrightExecutablePath: 'C:\\Playwright\\headless_shell.exe',
        platform: 'win32',
        fileExists: () => true,
      }),
    ).toBe('C:\\Portable\\chrome.exe');
  });

  it('falls back to installed Chrome when the Playwright browser is missing', () => {
    const chrome = 'D:\\Apps\\Google\\Chrome\\Application\\chrome.exe';
    expect(
      resolveBrowserExecutablePath({
        playwrightExecutablePath: 'C:\\Missing\\headless_shell.exe',
        platform: 'win32',
        env: { ProgramFiles: 'D:\\Apps' },
        fileExists: (candidate) => candidate === chrome,
      }),
    ).toBe(chrome);
  });

  it('returns undefined when no managed or system browser is available', () => {
    expect(
      resolveBrowserExecutablePath({
        playwrightExecutablePath: '/missing/playwright',
        platform: 'linux',
        env: {},
        fileExists: () => false,
      }),
    ).toBeUndefined();
  });
});
