export interface GifInfo {
  valid: boolean;
  header: string;
  looping: boolean;
  transparent: boolean;
  size: number;
}

export function analyzeGif(bytes: Uint8Array | number[]): GifInfo;
