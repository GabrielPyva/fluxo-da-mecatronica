// logic.test.js

// Importa a função que queremos testar
const { processData } = require('./logic.js');

// Descreve o conjunto de testes para a função processData
describe('processData', () => {

  // O teste em si
  it('deve criar nós e links corretamente a partir de dados brutos', () => {
    // 1. Prepara os dados de entrada (um "CSV" de mentira)
    const mockCsvData = [
      { id: 'CALC1', name: 'Calculus I', semester: '1', area: 'Math', prerequisites: '' },
      { id: 'PHY1', name: 'Physics I', semester: '1', area: 'Physics', prerequisites: '' },
      { id: 'CALC2', name: 'Calculus II', semester: '2', area: 'Math', prerequisites: 'CALC1' }
    ];

    // 2. Executa a função
    const result = processData(mockCsvData);

    // 3. Verifica os resultados (asserções)
    // Verifica os nós
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes[0].id).toBe('CALC1');
    expect(result.nodes[2].semester).toBe(2); // Verifica se a conversão para número funcionou

    // Verifica os links
    expect(result.links).toHaveLength(1);
    expect(result.links[0].source).toBe('CALC1');
    expect(result.links[0].target).toBe('CALC2');
  });

});