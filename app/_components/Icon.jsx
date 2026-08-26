const PATHS = {
  sparkles: <><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4M19 17v4M3 5h4M17 19h4" /></>,
  fileText: <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></>,
  layout: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18M9 21V9" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  award: <><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></>,
  refresh: <><path d="M21 12a9 9 0 0 0-15-6.7L3 8M3 3v5h5" /><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7M16 16h5v5" /></>,
  arrowRight: <path d="M5 12h14m-7-7 7 7-7 7" />,
  download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  external: <path d="M15 3h6v6m0-6L10 14m8-1v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />,
  arrowLeft: <path d="m12 19-7-7 7-7m7 7H5" />,
  copy: <><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v10" /></>,
  edit: <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />,
  eye: <><path d="M2.1 12.3a1 1 0 0 1 0-.6 10.8 10.8 0 0 1 19.8 0 1 1 0 0 1 0 .6 10.8 10.8 0 0 1-19.8 0Z" /><circle cx="12" cy="12" r="3" /></>,
  alert: <><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".8" fill="currentColor" stroke="none" /></>,
  blog: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>,
  thread: <><path d="M12 21c5 0 8-3.2 8-8.4C20 6.4 17 3 12 3S4 6.4 4 12.6C4 18 7 21 12 21z" /><path d="M9 13.4c0 1.6 1.3 2.5 2.9 2.5 2.2 0 3.4-1.3 3.4-4.4 0-2.4-1.4-3.7-3.2-3.7-1.3 0-2.3.6-2.8 1.5" /></>,
  user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  archive: <><rect width="20" height="5" x="2" y="3" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" /></>,
  image: <><rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></>,
  trash: <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />,
  sort: <path d="m3 16 4 4 4-4M7 20V4m14 4-4-4-4 4M17 4v16" />,
  send: <path d="m3 3 18 9-18 9 4-9-4-9Z" />,
  chat: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />,
};

export function Icon({ name, className = 'size-6' }) {
  return <svg className={`shrink-0 fill-none stroke-current stroke-[1.5] ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false" strokeLinecap="round" strokeLinejoin="round">{PATHS[name] || PATHS.award}</svg>;
}
