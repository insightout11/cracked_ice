import html2canvas from 'html2canvas';

async function waitForShareAssets(element: HTMLElement): Promise<void> {
  if (document.fonts?.ready) await document.fonts.ready;
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const finish = () => resolve();
      image.addEventListener('load', finish, { once: true });
      image.addEventListener('error', finish, { once: true });
      window.setTimeout(finish, 3000);
    });
  }));
}

export async function renderElementToPng(
  element: HTMLElement,
  dimensions = { width: 1200, height: 675 }
): Promise<Blob> {
  await waitForShareAssets(element);
  const canvas = await html2canvas(element, {
    backgroundColor: getComputedStyle(element).backgroundColor,
    scale: 1,
    useCORS: true,
    logging: false,
    windowWidth: dimensions.width,
    windowHeight: dimensions.height,
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
  if (!blob) throw new Error('Unable to create share image.');
  return blob;
}

export async function shareOrDownloadPng(blob: Blob, filename: string, metadata: { title?: string; text?: string } = {}): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' });
  const shareData = {
    files: [file],
    title: metadata.title ?? 'Cracked Ice draft pairing',
    text: metadata.text ?? 'A schedule pairing from Cracked Ice Hockey',
  };

  const prefersNativeShare = navigator.maxTouchPoints > 0;
  if (prefersNativeShare && navigator.share && navigator.canShare?.(shareData)) {
    await navigator.share(shareData);
    return 'shared';
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
