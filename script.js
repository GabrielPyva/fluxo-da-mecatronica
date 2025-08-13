// Função principal que carrega os dados e inicializa o grafo
async function setupGraph() {
  const data = await d3.csv("grade-curricular.csv");
  const DATA = processData(data);
  initializeGraph(DATA);
}

// Função para processar os dados do CSV e transformá-los na estrutura do grafo
function processData(csvData) {
  const nodes = [];
  const links = [];
  const nodeIds = new Set(); // Usado para evitar nós duplicados

  csvData.forEach(row => {
    // Adiciona o nó apenas se ele tiver um ID e não tiver sido adicionado antes
    if (row.id && !nodeIds.has(row.id)) {
      nodes.push({
        id: row.id,
        name: row.name,
        semester: +row.semester, // O '+' converte a string para número
        area: row.area
      });
      nodeIds.add(row.id);
    }

    // Cria os links (arestas) com base nos pré-requisitos
    if (row.prerequisites) {
      const prereqs = row.prerequisites.split(','); // Separa múltiplos pré-requisitos
      prereqs.forEach(prereqId => {
        const cleanPrereqId = prereqId.trim(); // Remove espaços extras
        if (cleanPrereqId) {
          links.push({
            source: cleanPrereqId, // O pré-requisito é a origem
            target: row.id         // A matéria atual é o destino
          });
        }
      });
    }
  });

  return { nodes, links };
}


