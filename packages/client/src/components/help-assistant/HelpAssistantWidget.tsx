import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, MessageCircleQuestion, X } from 'lucide-react';
import { HelpAssistantChat } from './HelpAssistantChat';

// Floating "Ask for help" button shown on every signed-in page. Hidden on the
// Help Centre page itself, which embeds the same chat inline.
export const HelpAssistantWidget = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  if (pathname.startsWith('/help')) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div
          role="dialog"
          aria-label="Help assistant"
          className="flex h-[min(560px,calc(100vh-7rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-[380px]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-[#172550] px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">Help assistant</p>
              <p className="text-[11px] text-white/70">Answers from the Help Centre</p>
            </div>
            <div className="flex items-center gap-1">
              <Link
                to="/help"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
                title="Open the Help Centre"
                aria-label="Open the Help Centre"
              >
                <BookOpen size={16} />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Close help assistant"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <HelpAssistantChat className="flex-1" onNavigate={() => setOpen(false)} />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-12 items-center gap-2 rounded-full bg-[#2aaed3] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(42,174,211,0.9)] transition-transform hover:bg-[#239abd] active:scale-95"
        aria-expanded={open}
      >
        {open ? <X size={18} /> : <MessageCircleQuestion size={18} />}
        <span className="hidden sm:inline">{open ? 'Close' : 'Need help?'}</span>
      </button>
    </div>
  );
};
