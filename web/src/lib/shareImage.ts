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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Share asset could not be encoded.'));
    reader.onerror = () => reject(new Error('Share asset could not be encoded.'));
    reader.readAsDataURL(blob);
  });
}

async function shareAssetToDataUrl(blob: Blob): Promise<string> {
  if (!blob.type.includes('svg')) return blobToDataUrl(blob);

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    const scale = Math.max(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Share asset could not be rasterized.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function embedShareImages(element: HTMLElement): Promise<() => void> {
  const images = Array.from(element.querySelectorAll('img'));
  const originals = images.map((image) => image.getAttribute('src'));
  const encodedBySource = new Map<string, Promise<string | null>>();

  await Promise.all(images.map(async (image) => {
    const source = image.getAttribute('src');
    if (!source || source.startsWith('data:') || source.startsWith('blob:')) return;
    let encoded = encodedBySource.get(source);
    if (!encoded) {
      encoded = fetch(new URL(source, window.location.href), { credentials: 'same-origin' })
        .then((response) => response.ok ? response.blob() : null)
        .then((blob) => blob ? shareAssetToDataUrl(blob) : null)
        .catch(() => null);
      encodedBySource.set(source, encoded);
    }
    const dataUrl = await encoded;
    if (!dataUrl) return;
    image.src = dataUrl;
    try {
      await image.decode();
    } catch {
      // The text fallback remains visible if an optional image cannot be decoded.
    }
  }));

  return () => images.forEach((image, index) => {
    const original = originals[index];
    if (original === null) image.removeAttribute('src');
    else image.setAttribute('src', original);
  });
}

export async function renderElementToPng(
  element: HTMLElement,
  dimensions = { width: 1200, height: 675 }
): Promise<Blob> {
  await waitForShareAssets(element);
  const restoreImages = await embedShareImages(element);
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(element, {
      backgroundColor: getComputedStyle(element).backgroundColor,
      scale: 1,
      useCORS: true,
      logging: false,
      windowWidth: dimensions.width,
      windowHeight: dimensions.height,
    });
  } finally {
    restoreImages();
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
  if (!blob) throw new Error('Unable to create share image.');
  return blob;
}

export async function shareOrDownloadPng(blob: Blob, filename: string, metadata: { title?: string; text?: string } = {}): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' });
  const shareData = {
    files: [file],
    title: metadata.title ?? 'My Cracked Ice fantasy hockey team',
    text: metadata.text ?? 'What would you change?',
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
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
