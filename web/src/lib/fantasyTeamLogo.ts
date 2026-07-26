export const FANTASY_TEAM_LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const FANTASY_TEAM_LOGO_SIZE = 256;
const SUPPORTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function validateFantasyTeamLogo(file: File): string | null {
  if (!SUPPORTED_TYPES.has(file.type)) return 'Choose a PNG, JPG, or WebP image.';
  if (file.size > FANTASY_TEAM_LOGO_MAX_BYTES) return 'Choose an image smaller than 5 MB.';
  return null;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Logo could not be read.'));
    reader.onerror = () => reject(new Error('Logo could not be read.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Logo could not be decoded.'));
    image.src = src;
  });
}

export async function prepareFantasyTeamLogo(file: File): Promise<string> {
  const validationError = validateFantasyTeamLogo(file);
  if (validationError) throw new Error(validationError);

  const source = await fileToDataUrl(file);
  const image = await loadImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = FANTASY_TEAM_LOGO_SIZE;
  canvas.height = FANTASY_TEAM_LOGO_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Logo processing is unavailable in this browser.');

  const padding = 16;
  const available = FANTASY_TEAM_LOGO_SIZE - padding * 2;
  const scale = Math.min(available / image.naturalWidth, available / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, (FANTASY_TEAM_LOGO_SIZE - width) / 2, (FANTASY_TEAM_LOGO_SIZE - height) / 2, width, height);

  return canvas.toDataURL('image/webp', 0.9);
}
