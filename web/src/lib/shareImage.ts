import html2canvas from 'html2canvas';

export async function renderElementToPng(
  element: HTMLElement,
  dimensions = { width: 1200, height: 675 }
): Promise<Blob> {
  const canvas = await html2canvas(element, {
    backgroundColor: getComputedStyle(element).backgroundColor,
    scale: 1,
    useCORS: true,
    logging: false,
    windowWidth: dimensions.width,
    windowHeight: dimensions.height,
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
  if (!blob) throw new Error('Unable to create pairing image.');
  return blob;
}

export async function shareOrDownloadPng(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' });
  const shareData = {
    files: [file],
    title: 'Cracked Ice draft pairing',
    text: 'A schedule pairing from Cracked Ice Hockey',
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
