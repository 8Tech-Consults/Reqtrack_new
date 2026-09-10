import useBodyClasses from '@/hooks/useBodyClasses';
import { Demo8LayoutProvider, Main } from '.';

const Demo8Layout = () => {
  // Using the custom hook to set classes on the body
  useBodyClasses(`
    [--tw-page-bg:#F3F6F9]
    [--tw-page-bg-dark:var(--tw-coal-200)]
    [--tw-content-bg:var(--tw-light)]
    [--tw-content-bg-dark:var(--tw-coal-500)]
    [--tw-content-scrollbar-color:#DDE5EC]
    [--tw-header-height:76px]
    [--tw-sidebar-width:320px]
    [--tw-primary:#2AAED3]
    [--tw-primary-active:#178EB3]
    [--tw-primary-light:#E9F8FC]
    [--tw-primary-clarity:rgba(42,174,211,0.20)]
    [--tw-primary-inverse:#FFFFFF]
    bg-[--tw-page-bg]
    dark:bg-[--tw-page-bg-dark]
  `);

  return (
    // Providing layout context and rendering the main content
    <Demo8LayoutProvider>
      <Main />
    </Demo8LayoutProvider>
  );
};

export { Demo8Layout };
