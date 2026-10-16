import React from 'react';

interface InfoModalProps {
  title: string | null;
  content: string | null;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({
  title,
  content,
  onClose,
}) => {
  if (!title) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/45 p-space-md"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl bg-surface rounded-xl shadow-[0_10px_15px_-3px_rgba(17,24,39,0.08)] p-space-lg flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">info</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">{title}</h3>
          </div>
          <button
            className="text-on-surface-variant hover:text-on-surface p-1 rounded cursor-pointer"
            onClick={onClose}
            type="button"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-space-md bg-surface-container-low rounded-lg text-body-md text-body-md text-on-surface-variant leading-relaxed">
          {content}
        </div>

        <div className="flex justify-end pt-space-xs">
          <button
            className="px-5 py-2 bg-primary text-on-primary text-title-md font-title-md rounded-lg hover:bg-primary-container cursor-pointer transition-colors"
            onClick={onClose}
            type="button"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
