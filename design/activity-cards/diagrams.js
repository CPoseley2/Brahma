const esc = value => String(value).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const cone = (x, y, color = "#f1b82d") => `<path d="M${x} ${y - 13}L${x - 12} ${y + 10}H${x + 12}Z" fill="${color}" stroke="#fff" stroke-width="2"/>`;
const ball = (x, y) => `<g transform="translate(${x} ${y})"><circle r="13" fill="#f8f8f4" stroke="#101214" stroke-width="3"/><path d="M0-5 5-1 3 5H-3L-5-1Z" fill="#111"/><path d="M0-5 0-12M5-1 12-4M3 5 8 11M-3 5-8 11M-5-1-12-4" stroke="#111" stroke-width="2"/></g>`;
const player = (x, y, color, n = "", ring = "#fff") => `<g transform="translate(${x} ${y})"><circle r="23" fill="${color}" stroke="${ring}" stroke-width="5"/><circle r="7" cy="-5" fill="#fff" opacity=".92"/><path d="M-10 12Q0 1 10 12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>${n ? `<text y="7" text-anchor="middle" fill="#fff" font-size="15" font-weight="900">${n}</text>` : ""}</g>`;
const gate = (x, y, vertical = false, color = "#f1b82d") => vertical ? cone(x, y - 22, color) + cone(x, y + 22, color) : cone(x - 22, y, color) + cone(x + 22, y, color);
const goal = (x, y, rotate = 0) => `<g transform="translate(${x} ${y}) rotate(${rotate})"><path d="M-32-20H32V20H-32Z" fill="none" stroke="#fff" stroke-width="6"/><path d="M-32-20 0 0 32-20M-32 20 0 0 32 20" fill="none" stroke="#fff" stroke-width="2" opacity=".7"/></g>`;
const arrow = (x1, y1, x2, y2, color = "#fff", dash = "") => `<path d="M${x1} ${y1}Q${(x1 + x2) / 2 + (y1 - y2) * .12} ${(y1 + y2) / 2 + (x2 - x1) * .12} ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" ${dash ? `stroke-dasharray="${dash}"` : ""} marker-end="url(#arrow)"/>`;
const label = (x, y, text, anchor = "middle") => `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="#fff" font-size="20" font-weight="850" paint-order="stroke" stroke="#173e2b" stroke-width="6">${esc(text)}</text>`;
const zone = (x, y, w, h, color, text = "") => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${color}" opacity=".24" stroke="${color}" stroke-width="5" stroke-dasharray="12 9"/>${text ? label(x + w / 2, y + h / 2 + 7, text) : ""}</g>`;
const target = (x, y, color = "#f1b82d") => `<g transform="translate(${x} ${y})"><circle r="31" fill="none" stroke="${color}" stroke-width="7"/><circle r="15" fill="none" stroke="#fff" stroke-width="5"/><circle r="5" fill="${color}"/></g>`;
const defs = theme => `<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="${theme.color}"/></marker><pattern id="grass" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M0 0H80M0 0V80" stroke="#fff" stroke-width="1" opacity=".055"/></pattern></defs>`;
const pair = (x, y, theme, dx = 62) => player(x - dx / 2, y, theme.color) + player(x + dx / 2, y, "#181b1d", "", theme.color);
const scatter = (theme, count = 6) => Array.from({ length: count }, (_, i) => {
  const x = 150 + ((i * 137) % 700), y = 120 + ((i * 173) % 470);
  return player(x, y, i % 2 ? theme.color : "#181b1d", "", i % 2 ? "#fff" : theme.color) + ball(x + 31, y + 23);
}).join("");

