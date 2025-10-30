/**
 * FTA (Fast TypeScript Analyzer) output types
 */

export interface HalsteadMetrics {
  readonly uniq_operators: number;
  readonly uniq_operands: number;
  readonly total_operators: number;
  readonly total_operands: number;
  readonly program_length: number;
  readonly vocabulary_size: number;
  readonly volume: number;
  readonly difficulty: number;
  readonly effort: number;
  readonly time: number;
  readonly bugs: number;
}

export interface FtaResult {
  readonly file_name: string;
  readonly cyclo: number;
  readonly halstead: HalsteadMetrics;
  readonly line_count: number;
  readonly fta_score: number;
  readonly assessment: string;
}
