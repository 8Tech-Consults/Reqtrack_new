import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@apollo/client/react';
import { Bot, Loader2, RotateCcw, Send, ThumbsDown, ThumbsUp } from 'lucide-react';
import clsx from 'clsx';
import {
  ASK_HELP_ASSISTANT,
  HelpAssistantReply,
  RATE_ASSISTANT_ANSWER
} from '@/gql/helpCentre';
import { HelpText } from './HelpText';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  sources?: HelpAssistantReply['sources'];
  logId?: string | null;
  rating?: boolean | null;
  error?: boolean;
};

const STORAGE_KEY = 'help-assistant-conversation';
const HISTORY_TURNS_SENT = 6;

export const STARTER_QUESTIONS = [
  'How do I submit a requisition?',
  'How do I approve or authorize a requisition?',
  'How do I submit an accountability?',
  'I forgot my password. How do I reset it?'
];

const loadConversation = (): ChatMessage[] => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveConversation = (messages: ChatMessage[]) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
  } catch {
    // Storage unavailable (private mode etc.) - the chat still works.
  }
};

type HelpAssistantChatProps = {
  className?: string;
  // Called when a source link is clicked, e.g. so the floating widget can close.
  onNavigate?: () => void;
};

export const HelpAssistantChat = ({ className, onNavigate }: HelpAssistantChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>(loadConversation);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [ask, { loading }] = useMutation<
    { askHelpAssistant: HelpAssistantReply },
    { question: string; history: { role: string; content: string }[] }
  >(ASK_HELP_ASSISTANT);
  const [rate] = useMutation<{ rateAssistantAnswer: boolean }, { logId: string; helpful: boolean }>(
    RATE_ASSISTANT_ANSWER
  );

  useEffect(() => {
    saveConversation(messages);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || loading) return;

    const history = messages
      .filter((message) => !message.error)
      .slice(-HISTORY_TURNS_SENT)
      .map(({ role, content }) => ({ role, content }));

    setMessages((current) => [...current, { role: 'user', content: question }]);
    setDraft('');

    try {
      const response = await ask({ variables: { question, history } });
      const reply = response.data?.askHelpAssistant;
      setMessages((current) => [
        ...current,
        reply
          ? { role: 'assistant', content: reply.answer, sources: reply.sources, logId: reply.logId, rating: null }
          : { role: 'assistant', content: 'Sorry, I could not get an answer. Please try again.', error: true }
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: error instanceof Error ? error.message : 'Sorry, something went wrong. Please try again.',
          error: true
        }
      ]);
    } finally {
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send(draft);
  };

  const handleRate = (index: number, helpful: boolean) => {
    const message = messages[index];
    const alreadyRated = message?.rating !== null && message?.rating !== undefined;
    if (!message?.logId || alreadyRated) return;
    setMessages((current) => current.map((item, i) => (i === index ? { ...item, rating: helpful } : item)));
    rate({ variables: { logId: message.logId, helpful } }).catch(() => undefined);
  };

  return (
    <div className={clsx('flex min-h-0 flex-col', className)}>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#2aaed3]/10 text-[#2aaed3]">
                <Bot size={16} />
              </span>
              <div className="rounded-xl rounded-tl-sm bg-slate-100 px-3 py-2 text-sm text-slate-700">
                Hi! I can answer questions about using the system, based on the Help Centre articles. What do you
                need help with?
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-9">
              {STARTER_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-[#2aaed3] hover:text-[#2aaed3]"
                  onClick={() => void send(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) =>
          message.role === 'user' ? (
            <div key={index} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-xl rounded-tr-sm bg-[#2aaed3] px-3 py-2 text-sm text-white">
                {message.content}
              </div>
            </div>
          ) : (
            <div key={index} className="flex items-start gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#2aaed3]/10 text-[#2aaed3]">
                <Bot size={16} />
              </span>
              <div className="min-w-0 max-w-[85%] space-y-2">
                <div
                  className={clsx(
                    'rounded-xl rounded-tl-sm px-3 py-2',
                    message.error ? 'bg-rose-50 text-sm text-rose-700' : 'bg-slate-100'
                  )}
                >
                  {message.error ? message.content : <HelpText text={message.content} />}
                </div>

                {!!message.sources?.length && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">From the Help Centre</p>
                    {message.sources.slice(0, 3).map((source) => (
                      <Link
                        key={source.id}
                        to={`/help?article=${source.id}`}
                        onClick={onNavigate}
                        className="block truncate text-xs text-[#2aaed3] hover:underline"
                      >
                        {source.question}
                      </Link>
                    ))}
                  </div>
                )}

                {message.logId && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    {message.rating === null || message.rating === undefined ? (
                      <>
                        <span>Helpful?</span>
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-slate-100 hover:text-emerald-600"
                          onClick={() => handleRate(index, true)}
                          aria-label="Yes, this was helpful"
                        >
                          <ThumbsUp size={13} />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-slate-100 hover:text-rose-600"
                          onClick={() => handleRate(index, false)}
                          aria-label="No, this was not helpful"
                        >
                          <ThumbsDown size={13} />
                        </button>
                      </>
                    ) : (
                      <span>Thanks for the feedback.</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {loading && (
          <div className="flex items-center gap-2 pl-9 text-xs text-slate-500">
            <Loader2 size={14} className="animate-spin" /> Looking that up…
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-200 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
              }
            }}
            rows={1}
            maxLength={500}
            placeholder="Ask a question…"
            className="input max-h-28 min-h-10 flex-1 resize-none py-2"
            aria-label="Ask the help assistant a question"
          />
          <button
            type="submit"
            className="btn btn-primary btn-icon h-10 w-10 shrink-0"
            disabled={loading || !draft.trim()}
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
            onClick={() => setMessages([])}
          >
            <RotateCcw size={11} /> Start a new conversation
          </button>
        )}
      </form>
    </div>
  );
};
