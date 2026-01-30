import React from 'react';
import { Share } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  targetRef: React.RefObject<HTMLElement | null>;
  fileName?: string;
  className?: string;
}

export default function ShareButton({ targetRef, fileName = 'dashboard.png', className }: ShareButtonProps) {
  const handleShare = async () => {
    if (!targetRef.current) return;
    try {
      const htmlToImage = await import('html-to-image');
      const dataUrl = await htmlToImage.toPng(targetRef.current, {
        backgroundColor: '#0f172a',
        cacheBust: true,
      });

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: blob.type });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        // mobile/native share
        // @ts-ignore - navigator.share types vary; this is guarded by canShare
        await navigator.share({ files: [file], title: 'Dashboard', text: 'Estado de ventas' });
      } else {
        // fallback: download
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);
      }
    } catch (err) {
      console.error('Share failed', err);
    }
  };

  return (
    <Button onClick={handleShare} variant="ghost" size="icon" className={className}>
      <Share className="w-4 h-4" />
    </Button>
  );
}
