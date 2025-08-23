// Função para processar os dados do CSV e transformá-los na estrutura do grafo
function processData(csvData) {
  const nodes = [];
  const links = [];
  const nodeIds = new Set();

  csvData.forEach(row => {
    if (row.id && !nodeIds.has(row.id)) {
      nodes.push({
        id: row.id,
        name: row.name,
        semester: +row.semester,
        area: row.area
      });
      nodeIds.add(row.id);
    }

    if (row.prerequisites) {
      const prereqs = row.prerequisites.split(',');
      prereqs.forEach(prereqId => {
        const cleanPrereqId = prereqId.trim();
        if (cleanPrereqId) {
          links.push({
            source: cleanPrereqId,
            target: row.id
          });
        }
      });
    }
  });

  return { nodes, links };
}

// Exporta a função para que outros arquivos (incluindo os testes) possam usá-la
export { processData };