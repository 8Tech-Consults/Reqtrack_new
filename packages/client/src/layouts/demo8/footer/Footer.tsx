import { Container } from '@/components/container';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-4 border-t border-slate-200 bg-white/70 dark:border-gray-200 dark:bg-[--tw-content-bg-dark]">
      <Container>
        <div className="flex flex-col items-center justify-center gap-2 py-5 sm:flex-row sm:justify-between">
          <div className="flex gap-2 text-xs font-medium">
            <span className="text-slate-400">{currentYear} &copy;</span>
            <a
              href="https://8technologies.net/"
              target="_blank"
              rel="noreferrer"
              className="text-slate-600 transition-colors hover:text-primary"
            >
              Eight Tech Consults
            </a>
          </div>
          {/* <span className="text-[11px] font-medium text-slate-400">Secure requisition workspace</span> */}
        </div>
      </Container>
    </footer>
  );
};

export { Footer };
