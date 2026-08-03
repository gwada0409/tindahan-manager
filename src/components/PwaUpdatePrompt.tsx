import { Download, WifiOff, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './ui/Button';

export function PwaUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('Service worker registration failed.', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) {
    return null;
  }

  return (
    <section
      aria-live="polite"
      aria-label="Application update status"
      className="fixed bottom-4 left-4 right-4 z-[110] mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
    >
      <div className="flex items-start gap-3">
        {needRefresh ? (
          <Download aria-hidden="true" className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
        ) : (
          <WifiOff aria-hidden="true" className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">
            {needRefresh ? 'A new version is available.' : 'App is ready to work offline.'}
          </p>
          {needRefresh && (
            <p className="mt-1 text-sm text-slate-600">Update when you are ready to reload the app.</p>
          )}
          {needRefresh && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void updateServiceWorker(true)}>
                Update
              </Button>
              <Button size="sm" variant="outline" onClick={close}>
                Later
              </Button>
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss application update status"
          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={close}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
