/* ---------------------------------------------
   * DATA — Replace with your real curriculum.
   * Nodes: { id, name, semester, area }
   * Links: { source: prerequisiteId, target: courseId }
   * Direction: prereq → course that requires it.
   * -------------------------------------------*/
const DATA = {
nodes: [
    { id: 'CALC1', name: 'Calculus I', semester: 1, area: 'Core Math' },
    { id: 'ALG',   name: 'Linear Algebra', semester: 1, area: 'Core Math' },
    { id: 'PHY1',  name: 'Physics I', semester: 1, area: 'Physics' },
    { id: 'PROG1', name: 'Programming I', semester: 1, area: 'Programming' },
    { id: 'CALC2', name: 'Calculus II', semester: 2, area: 'Core Math' },
    { id: 'PHY2',  name: 'Physics II', semester: 2, area: 'Physics' },
    { id: 'DS',    name: 'Data Structures', semester: 2, area: 'Programming' },
    { id: 'DIFEQ', name: 'Differential Equations', semester: 3, area: 'Core Math' },
    { id: 'STAT',  name: 'Probability & Statistics', semester: 3, area: 'Core Math' },
    { id: 'ELEC1', name: 'Circuits I', semester: 3, area: 'Electrical' },
    { id: 'MECH1', name: 'Statics', semester: 3, area: 'Mechanics' },
    { id: 'ELEC2', name: 'Circuits II', semester: 4, area: 'Electrical' },
    { id: 'SIGN',  name: 'Signals & Systems', semester: 4, area: 'Electrical' },
    { id: 'MECH2', name: 'Dynamics', semester: 4, area: 'Mechanics' },
    { id: 'CTRL',  name: 'Control Systems', semester: 5, area: 'Electrical' },
    { id: 'THERM', name: 'Thermodynamics', semester: 5, area: 'Mechanics' },
    { id: 'EMAG',  name: 'Electromagnetics', semester: 5, area: 'Electrical' },
    { id: 'LAB1',  name: 'Electronics Lab', semester: 5, area: 'Labs' },
    { id: 'EMBED', name: 'Embedded Systems', semester: 6, area: 'Programming' },
    { id: 'DSP',   name: 'Digital Signal Processing', semester: 6, area: 'Electrical' },
    { id: 'ROBO',  name: 'Intro to Robotics', semester: 7, area: 'Other' },
    { id: 'CAP',   name: 'Capstone Project', semester: 8, area: 'Other' },
],
links: [
    { source:'CALC1', target:'CALC2' },
    { source:'CALC2', target:'DIFEQ' },
    { source:'CALC2', target:'STAT' },
    { source:'PHY1',  target:'PHY2' },
    { source:'PROG1', target:'DS' },
    { source:'CALC2', target:'ELEC1' },
    { source:'PHY2',  target:'ELEC1' },
    { source:'ELEC1', target:'ELEC2' },
    { source:'ELEC2', target:'SIGN' },
    { source:'DIFEQ', target:'SIGN' },
    { source:'MECH1', target:'MECH2' },
    { source:'PHY1',  target:'MECH1' },
    { source:'SIGN',  target:'CTRL' },
    { source:'ELEC2', target:'CTRL' },
    { source:'SIGN',  target:'DSP' },
    { source:'ELEC2', target:'EMAG' },
    { source:'ELEC2', target:'LAB1' },
    { source:'DS',    target:'EMBED' },
    { source:'CTRL',  target:'ROBO' },
    { source:'EMBED', target:'ROBO' },
    { source:'ROBO',  target:'CAP' },
    { source:'LAB1',  target:'CAP' },
    { source:'STAT',  target:'CAP' },
]
};

/* ---------------------------------------------
* Graph Setup
* -------------------------------------------*/
const svg = d3.select('#graph');
const width = () => svg.node().clientWidth;
const height = () => svg.node().clientHeight;

const defs = svg.append('defs');
createArrows();

const gRoot = svg.append('g');
const gLinks = gRoot.append('g').attr('class','links');
const gNodes = gRoot.append('g').attr('class','nodes');
const gLabels = gRoot.append('g').attr('class','labels');

const tooltip = d3.select('#tooltip');

const color = d3.scaleOrdinal()
.domain(['Core Math','Physics','Programming','Electrical','Mechanics','Labs','Other'])
.range(['#a0b7ff','#9ce1ff','#a2f2c3','#ffd08a','#f49fbf','#c1b4ff','#c2d0ff']);

// Build indices and degrees
const idToNode = new Map(DATA.nodes.map(d=>[d.id, d]));
const indeg = new Map(DATA.nodes.map(d=>[d.id,0]));
const outdeg = new Map(DATA.nodes.map(d=>[d.id,0]));
DATA.links.forEach(l=>{ indeg.set(l.target, (indeg.get(l.target)||0)+1); outdeg.set(l.source, (outdeg.get(l.source)||0)+1);});

// Compute levels (longest-path layering) for nicer y-position
const level = computeLevels(DATA.nodes, DATA.links);

