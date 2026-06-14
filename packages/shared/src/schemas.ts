// Validadores Zod para los bordes (red, saves, env) — §0, §24.6.
// Validan estructura serializada; los tipos de compilacion viven en types.ts/prng.ts.
import { z } from 'zod';
import type { RngState, RngStreams } from './prng';
import type { Enhancement, Rank, Rarity, Seal, Suit, VesselId } from './types';

// ---- PRNG (round-trip de estado, Bloque 1) ----
export const RngStateSchema = z
  .object({
    s0: z.number().int(),
    s1: z.number().int(),
    s2: z.number().int(),
    s3: z.number().int(),
  })
  .strict() satisfies z.ZodType<RngState>;

export const RngStreamsSchema = z
  .object({
    deal: RngStateSchema,
    shop: RngStateSchema,
    map: RngStateSchema,
    boss: RngStateSchema,
    event: RngStateSchema,
    reward: RngStateSchema,
    halluc: RngStateSchema,
  })
  .strict() satisfies z.ZodType<RngStreams>;

// ---- Cartas / contenido (tipos base) ----
export const SuitSchema = z.enum(['CALIZ', 'LLAVE', 'HUESO', 'OJO']) satisfies z.ZodType<Suit>;

export const RankSchema = z.literal([
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
]) satisfies z.ZodType<Rank>;

export const EnhancementSchema = z
  .enum(['grabado', 'marca', 'untado', 'dorado', 'cristal', 'piedra', 'espejo'])
  .nullable() satisfies z.ZodType<Enhancement>;

export const SealSchema = z
  .enum(['ocre', 'sangre', 'verdin', 'violeta', 'dorado'])
  .nullable() satisfies z.ZodType<Seal>;

export const RaritySchema = z.enum([
  'comun',
  'pococomun',
  'rara',
  'espectral',
  'maldita',
  'legendaria',
]) satisfies z.ZodType<Rarity>;

export const VesselIdSchema = z.enum([
  'heraldo',
  'vidente',
  'usurero',
  'coleccionista',
  'bestia',
  'profano',
]) satisfies z.ZodType<VesselId>;

export const CardSchema = z
  .object({
    id: z.string(),
    suit: SuitSchema.nullable(),
    rank: RankSchema.nullable(),
    enhancement: EnhancementSchema,
    seal: SealSchema,
    crystalCharges: z.number().int().nonnegative().optional(),
  })
  // Sin `satisfies z.ZodType<Card>`: con exactOptionalPropertyTypes, el `crystalCharges?`
  // de Card (valor exactamente number) no casa con el `number | undefined` de Zod .optional().
  // El round-trip se valida en schemas.test.ts.
  .strict();
