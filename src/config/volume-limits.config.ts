/**
 * Configuración de límites de volumen MLM según número de directos activos
 */
export interface VolumeLimitConfig {
  minDirects: number;
  maxVolume: number;
  description: string;
}

export const VOLUME_LIMITS: VolumeLimitConfig[] = [
  {
    minDirects: 5,
    maxVolume: 250000,
    description: '5 o más directos activos - límite 250,000',
  },
  {
    minDirects: 4,
    maxVolume: 150000,
    description: '4 directos activos - límite 150,000',
  },
  {
    minDirects: 3,
    maxVolume: 50000,
    description: '3 directos activos - límite 50,000',
  },
  {
    minDirects: 2,
    maxVolume: 12500,
    description: '2 directos activos - límite 12,500',
  },
];

/**
 * Calcula el volumen máximo permitido según el número de directos activos
 */
export function getVolumeLimit(directCount: number): number {
  // Ordenar por minDirects descendente y encontrar el primer límite aplicable
  const applicableLimit = VOLUME_LIMITS.sort(
    (a, b) => b.minDirects - a.minDirects,
  ).find((limit) => directCount >= limit.minDirects);

  return applicableLimit?.maxVolume ?? Number.MAX_SAFE_INTEGER; // Sin límite si no hay directos suficientes
}

/**
 * Obtiene la descripción del límite aplicado
 */
export function getVolumeLimitDescription(directCount: number): string {
  const applicableLimit = VOLUME_LIMITS.sort(
    (a, b) => b.minDirects - a.minDirects,
  ).find((limit) => directCount >= limit.minDirects);

  return applicableLimit?.description ?? 'Sin límite de volumen aplicado';
}

/**
 * Calcula el volumen efectivo aplicando los límites
 */
export function calculateEffectiveVolume(
  originalVolume: number,
  directCount: number,
): {
  effectiveVolume: number;
  limitApplied: boolean;
  limitDescription: string;
} {
  const volumeLimit = getVolumeLimit(directCount);
  const effectiveVolume = Math.min(originalVolume, volumeLimit);

  return {
    effectiveVolume,
    limitApplied: effectiveVolume < originalVolume,
    limitDescription: getVolumeLimitDescription(directCount),
  };
}
