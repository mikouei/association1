'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: '10px',
        },
        className: 'kotiz-toast',
      }}
      richColors
      closeButton
    />
  );
}

export { toast } from 'sonner';
