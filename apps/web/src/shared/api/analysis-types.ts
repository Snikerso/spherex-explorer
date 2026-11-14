export type Quality = {
  observationId: string;
  observedAtUtc: string;
  wavelengthUm: number;
  flaggedFraction: number;
  qualityBits: {
    bit: number;
    name: string;
    description: string;
    pixels: number;
    fraction: number;
  }[];
};
