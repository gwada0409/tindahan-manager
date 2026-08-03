import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { PwaUpdatePrompt } from './PwaUpdatePrompt';

const setOfflineReady = vi.fn();
const setNeedRefresh = vi.fn();
const updateServiceWorker = vi.fn().mockResolvedValue(undefined);

function mockRegistration(offlineReady: boolean, needRefresh: boolean) {
  vi.mocked(useRegisterSW).mockReturnValue({
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  });
}

describe('PwaUpdatePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports when the application shell is ready offline and can dismiss the message', () => {
    mockRegistration(true, false);

    render(<PwaUpdatePrompt />);

    expect(screen.getByText('App is ready to work offline.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss application update status' }));
    expect(setOfflineReady).toHaveBeenCalledWith(false);
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
  });

  it('lets the user activate or defer a waiting service worker', () => {
    mockRegistration(false, true);

    render(<PwaUpdatePrompt />);

    expect(screen.getByText('A new version is available.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
  });
});
