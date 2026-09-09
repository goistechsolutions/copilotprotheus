import { normalizeAgentResult } from './normalizeAgentResult';

describe('normalizeAgentResult', () => {
  it('should return error status for validation_failed', () => {
    const raw = {
      status: 'validation_failed',
      error_code: 'SQL_CATALOG_VALIDATION_FAILED',
      message: 'A solicitação exigiu uma estrutura indisponível no dicionário autorizado',
      correlation_id: 'uuid',
      retryable: false,
      result: null
    };

    const result = normalizeAgentResult(raw);
    
    expect(result.status).toBe('error');
    expect(result.result).toBeNull();
    expect(result.hasData).toBe(false);
    expect(result.message).toBe('A solicitação exigiu uma estrutura indisponível no dicionário autorizado');
  });

  it('should normalize success payload with semantic data', () => {
    const raw = {
      status: 'success',
      message: 'Consulta concluída.',
      correlation_id: 'uuid',
      result: {
        columns: ['PERIODO_MES', 'VALOR_TOTAL_FATURADO'],
        rows: [{ PERIODO_MES: '202601', VALOR_TOTAL_FATURADO: 1784869.65 }],
        metadata: { row_count: 1, source: 'queryrest' },
        dimensions: [{ key: 'PERIODO_MES', label: 'Período', kind: 'time' }],
        measures: [{ key: 'VALOR_TOTAL_FATURADO', label: 'Valor total faturado', format: 'currency', aggregation: 'sum' }],
        kpis: [{ key: 'total_faturado', label: 'Valor total faturado', value: 1784869.65, format: 'currency', source_column: 'VALOR_TOTAL_FATURADO', aggregation: 'sum', dimension: 'PERIODO_MES' }],
        series: [{ id: 'faturamento_por_periodo', label: 'Faturamento por período', dimension: 'PERIODO_MES', measure: 'VALOR_TOTAL_FATURADO', format: 'currency', points: [{ label: '202601', value: 1784869.65 }] }]
      }
    };

    const result = normalizeAgentResult(raw);
    
    expect(result.status).toBe('success');
    expect(result.result.columns).toHaveLength(2);
    expect(result.result.rows).toHaveLength(1);
    expect(result.result.dimensions).toHaveLength(1);
    expect(result.result.measures).toHaveLength(1);
    expect(result.result.kpis).toHaveLength(1);
    expect(result.result.series).toHaveLength(1);
    
    expect(result.hasData).toBe(true);
    expect(result.hasTypedKpis).toBe(true);
    expect(result.hasTimeDimension).toBe(true);
    expect(result.canExport).toBe(true);
  });
});