// Force simulation
const sim = d3.forceSimulation(DATA.nodes)
.force('link', d3.forceLink(DATA.links).id(d=>d.id).distance(68).strength(0.13))
.force('charge', d3.forceManyBody().strength(-140))
.force('center', d3.forceCenter(0,0))
.force('x', d3.forceX(d=> (d.semester? (d.semester-1) : 0) * 120).strength(.05))
.force('y', d3.forceY(d=> level.get(d.id)*90).strength(.2))
.force('collide', d3.forceCollide(22));

// Zoom/pan
svg.call(d3.zoom().scaleExtent([.25, 3]).on('zoom', (ev)=>{
gRoot.attr('transform', ev.transform);
}));

// Arrow toggle
let showArrows = true;

// Links
const link = gLinks.selectAll('path').data(DATA.links).join('path')
.attr('stroke', 'rgba(255,255,255,.25)')
.attr('fill', 'none')
.attr('marker-end', showArrows ? 'url(#arrow)' : null)
.attr('stroke-width', 1.4);

// Nodes
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
link.attr('d', d=> linkArc(d));
node.attr('transform', d=> `translate(${d.x},${d.y})`);
labels.attr('x', d=>d.x).attr('y', d=>d.y-16);
}

function linkArc(d){
// draw a small curved arc for nicer readability
const dx = (d.target.x - d.source.x), dy = (d.target.y - d.source.y);
const dr = Math.sqrt(dx*dx + dy*dy) * 0.35; // radius
return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
}

function createArrows(){
const m = defs.append('marker')
    .attr('id','arrow')
    .attr('viewBox','0 -5 10 10')
    .attr('refX', 18)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient','auto');
m.append('path').attr('d','M0,-5L10,0L0,5').attr('fill','rgba(255,255,255,.6)');
}

// Fit & reset
function resetView(){
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

// Controls
d3.select('#chk-labels').on('change', function(){
const vis = this.checked ? 1 : 0; labels.transition().duration(250).style('opacity', vis);
});
d3.select('#chk-arrows').on('change', function(){
showArrows = this.checked; link.attr('marker-end', showArrows ? 'url(#arrow)' : null);
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
d3.select('#btn-showAll').on('click', ()=>{ focusedId=null; setOpacity(DATA.nodes.map(d=>d.id)); });

// Isolate toggle: hide others vs fade
function setOpacity(visibleIds){
const vis = new Set(visibleIds);
const isolate = d3.select('#chk-isolate').property('checked');
const dur = 300;
node.transition().duration(dur).style('opacity', n=> vis.has(n.id) ? 1 : (isolate? 0 : .12));
labels.transition().duration(dur).style('opacity', n=> vis.has(n.id) ? 1 : (isolate? 0 : .12));
link.transition().duration(dur).style('opacity', l=> (vis.has(l.source.id) && vis.has(l.target.id)) ? .9 : (isolate? 0 : .06));
}

function animateFocus(target){
// gentle zoom towards the target
const t = d3.zoomTransform(svg.node());
const k = Math.min(2.2, Math.max(1.2, t.k*1.2));
const dx = width()/2 - target.x*t.k - t.x;
const dy = height()/2 - target.y*t.k - t.y;
const newTransform = d3.zoomIdentity.translate(t.x+dx, t.y+dy).scale(k);
svg.transition().duration(600).ease(d3.easeCubicOut).call(d3.zoom().transform, newTransform);
}

function neighborsOf(id){
const pred = DATA.links.filter(l=>l.target===id).map(l=>l.source);
const succ = DATA.links.filter(l=>l.source===id).map(l=>l.target);
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
        if(dir==='up' && l.target===v && !visited.has(l.source)) next.add(l.source);
        if(dir==='down' && l.source===v && !visited.has(l.target)) next.add(l.target);
    }
    }
    next.forEach(n=>visited.add(n));
    frontier = next;
    if(next.size===0) break;
}
setOpacity([...visited]);
}

// Helpers
function computeLevels(nodes, links){
const adjIn = new Map(nodes.map(n=>[n.id, []]));
const out = new Map(nodes.map(n=>[n.id, 0]));
links.forEach(l=>{ adjIn.get(l.target).push(l.source); out.set(l.source, (out.get(l.source)||0)+1); });

// Kahn for topo order
const indegLocal = new Map(nodes.map(n=>[n.id, 0]));
links.forEach(l=> indegLocal.set(l.target, (indegLocal.get(l.target)||0)+1));
const q = [];
nodes.forEach(n=>{ if((indegLocal.get(n.id)||0)===0) q.push(n.id); });
const order = [];
while(q.length){
    const v = q.shift(); order.push(v);
    for(const l of links){ if(l.source===v){ indegLocal.set(l.target, indegLocal.get(l.target)-1); if(indegLocal.get(l.target)===0) q.push(l.target); } }
}

const level = new Map(nodes.map(n=>[n.id, 0]));
for(const v of order){
    const preds = adjIn.get(v);
    if(preds.length===0) level.set(v, 0);
    else level.set(v, Math.max(...preds.map(p=> level.get(p)+1)));
}
return level;
}

// Initial state
d3.select('#nodeCount').text(DATA.nodes.length);
resetView();

/* ---------------------------------------------
* How to replace the data
* 1) Keep the same shape of DATA with your course ids, names, semesters, areas.
* 2) Links use ids (source prereq → target course).
* 3) The layout will adapt automatically.
* -------------------------------------------*/