// Função que contém toda a lógica para desenhar e controlar o grafo
function initializeGraph(DATA) {

  /* ---------------------------------------------
  * Graph Setup
  * -------------------------------------------*/
  const svg = d3.select('#graph');
  const width = () => svg.node().clientWidth;
  const height = () => svg.node().clientHeight;

  const gRoot = svg.append('g');
  const gLinks = gRoot.append('g').attr('class','links');
  const gArrowheads = gRoot.append('g').attr('class', 'arrowheads');
  const gNodes = gRoot.append('g').attr('class','nodes');
  const gLabels = gRoot.append('g').attr('class','labels');

  const tooltip = d3.select('#tooltip');

  const color = d3.scaleOrdinal()
    .domain(['Core Math','Physics','Programming','Electrical','Mechanics','Labs','Other', 'Default', 'General'])
    .range(['#a0b7ff','#9ce1ff','#a2f2c3','#ffd08a','#f49fbf','#c1b4ff','#c2d0ff', '#aaaaaa', '#bbbbbb']);

  // Build indices and degrees
  const idToNode = new Map(DATA.nodes.map(d=>[d.id, d]));
  const indeg = new Map(DATA.nodes.map(d=>[d.id,0]));
  const outdeg = new Map(DATA.nodes.map(d=>[d.id,0]));
  DATA.links.forEach(l=>{ indeg.set(l.target, (indeg.get(l.target)||0)+1); outdeg.set(l.source, (outdeg.get(l.source)||0)+1);});

  // Compute levels (longest-path layering) for nicer y-position
  const level = computeLevels(DATA.nodes, DATA.links);

  // Force simulation
  const sim = d3.forceSimulation(DATA.nodes)
    .force('link', d3.forceLink(DATA.links).id(d=>d.id).distance(100).strength(0.13))
    .force('charge', d3.forceManyBody().strength(-250))
    .force('center', d3.forceCenter(0,0))
    .force('x', d3.forceX().strength(0.05))
    .force('y', d3.forceY().strength(0.2))
    .force('collide', d3.forceCollide(30));

  let isOrganized = false; // Variável para controlar o estado do grid

  // Zoom/pan
  svg.call(d3.zoom().scaleExtent([.25, 3]).on('zoom', (ev)=>{
    gRoot.attr('transform', ev.transform);
  }));

  let showArrows = true;

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

  // NOVA LÓGICA DE GRID E DRAG & DROP
  // ===================================

  // Calcula e armazena as posições do grid para cada nó
  calculateGridPositions(DATA.nodes);

  function calculateGridPositions(nodes) {
      const colWidth = 180;
      const rowHeight = 100;
      const nodesBySemester = d3.group(nodes, d => d.semester);

      nodesBySemester.forEach((nodesInSemester, semester) => {
          const colIndex = semester - 1;
          const numRows = nodesInSemester.length;
          nodesInSemester.forEach((node, rowIndex) => {
              node.gridX = colIndex * colWidth;
              // Centraliza a coluna de nós verticalmente
              node.gridY = (rowIndex - (numRows - 1) / 2) * rowHeight;
          });
      });
  }

  // Funções de Drag & Drop atualizadas
  node.call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended));

  function dragstarted(event, d) {
    if (!event.active) sim.alphaTarget(0.3).restart();
    // Se não estiver no modo grid, fixe a posição atual
    if (!isOrganized) {
      d.fx = d.x;
      d.fy = d.y;
    }
  }
  
  function dragged(event, d) {
    // Permite arrastar livremente, definindo fx e fy para a posição do mouse
    d.fx = event.x;
    d.fy = event.y;
  }
  
  function dragended(event, d) {
    if (!event.active) sim.alphaTarget(0);
    if (isOrganized) {
        // Se estiver no modo grid, o nó volta para sua posição no grid
        d.fx = d.gridX;
        d.fy = d.gridY;
    } else {
        // Se não estiver no modo grid, libera o nó
        d.fx = null;
        d.fy = null;
    }
  }

  // Controles
  d3.select('#btn-organize-sem').on('click', () => {
      isOrganized = !isOrganized;

      if (isOrganized) {
          // LIGA O MODO GRID
          sim.alphaTarget(0.3).restart();
          DATA.nodes.forEach(d => {
              d.fx = d.gridX;
              d.fy = d.gridY;
          });
      } else {
          // DESLIGA O MODO GRID
          sim.alphaTarget(0.3).restart();
          DATA.nodes.forEach(d => {
              d.fx = null;
              d.fy = null;
          });
      }
  });


  // ===================================
  // FIM DA NOVA LÓGICA

  function resetView(){
    isOrganized = false; // Garante que o modo grid seja desativado

    // Libera todos os nós da posição fixa
    DATA.nodes.forEach(d => {
        d.fx = null;
        d.fy = null;
    });

    sim.alpha(1).restart();

    const t = d3.zoomIdentity.translate(width()/2, height()/2).scale(1).translate(0,0);
    svg.transition().duration(500).call(d3.zoom().transform, t);
    setOpacity(DATA.nodes.map(d=>d.id));
  }
  svg.on('dblclick', resetView);

  // Tooltip
  node.on('mouseenter', (ev,d)=>{
    tooltip.style('opacity',1).style('transform','translateY(0)');
    tooltip.html(`<b>${d.name}</b><br/><span class="note">Area:</span> ${d.area}<br/><span class="note">Semester:</span> ${d.semester || '—'}`);
  }).on('mousemove', (ev)=>{
    const pad=12; tooltip.style('left', (ev.clientX+pad)+'px').style('top', (ev.clientY+pad)+'px');
  }).on('mouseleave', ()=>{
    tooltip.style('opacity',0).style('transform','translateY(6px)');
  });

  // Click focus & filters
  let focusedId = null;
  node.on('click', (ev,d)=>{
    focusedId = d.id;
    highlightNeighbors(d.id);
  });

  // Search
  d3.select('#btn-search').on('click', ()=>{
    const q = d3.select('#search').property('value').trim().toLowerCase();
    if(!q) return;
    const found = DATA.nodes.find(n=> n.id.toLowerCase()===q || n.name.toLowerCase().includes(q));
    if(found){
        focusedId = found.id;
        animateFocus(found);
        highlightNeighbors(found.id);
    }
  });
  d3.select('#search').on('keydown', (ev)=>{ if(ev.key==='Enter') d3.select('#btn-search').dispatch('click'); });

  // Outros Controles
  d3.select('#chk-labels').on('change', function(){
    const vis = this.checked ? 1 : 0; labels.transition().duration(250).style('opacity', vis);
  });
  d3.select('#chk-arrows').on('change', function(){
    showArrows = this.checked;
    arrowheads.style('display', this.checked ? 'block' : 'none');
  });
  d3.select('#chk-collide').on('change', function(){
    sim.force('collide', this.checked ? d3.forceCollide(22) : null).alpha(0.6).restart();
  });

  const depthInput = d3.select('#depth');
  const depthVal = d3.select('#depthVal');
  depthInput.on('input', function(){ depthVal.text(this.value); });

  d3.select('#btn-neighbors').on('click', ()=>{
    if(!focusedId) return; showNeighbors(focusedId);
  });
  d3.select('#btn-prereq').on('click', ()=>{
    if(!focusedId) return; showChain(focusedId, 'up', +depthInput.property('value'));
  });
  d3.select('#btn-depend').on('click', ()=>{
    if(!focusedId) return; showChain(focusedId, 'down', +depthInput.property('value'));
  });
  d3.select('#btn-showAll').on('click', ()=>{ focusedId=null; resetView(); });

  // Isolate toggle: hide others vs fade
  function setOpacity(visibleIds){
    const vis = new Set(visibleIds);
    const isolate = d3.select('#chk-isolate').property('checked');
    const dur = 300;
    node.transition().duration(dur).style('opacity', n=> vis.has(n.id) ? 1 : (isolate? 0 : .12));
    labels.transition().duration(dur).style('opacity', n=> vis.has(n.id) ? 1 : (isolate? 0 : .12));
    link.transition().duration(dur).style('opacity', l=> (vis.has(l.source.id) && vis.has(l.target.id)) ? .9 : (isolate? 0 : .06));
    arrowheads.transition().duration(dur).style('opacity', l=> (vis.has(l.source.id) && vis.has(l.target.id)) ? .9 : (isolate? 0 : .06));
  }

  function animateFocus(target){
    const t = d3.zoomTransform(svg.node());
    const k = Math.min(2.2, Math.max(1.2, t.k*1.2));
    const dx = width()/2 - target.x*t.k - t.x;
    const dy = height()/2 - target.y*t.k - t.y;
    const newTransform = d3.zoomIdentity.translate(t.x+dx, t.y+dy).scale(k);
    svg.transition().duration(600).ease(d3.easeCubicOut).call(d3.zoom().transform, newTransform);
  }

  function neighborsOf(id){
    const pred = DATA.links.filter(l=>l.target.id===id).map(l=>l.source.id);
    const succ = DATA.links.filter(l=>l.source.id===id).map(l=>l.target.id);
    return { pred:new Set(pred), succ:new Set(succ) };
  }

  function highlightNeighbors(id){
    const {pred, succ} = neighborsOf(id);
    const visible = new Set([id, ...pred, ...succ]);
    setOpacity([...visible]);
  }

  function showNeighbors(id){
    highlightNeighbors(id);
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

  function computeLevels(nodes, links){
    const adjIn = new Map(nodes.map(n=>[n.id, []]));
    links.forEach(l=>{
        if (!adjIn.has(l.target)) adjIn.set(l.target, []);
        adjIn.get(l.target).push(l.source);
    });

    const indegLocal = new Map(nodes.map(n=>[n.id, 0]));
    links.forEach(l=> indegLocal.set(l.target, (indegLocal.get(l.target)||0)+1));
    const q = [];
    nodes.forEach(n=>{ if((indegLocal.get(n.id)||0)===0) q.push(n.id); });
    const order = [];
    while(q.length){
        const v = q.shift(); order.push(v);
        for(const l of links){
            if(l.source===v){
                indegLocal.set(l.target, indegLocal.get(l.target)-1);
                if(indegLocal.get(l.target)===0) q.push(l.target);
            }
        }
    }

    const level = new Map(nodes.map(n=>[n.id, 0]));
    for(const v of order){
        const preds = adjIn.get(v);
        if(!preds || preds.length===0) {
            level.set(v, 0);
        } else {
            const maxLevel = Math.max(...preds.map(p => level.get(p) + 1));
            level.set(v, maxLevel);
        }
    }
    return level;
  }

  // Initial state
  d3.select('#nodeCount').text(DATA.nodes.length);
  resetView();
}

// Inicia todo o processo
setupGraph();