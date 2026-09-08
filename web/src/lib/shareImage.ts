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

/**
 * Render a complete, responsive UI surface at a stable desktop width. The
 * detached clone keeps mobile exports from collapsing the comparison while
 * leaving the live page untouched.
 */
export async function renderFullHeightElementToPng(
  element: HTMLElement,
  width = 1440
): Promise<Blob> {
  const exportRoot = element.cloneNode(true) as HTMLElement;
  const sourceControls = Array.from(element.querySelectorAll('input, select, textarea'));
  const exportControls = Array.from(exportRoot.querySelectorAll('input, select, textarea'));
  sourceControls.forEach((source, index) => {
    const target = exportControls[index];
    if (!target) return;
    if (source instanceof HTMLSelectElement && target instanceof HTMLSelectElement) {
      target.value = source.value;
      Array.from(target.options).forEach((option) => { option.selected = option.value === source.value; });
    } else if (source instanceof HTMLInputElement && target instanceof HTMLInputElement) {
      target.value = source.value;
      target.checked = source.checked;
    } else if (source instanceof HTMLTextAreaElement && target instanceof HTMLTextAreaElement) {
      target.value = source.value;
      target.textContent = source.value;
    }
  });
  const sourceDetails = Array.from(element.querySelectorAll('details'));
  const exportDetails = Array.from(exportRoot.querySelectorAll('details'));
  sourceDetails.forEach((source, index) => {
    const target = exportDetails[index];
    if (!target) return;
    if (source.open) {
      target.open = true;
      return;
    }
    Array.from(target.children).forEach((child) => {
      if (child.tagName !== 'SUMMARY') child.remove();
    });
    const summary = target.querySelector('summary');
    if (summary) Object.assign(summary.style, { display: 'block', listStyle: 'none' });
  });
  const sourceProductionButtons = Array.from(element.querySelectorAll('[aria-label="Use last season or upcoming projections"] button'));
  const productionToggle = exportRoot.querySelector('[aria-label="Use last season or upcoming projections"]');
  if (productionToggle) {
    const staticToggle = document.createElement('div');
    staticToggle.className = productionToggle.className;
    Object.assign(staticToggle.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      minHeight: '44px',
      width: 'max-content',
      padding: '4px',
      border: '1px solid var(--line)',
      borderRadius: '8px',
      backgroundColor: 'var(--surface-0)',
    });
    sourceProductionButtons.forEach((button) => {
      const selected = button.getAttribute('aria-pressed') === 'true';
      const label = document.createElement('span');
      label.textContent = button.textContent;
      Object.assign(label.style, {
        display: 'flex',
        alignItems: 'center',
        minHeight: '36px',
        padding: '0 12px',
        borderRadius: '6px',
        color: selected ? 'var(--accent-ink)' : 'var(--ink-dim)',
        backgroundColor: selected ? 'var(--accent)' : 'transparent',
        fontSize: '12px',
        fontWeight: '600',
      });
      staticToggle.appendChild(label);
    });
    productionToggle.replaceWith(staticToggle);
  }
  exportRoot.querySelectorAll('[data-export-factor-bar]').forEach((bar) => {
    bar.classList.remove('ring-1', 'ring-current/10');
  });
  exportRoot.querySelectorAll('[data-export-full-text]').forEach((label) => {
    label.classList.remove('truncate');
    Object.assign((label as HTMLElement).style, {
      whiteSpace: 'normal',
      overflow: 'visible',
      textOverflow: 'clip',
    });
  });
  exportRoot.querySelectorAll('[data-export-hide]').forEach((node) => node.remove());
  exportRoot.setAttribute('aria-hidden', 'true');
  exportRoot.classList.add('bg-surface-0');
  Object.assign(exportRoot.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: `${width}px`,
    maxWidth: 'none',
    boxSizing: 'border-box',
    height: 'auto',
    overflow: 'visible',
    zIndex: '-1',
  });
  document.body.appendChild(exportRoot);

  try {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const renderedWidth = Math.ceil(Math.max(width, exportRoot.scrollWidth, exportRoot.getBoundingClientRect().width));
    exportRoot.style.width = `${renderedWidth}px`;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const height = Math.ceil(exportRoot.scrollHeight);
    return await renderElementToPng(exportRoot, { width: renderedWidth, height });
  } finally {
    exportRoot.remove();
  }
}

export function downloadPng(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  downloadPng(blob, filename);
  return 'downloaded';
}
