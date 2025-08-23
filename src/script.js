import { processData } from './logic.js';

// Função principal que carrega os dados e inicializa o grafo
async function setupGraph() {
  try {
    const data = await d3.csv("public/data/grade-curricular.csv");
    const DATA = processData(data);
    initializeGraph(DATA);
  } catch (error) {
    console.error("Erro ao carregar ou processar o arquivo CSV:", error);
    // Opcional: Mostrar uma mensagem de erro na própria página
    document.body.innerHTML = `<div style="color: red; padding: 20px;">Erro ao carregar dados. Verifique o console (F12) e o arquivo CSV.</div>`;
  }
}


// Função que contém toda a lógica para desenhar e controlar o grafo
function initializeGraph(DATA) {

  /* ---------------------------------------------
  * Graph Setup
  * -------------------------------------------*/
  const svg = d3.select('#graph');
  const width = () => svg.node().clientWidth;
  const height = () => svg.node().clientHeight;

  const gRoot = svg.append('g').attr('transform', `translate(${width() / 2}, ${height() / 2})`);
  const gLinks = gRoot.append('g').attr('class','links');
  const gArrowheads = gRoot.append('g').attr('class', 'arrowheads');
  const gNodes = gRoot.append('g').attr('class','nodes');
  const gLabels = gRoot.append('g').attr('class','labels');

  const tooltip = d3.select('#tooltip');

  const color = d3.scaleOrdinal()
    .domain(['Core Math','Física','Computação','Elétrica','Mecânica','Química','Outro', 'Default', 'General'])
    .range(['#2dff61ff','#ff9100ff','#008cffff','#ae00ffff','#ff0000ff','#fffb00ff','#c2d0ff', '#aaaaaa', '#bbbbbb']);

  const indeg = new Map(DATA.nodes.map(d=>[d.id,0]));
  DATA.links.forEach(l=>{ indeg.set(l.target, (indeg.get(l.target)||0)+1); });

  const sim = d3.forceSimulation(DATA.nodes)
    .force('link', d3.forceLink(DATA.links).id(d=>d.id).distance(100).strength(0.13))
    .force('charge', d3.forceManyBody().strength(-250))
    .force('center', d3.forceCenter(0,0))
    .force('collide', d3.forceCollide(30));

  let isOrganized = false;
  let lastFilter = { type: null };
  let currentlyVisibleIds = new Set();
  let focusedId = null;

  svg.call(d3.zoom().scaleExtent([.25, 3]).on('zoom', (ev) => {
    gRoot.attr('transform', ev.transform);
  }))
  .on('dblclick.zoom', null);

  const link = gLinks.selectAll('path').data(DATA.links).join('path')
    .attr('stroke', 'rgba(255,255,255,.25)')
    .attr('fill', 'none')
    .attr('stroke-width', 1.4);
  
  const arrowheads = gArrowheads.selectAll('path.arrowhead')
    .data(DATA.links)
    .join('path')
    .attr('class', 'arrowhead')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', 'rgba(255,255,255,.6)');

  const node = gNodes.selectAll('g.node').data(DATA.nodes).join(enter=>{
    const g = enter.append('g').attr('class','node').style('cursor','pointer');
    g.append('circle')
        .attr('r', 12)
        .attr('fill', d=>color(d.area))
        .attr('stroke', '#0b0f25')
        .attr('stroke-width', d=> 1 + Math.min(3, (indeg.get(d.id)||0)*0.7));
    g.append('title').text(d=>d.name);
    return g;
  });

  const labels = gLabels.selectAll('text').data(DATA.nodes).join('text')
    .attr('font-size', 12)
    .attr('fill', 'rgba(255,255,255,.92)')
    .attr('stroke', 'rgba(11,15,37,.7)')
    .attr('stroke-width', 3)
    .attr('paint-order', 'stroke')
    .attr('text-anchor','middle')
    .text(d=>d.name);
  
  // Popula a lista de sugestões da barra de pesquisa
  const datalist = d3.select('#course-suggestions');
  DATA.nodes.forEach(node => {
    datalist.append('option').attr('value', node.name);
  });

  sim.on('tick', ticked);

  function ticked(){
    link.attr('d', d => `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`);
    node.attr('transform', d=> `translate(${d.x},${d.y})`);
    labels.attr('x', d=>d.x).attr('y', d=>d.y-16);
    arrowheads.attr('transform', d => {
        const midX = (d.source.x + d.target.x) / 2;
        const midY = (d.source.y + d.target.y) / 2;
        const angle = Math.atan2(d.target.y - d.source.y, d.target.x - d.source.x) * (180 / Math.PI);
        return `translate(${midX}, ${midY}) rotate(${angle})`;
    });
  }

  // LÓGICA DE LAYOUT HÍBRIDO (GRID + CÍRCULO)
  // ===============================================

  calculateHybridLayoutPositions(DATA.nodes);

  function calculateHybridLayoutPositions(nodes) {
      const coreNodes = nodes.filter(n => n.semester > 0);
      const electiveNodes = nodes.filter(n => n.semester === 0);

      const colWidth = 220;
      const rowHeight = 120;

      const nodesBySemester = d3.group(coreNodes, d => d.semester);
      
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

      // Calcula posições do grid para matérias obrigatórias
      nodesBySemester.forEach((nodesInSemester, semester) => {
          const colIndex = semester - 1;
          const numRows = nodesInSemester.length;
          nodesInSemester.forEach((node, rowIndex) => {
              const x = colIndex * colWidth;
              const y = (rowIndex - (numRows - 1) / 2) * rowHeight;
              node.layoutX = x;
              node.layoutY = y;

              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
          });
      });

      // Calcula posições em círculo para matérias optativas
      if (electiveNodes.length > 0) {
          const gridWidth = (maxX === -Infinity) ? 0 : maxX - minX;
          const gridHeight = (maxY === -Infinity) ? 0 : maxY - minY;
          
          // A CORREÇÃO ESTÁ AQUI: Calculamos o centro do grid
          const gridCenterX = minX + gridWidth / 2;
          const gridCenterY = minY + gridHeight / 2;

          const radius = Math.sqrt(gridWidth*gridWidth + gridHeight*gridHeight) / 2 + 150; // Aumentei o espaçamento
          
          electiveNodes.forEach((node, i) => {
              const angle = (i / electiveNodes.length) * 2 * Math.PI;
              // E APLICAMOS ESSE CENTRO COMO UM "OFFSET" PARA A ÓRBITA
              node.layoutX = gridCenterX + radius * Math.cos(angle);
              node.layoutY = gridCenterY + radius * Math.sin(angle);
          });
      }
  }

  // Funções de Drag & Drop
  node.call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended));

  function dragstarted(event, d) {
    if (!event.active) sim.alphaTarget(0.3).restart();
    if (!isOrganized) {
      d.fx = d.x;
      d.fy = d.y;
    }
  }
  
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  
  function dragended(event, d) {
    if (!event.active) sim.alphaTarget(0);
    if (isOrganized) {
        d.fx = d.layoutX;
        d.fy = d.layoutY;
    } else {
        d.fx = null;
        d.fy = null;
    }
  }

  node.on('click', (ev, d) => {
    // Define o nó clicado como o "foco"
    focusedId = d.id;
    // Define o tipo de filtro para "vizinhos" como padrão
    lastFilter.type = 'neighbors'; 
    // Executa a função para destacar os vizinhos
    highlightNeighbors(d.id);
  });

  // Controles
  // ===============================================
  // Search
  const searchInput = d3.select('#search');
  const searchBtn = d3.select('#btn-search');
  const clearBtn = d3.select('#btn-clear-search');

  // Ação de Pesquisar (clicando na lupa ou apertando Enter)
  function executeSearch() {
    const query = searchInput.property('value').trim();
    if (!query) return;

    const foundNode = DATA.nodes.find(n => n.name.toLowerCase() === query.toLowerCase());

    if (foundNode) {
      focusedId = foundNode.id;
      lastFilter.type = 'neighbors';
      
      animateFocus(foundNode);
      highlightNeighbors(foundNode.id);
    }
    
    // Feature 1: Limpa o campo de texto após a busca
    searchInput.property('value', '');
    // Esconde o botão "X" novamente
    clearBtn.style('display', 'none');
  }

  searchBtn.on('click', executeSearch);

  searchInput.on('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      executeSearch();
    }
  });

  // Feature 2: Lógica do botão de limpar "X"
  clearBtn.on('click', () => {
    searchInput.property('value', ''); // Limpa o texto
    clearBtn.style('display', 'none'); // Esconde o "X"
    searchInput.node().focus(); // Devolve o foco ao campo de texto
  });

  // Mostra ou esconde o botão "X" conforme o usuário digita
  searchInput.on('input', function() {
    const hasText = this.value.length > 0;
    clearBtn.style('display', hasText ? 'block' : 'none');
  });

  // Garante que a tecla "Enter" no campo de pesquisa acione o clique no botão
  d3.select('#search').on('keydown', (event) => {
    if (event.key === 'Enter') {
      // Impede o comportamento padrão do Enter (como submeter um formulário)
      event.preventDefault(); 
      // Dispara o evento de clique no botão da lupa
      d3.select('#btn-search').dispatch('click');
    }
  });

  // Botão de Organização
  d3.select('#btn-organize-sem').on('click', () => {
      isOrganized = !isOrganized;
      sim.alpha(0.5).restart();

      if (isOrganized) {
          DATA.nodes.forEach(d => {
              d.fx = d.layoutX;
              d.fy = d.layoutY;
          });
      } else {
          DATA.nodes.forEach(d => {
              d.fx = null;
              d.fy = null;
          });
      }
  });

  // Reset
  function resetView(){
    isOrganized = false;
    focusedId = null;
    lastFilter.type = null;

    DATA.nodes.forEach(d => { d.fx = null; d.fy = null; });

    const t = d3.zoomIdentity.translate(0, 0);
    svg.transition().duration(750).call(d3.zoom().transform, t);
    setOpacity(DATA.nodes.map(d=>d.id));
  }
  svg.on('dblclick', resetView);
  
  d3.select('#btn-showAll').on('click', () => {
    focusedId=null;
    lastFilter.type = null;
    setOpacity(DATA.nodes.map(d => d.id));
  });

  d3.select('#chk-isolate').on('change', function() {
    if (currentlyVisibleIds.size > 0 && currentlyVisibleIds.size < DATA.nodes.length) {
      setOpacity([...currentlyVisibleIds]);
    } else {
      setOpacity(DATA.nodes.map(d => d.id));
    }
  });

  d3.select('#chk-labels').on('change', function(){
    const vis = this.checked ? 1 : 0; labels.transition().duration(250).style('opacity', vis);
  });

  d3.select('#chk-arrows').on('change', function(){
    arrowheads.style('display', this.checked ? 'block' : 'none');
  });

  d3.select('#chk-collide').on('change', function(){
    sim.force('collide', this.checked ? d3.forceCollide(22) : null).alpha(0.6).restart();
  });

  const depthInput = d3.select('#depth');
  const depthVal = d3.select('#depthVal');
  depthInput.on('input', function(){
    depthVal.text(this.value);
    if (focusedId && lastFilter.type) {
      showChain(focusedId, lastFilter.type, +this.value);
    }
  });

  d3.select('#btn-neighbors').on('click', ()=>{
    if(!focusedId) return;
    lastFilter.type = 'neighbors';
    highlightNeighbors(focusedId);
  });
  d3.select('#btn-prereq').on('click', ()=>{
    if(!focusedId) return;
    lastFilter.type = 'up';
    showChain(focusedId, 'up', +depthInput.property('value'));
  });
  d3.select('#btn-depend').on('click', ()=>{
    if(!focusedId) return;
    lastFilter.type = 'down';
    showChain(focusedId, 'down', +depthInput.property('value'));
  });

  // Funções de Helper
  // ===============================================

  function animateFocus(target){
    const t = d3.zoomTransform(svg.node());
    const k = Math.min(2.2, 1.5); // Garante um zoom consistente
    
    // Calcula a translação necessária para centralizar o nó 'target'
    const x = width() / 2 - target.x * k;
    const y = height() / 2 - target.y * k;

    // Cria a nova transformação de zoom/pan
    const newTransform = d3.zoomIdentity.translate(x, y).scale(k);
    
    // Aplica a transformação com uma animação suave
    svg.transition()
        .duration(750)
        .ease(d3.easeCubicOut)
        .call(d3.zoom().transform, newTransform);
  }

  function setOpacity(visibleIds){
    currentlyVisibleIds = new Set(visibleIds);
    const vis = new Set(visibleIds);
    const isolate = d3.select('#chk-isolate').property('checked');
    const dur = 300;
    node.transition().duration(dur).style('opacity', n=> vis.has(n.id) ? 1 : (isolate? 0 : .12));
    labels.transition().duration(dur).style('opacity', n=> vis.has(n.id) ? 1 : (isolate? 0 : .12));
    link.transition().duration(dur).style('opacity', l=> (vis.has(l.source.id) && vis.has(l.target.id)) ? .9 : (isolate? 0 : .06));
    arrowheads.transition().duration(dur).style('opacity', l=> (vis.has(l.source.id) && vis.has(l.target.id)) ? .9 : (isolate? 0 : .06));
  }

  function highlightNeighbors(id){
    const {pred, succ} = neighborsOf(id);
    const visible = new Set([id, ...pred, ...succ]);
    setOpacity([...visible]);
  }

  function showChain(startId, dir='up', depth=3){
    const visited = new Set([startId]);
    let frontier = new Set([startId]);
    for(let d=0; d<depth; d++){
        const next = new Set();
        for(const v of frontier){
            for(const l of DATA.links){
                if(dir==='up' && l.target.id===v && !visited.has(l.source.id)) {
                    next.add(l.source.id);
                }
                if(dir==='down' && l.source.id===v && !visited.has(l.target.id)) {
                    next.add(l.target.id);
                }
            }
        }
        next.forEach(n=>visited.add(n));
        frontier = next;
        if(next.size===0) break;
    }
    setOpacity([...visited]);
  }
  
  function neighborsOf(id){
    const pred = DATA.links.filter(l=>l.target.id===id).map(l=>l.source.id);
    const succ = DATA.links.filter(l=>l.source.id===id).map(l=>l.target.id);
    return { pred:new Set(pred), succ:new Set(succ) };
  }

  // Controle do painel retrátil
  d3.select('#btn-collapse').on('click', () => {
    document.body.classList.toggle('sidebar-collapsed');
  });

  // Initial state
  d3.select('#nodeCount').text(DATA.nodes.length);
}

// Inicia todo o processo
setupGraph();