function arrival(theme) {
  return zone(40, 40, 150, 120, "#ef4b42", "RED HOME") + zone(770, 40, 150, 120, "#f2c12e", "GOLD HOME") +
    zone(40, 570, 150, 120, "#2878d0", "BLUE HOME") + zone(770, 570, 150, 120, "#8f6a45", "RIVER HOME") +
    scatter(theme, 6) + arrow(210, 220, 115, 130, theme.color) + arrow(510, 330, 845, 115, theme.color) + arrow(700, 500, 845, 625, theme.color) + label(480, 374, "EXPLORE • CHOOSE • RETURN");
}
function traffic(theme) {
  const signs = [["GREEN","GO","#16944a"],["YELLOW","TINY TOUCHES","#f2c12e"],["RED","STOP","#d74436"],["BLUE","TURN","#2878d0"]];
  return signs.map(([a,b,c],i) => `<g transform="translate(${125+i*235} 105)"><circle r="42" fill="${c}" stroke="#fff" stroke-width="5"/>${label(0,7,b)}</g>`).join("") +
    scatter(theme,7) + arrow(150,260,330,355,theme.color)+arrow(470,520,620,400,theme.color)+arrow(810,290,700,195,theme.color) +
    label(480,690,"HEAD UP • FIND EMPTY ROAD • CONTROL THE STOP");
}
function habitats(theme) {
  return zone(40,45,190,140,"#f2c12e","CHEETAH")+zone(730,45,190,140,"#2878d0","PENGUIN")+
    zone(40,540,190,140,"#d74436","CRAB")+zone(730,540,190,140,"#16944a","FROG")+
    scatter(theme,6)+arrow(265,280,165,155,theme.color)+arrow(650,270,815,155,theme.color)+arrow(400,500,150,610,theme.color)+arrow(650,480,825,610,theme.color)+label(480,370,"MOVE • IMAGINE • CHOOSE");
}
function freeze(theme) {
  return scatter(theme,8)+`<g transform="translate(480 355)"><circle r="98" fill="${theme.color}" opacity=".22" stroke="${theme.color}" stroke-width="7"/><text text-anchor="middle" y="-12" fill="#fff" font-size="28" font-weight="900">RED LIGHT!</text><text text-anchor="middle" y="28" fill="${theme.color}" font-size="25" font-weight="900">SOLE • KNEE • ELBOW</text></g>`+label(480,690,"SLOW DOWN • FREEZE WITH CONTROL • LAUGH & RESET");
}
function islands(theme) {
  const pts=[[135,125],[370,135],[700,120],[830,310],[600,340],[300,335],[140,540],[420,585],[760,570]];
  return pts.map(([x,y],i)=>`<ellipse cx="${x}" cy="${y}" rx="48" ry="31" fill="${i%2?theme.color:"#f2c12e"}" opacity=".35" stroke="#fff" stroke-width="4" stroke-dasharray="9 7"/>`).join("")+
    scatter(theme,6)+arrow(240,240,360,145,theme.color)+arrow(620,500,750,570,theme.color)+label(480,690,"STORM! • FIND AN ISLAND • SHARE THE SHORE");
}
function mud(theme) {
  return player(480,150,"#7c4d2e","M","#fff")+player(735,410,"#7c4d2e","M","#fff")+
    scatter(theme,5)+`<text x="250" y="360" fill="#fff" font-size="64" font-weight="900">★</text><text x="610" y="560" fill="#fff" font-size="64" font-weight="900">★</text>`+
    gate(310,350,false,theme.color)+gate(670,550,false,theme.color)+arrow(150,500,290,365,theme.color)+arrow(820,620,690,565,theme.color)+label(480,690,"TAG • FREEZE • NOTICE • RESCUE");
}
function shores(theme) {
  return zone(30,65,170,600,theme.color,"SAFE SHORE")+zone(760,65,170,600,"#d74436","SAFE SHORE")+
    player(470,260,"#181b1d","S",theme.color)+player(520,480,"#181b1d","S",theme.color)+
    [170,300,430,560].map((y,i)=>player(135,y,theme.color)+ball(170,y+18)+arrow(205,y,720,y+(i%2?35:-35),theme.color)).join("")+
    label(480,690,"CHANGE SPEED • PROTECT • REJOIN RIGHT AWAY");
}
function giants(theme) {
  return [240,480,720].map((x,i)=>`<g>${player(x,280,"#181b1d","G",theme.color)}${label(x,235,"GIANT")}</g>`).join("")+
    [160,390,620,830].map((x,i)=>player(x,590,theme.color)+ball(x+30,610)+arrow(x,555,x+(i%2?50:-50),340,theme.color)).join("")+
    goal(480,75,0)+label(480,690,"TINY TOUCHES • FREEZE • EXPLODE TO CASTLE");
}
function volcanoes(theme) {
  const pts=[[145,155],[315,125],[520,160],[760,130],[845,300],[650,355],[420,330],[190,380],[110,585],[350,570],[590,590],[820,555]];
  return pts.map(([x,y],i)=>i%2?cone(x,y,theme.color):`<circle cx="${x}" cy="${y}" r="19" fill="none" stroke="#fff" stroke-width="6"/>`).join("")+
    player(250,500,theme.color)+player(710,475,"#181b1d","",theme.color)+arrow(280,475,415,350,theme.color)+arrow(680,455,650,375,theme.color)+label(480,690,"FLIP • FIND SPACE • SWAP JOBS • CELEBRATE");
}
function gates(theme, paired = false) {
  const points = [[160,140],[390,120],[660,155],[830,290],[620,380],[350,360],[140,500],[410,600],[710,590]];
  return points.map(([x,y], i) => gate(x,y,i%3===0,i%2?theme.color:"#f1b82d")).join("") +
    (paired ? pair(185,260,theme) + ball(205,292) + pair(690,495,theme) + ball(710,527) : scatter(theme,5)) +
    arrow(185,280,345,355,theme.color,paired?"12 9":"") + arrow(690,515,705,575,theme.color,paired?"12 9":"") + label(480,690,paired?"PASS THROUGH • MEET • CHOOSE":"FIND AN OPEN GATE");
}
function targets(theme, castle = false) {
  const xs = [155,360,575,790];
  return xs.map((x,i) => castle ? `<g>${cone(x-17,145,theme.color)}${cone(x+17,145,theme.color)}${cone(x,117,"#fff")}${label(x,85,"CASTLE")}</g>` : target(x,135,theme.color)).join("") +
    xs.map((x,i) => player(x-35+(i%2)*40,570,i%2?theme.color:"#181b1d","",i%2?"#fff":theme.color)+ball(x+15,550)+arrow(x,525,x,190,theme.color)).join("") +
    label(480,690,castle?"DRIBBLE • PLANT • STRIKE • REBUILD":"LOOK • AIM • STRIKE • TRY AGAIN");
}
function goalHunt(theme) {
  return goal(480,55,0)+goal(480,675,0)+goal(45,365,90)+goal(915,365,90)+scatter(theme,6)+
    arrow(270,250,480,95,theme.color)+arrow(650,245,870,365,theme.color)+arrow(350,510,480,635,theme.color)+label(480,370,"SCORE • CELEBRATE • FIND A NEW PORTAL");
}
function cannon(theme) {
  return [[160,130],[390,135],[650,130],[820,300],[650,500],[360,520]].map(([x,y],i)=>gate(x,y,i%3===0,theme.color)).join("")+
    scatter(theme,6)+arrow(180,360,350,150,theme.color)+arrow(520,430,635,165,theme.color)+arrow(760,600,660,520,theme.color)+label(480,690,"LOOK • STRIKE THROUGH THE GATE • CHASE");
}
function smallGame(theme, four = false, endZones = false) {
  const ends = endZones ? zone(25,70,125,590,theme.color,"END ZONE")+zone(810,70,125,590,"#d74436","END ZONE") :
    (four ? goal(38,205,90)+goal(38,525,90)+goal(922,205,90)+goal(922,525,90) : goal(38,365,90)+goal(922,365,90));
  return ends + `<path d="M480 50V680" stroke="#fff" stroke-width="4" opacity=".5"/><circle cx="480" cy="365" r="82" fill="none" stroke="#fff" stroke-width="4" opacity=".5"/>` +
    player(300,260,theme.color)+player(310,470,theme.color)+player(660,250,"#181b1d","",theme.color)+player(650,480,"#181b1d","",theme.color)+ball(475,370) +
    arrow(445,355,four?120:85,four?205:365,theme.color)+arrow(510,385,four?840:875,four?525:365,theme.color)+label(480,704,four?"TWO GOALS • LOOK • CHOOSE":"PLAY • SOLVE • RESTART");
}
function oneVOne(theme, gatesOnly = false) {
  return (gatesOnly?gate(885,250,true,theme.color)+gate(885,500,true,theme.color):goal(900,365,90))+
    player(245,330,theme.color)+ball(290,365)+player(420,395,"#181b1d","",theme.color)+arrow(305,350,gatesOnly?840:850,gatesOnly?245:365,theme.color)+
    (gatesOnly?arrow(305,380,840,500,theme.color):"")+label(480,690,gatesOnly?"TWO DOORS • ATTACK OPEN SPACE • SWITCH":"GO TO GOAL • TRY A MOVE • RECOVER");
}
function numbers(theme) {
  return goal(45,365,90)+goal(915,365,90)+[190,280,370].map((y,i)=>player(150,y,theme.color,String(i+1))).join("")+
    [190,280,370].map((y,i)=>player(810,y,"#181b1d",String(i+1),theme.color)).join("")+player(390,500,theme.color,"2")+player(570,500,"#181b1d","2",theme.color)+ball(480,405)+
    arrow(390,475,465,420,theme.color)+arrow(570,475,495,420,theme.color)+label(480,690,"CALL A NUMBER • PLAY • EXIT • NEW ADVENTURE");
}
function partners(theme, mirror = false) {
  return mirror
    ? `<path d="M480 70V660" stroke="${theme.color}" stroke-width="8" stroke-dasharray="16 12"/>` + [180,360,540].map(y => player(355,y,theme.color)+ball(392,y+16)+player(605,y,"#181b1d","",theme.color)+ball(568,y+16)+arrow(405,y,555,y,theme.color,"10 9")).join("") + label(480,700,"WATCH • COPY • SWITCH")
    : [170,370,570].map((y,i) => pair(260+i*175,y,theme)+ball(290+i*175,y+22)+arrow(245+i*175,y+30,410+i*110,y+95,theme.color)).join("") + label(480,700,"LEAD • FOLLOW • LEAVE FRIENDLY SPACE");
}
function channels(theme) {
  return zone(35,55,145,625,theme.color,"WIDE RIVER")+zone(780,55,145,625,theme.color,"WIDE RIVER")+smallGame(theme).replace(/<text[^>]*>PLAY[^<]*<\/text>/,"")+arrow(330,360,120,470,theme.color)+arrow(630,380,840,240,theme.color)+label(480,704,"FIND GRASS AWAY FROM THE CROWD");
}
function festival(theme) {
  return [[40,65],[500,65],[40,390],[500,390]].map(([x,y],i)=>`<g><rect x="${x}" y="${y}" width="420" height="275" rx="22" fill="none" stroke="#fff" stroke-width="4"/><path d="M${x+210} ${y+15}V${y+260}" stroke="#fff" stroke-width="2" opacity=".45"/>${goal(x+18,y+137,90)}${goal(x+402,y+137,90)}${player(x+145,y+105,theme.color)}${player(x+275,y+175,"#181b1d","",theme.color)}${ball(x+210,y+138)}</g>`).join("")+
    label(480,372,"4–5 MINUTES • WATER • MIX TEAMS • PLAY AGAIN");
}
function circuit(theme) {
  return zone(35,55,420,290,theme.color,"GATES")+zone(505,55,420,290,"#f2c12e","CASTLE SHOTS")+
    zone(35,390,420,290,"#d74436","PARTNER MIRRORS")+zone(505,390,420,290,"#2878d0","3v3 GAME")+
    gate(245,210)+pair(245,265,theme)+target(715,210,"#f2c12e")+player(715,285,theme.color)+pair(245,530,theme)+goal(535,535,90)+goal(895,535,90)+ball(715,535)+label(480,708,"PLAYERS LEAD • FAMILIES FOLLOW • CELEBRATE");
}
function generic(theme, id) {
  if (id === "arrival-adventure" || id === "pirate-ships") return arrival(theme);
  if (id === "traffic-lights") return traffic(theme);
  if (id === "animal-moves") return habitats(theme);
  if (id === "body-part-freeze") return freeze(theme);
  if (id === "treasure-island") return islands(theme);
  if (id === "mud-monsters") return mud(theme);
  if (id === "sharks-minnows") return shores(theme);
  if (id === "sleeping-giants") return giants(theme);
  if (id === "volcano-craters") return volcanoes(theme);
  if (id === "gates-galore") return gates(theme);
  if (["castle-crashers"].includes(id)) return targets(theme,true);
  if (id === "goal-hunters") return goalHunt(theme);
  if (id === "cannonball") return cannon(theme);
  if (id === "knock-cones") return targets(theme,false);
  if (["follow-leader"].includes(id)) return partners(theme,false);
  if (["mirror-moves"].includes(id)) return partners(theme,true);
  if (["team-gates"].includes(id)) return gates(theme,true);
  if (id === "one-v-one-gates") return oneVOne(theme,true);
  if (id === "one-v-one-goal") return oneVOne(theme,false);
  if (id === "numbers-game") return numbers(theme);
  if (id === "four-goal-game") return smallGame(theme,true);
  if (["end-zone"].includes(id)) return smallGame(theme,false,true);
  if (["wide-river"].includes(id)) return channels(theme);
  if (id === "scrimmage-festival") return festival(theme);
  if (id === "family-finale") return circuit(theme);
  if (id === "three-v-three") return smallGame(theme);
  if (id === "clean-room") return zone(35,55,425,625,theme.color,"TEAM SPACE")+zone(500,55,425,625,"#d74436","TEAM SPACE")+scatter(theme,8)+label(480,704,"PLAY • RESET • REBUILD TOGETHER");
  if (["robin-hood","capture-castle"].includes(id)) return zone(60,85,170,140,theme.color,"HOME")+zone(730,85,170,140,"#d74436","HOME")+target(480,365,"#f2c12e")+scatter(theme,6)+arrow(310,440,475,385,theme.color)+arrow(650,455,500,385,theme.color)+label(480,704,"GO TOGETHER • BRING TREASURE HOME");
  return smallGame(theme);
}

export function renderDiagram(id, theme) {
  return `<svg class="field" viewBox="0 0 960 730" role="img" aria-label="Field setup diagram for ${esc(id)}">${defs(theme)}<rect x="12" y="12" width="936" height="706" rx="28" fill="url(#grass)" stroke="#fff" stroke-width="5" opacity=".95"/>${generic(theme,id)}</svg>`;
}
