(()=>{'use strict';
const KEY='nutritrack_v1'; const MICRO={calcium:'Cálcio (mg)',iron:'Ferro (mg)',magnesium:'Magnésio (mg)',potassium:'Potássio (mg)',sodium:'Sódio (mg)',vitaminc:'Vitamina C (mg)'};
const defaultFoods=()=>JSON.parse(JSON.stringify(window.NUTRI_DEFAULT_FOODS||[]));
const initial=()=>({version:1,foods:defaultFoods(),entries:[],weights:[],waterEntries:[],goals:{water:2500,kcal:2200,protein:160,carbs:240,fat:70,fiber:30,height:1.71,age:null,sex:"",activity:1.2,deficit:"moderate"}});
let data;try{data=JSON.parse(localStorage.getItem(KEY))||initial()}catch{data=initial()}
if(!validImport(data)){alert('Dados locais inconsistentes. Os dados originais foram preservados no navegador; importe um backup válido.');data=initial()}else data=normalizeData(data);
const existingFoodIds=new Set(data.foods.map(f=>f.id));
const missingDefaults=defaultFoods().filter(f=>!existingFoodIds.has(f.id)&&!data.foods.some(x=>x.sourceId===f.sourceId));
if(missingDefaults.length){data.foods.push(...missingDefaults);try{localStorage.setItem(KEY,JSON.stringify(data))}catch{alert('A biblioteca padrão foi carregada, mas não pôde ser salva. Verifique o armazenamento.')}}

const $=id=>document.getElementById(id),today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')},num=n=>Number(n)||0,fmt=n=>num(n).toLocaleString('pt-BR',{maximumFractionDigits:1}),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}_${Math.random().toString(36).slice(2)}`;
function save(){try{localStorage.setItem(KEY,JSON.stringify(data));return true}catch{alert('Não foi possível salvar. Libere espaço no navegador e tente novamente.');return false}}
function commit(mutator){const previous=data;try{data=JSON.parse(JSON.stringify(data));mutator();if(!validImport(data))throw Error('Dados inválidos');if(save())return true}catch(err){alert('Operação não concluída: '+err.message)}data=previous;return false}
function toast(t){$('toast').textContent=t;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',2500)}
function dateLabel(s){if(!s)return '';const [y,m,d]=s.split('-');return `${d}/${m}/${y}`}
let foodSearchOpen=false;
function foodUses(){const counts=new Map();for(const e of data.entries)counts.set(e.foodId,(counts.get(e.foodId)||0)+1);return counts}
function selectFood(){
 const search=$('diaryFoodSearch'),list=$('foodSuggestions'),selected=$('foodSelect');
 const q=norm(search.value.trim());
 if(!foodSearchOpen){list.hidden=true;search.setAttribute('aria-expanded','false');return}
 const counts=foodUses();
 const matched=data.foods.filter(f=>!q||norm(f.name).includes(q));
 matched.sort((a,b)=>q?a.name.localeCompare(b.name,'pt-BR'):(counts.get(b.id)||0)-(counts.get(a.id)||0)||a.name.localeCompare(b.name,'pt-BR'));
 const shown=matched.slice(0,5);
 const hasHistory=[...counts.values()].some(n=>n>0);
 const title=q?'Resultados da pesquisa':hasHistory?'Mais utilizados':'Sugestões para começar';
 list.innerHTML=`<div class="food-suggestions-title">${title}</div>`+(shown.length?shown.map(f=>`<button type="button" class="food-suggestion" role="option" data-food-id="${escape(f.id)}"><span><b>${escape(f.name)}</b><small>${f.kcal==null?'Calorias não informadas':fmt(f.kcal)+' kcal / 100 g'}</small></span>${!q&&hasHistory?`<span class="usage">${counts.get(f.id)||0} usos</span>`:''}</button>`).join(''):'<p class="muted" style="padding:8px 10px">Nenhum alimento encontrado.</p>');
 list.hidden=false;search.setAttribute('aria-expanded','true');
}
function chooseFood(id){const food=data.foods.find(f=>f.id===id);if(!food)return;$('foodSelect').value=id;$('diaryFoodSearch').value=food.name;$('foodSelectedHint').textContent='✓ Alimento selecionado';foodSearchOpen=false;selectFood();}
function closeFoodSearch(){foodSearchOpen=false;selectFood()}

function nutrients(e){const f=data.foods.find(x=>x.id===e.foodId);const values={};for(const k of ['kcal','protein','carbs','fat','fiber',...Object.keys(MICRO)])values[k]=f&&f[k]!==null&&f[k]!==undefined?num(f[k])*num(e.grams)/100:null;return values}
function renderDashboard(){const day=$('day').value,items=data.entries.filter(e=>e.date===day);const total={kcal:0,protein:0,carbs:0,fat:0,fiber:0};for(const e of items){const n=nutrients(e);for(const k in total)total[k]+=num(n[k])}
const labels={kcal:'Calorias',protein:'Proteínas',carbs:'Carboidratos',fat:'Gorduras'};
const lastWeight=data.weights.slice().sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
const g=data.goals,weight=num(lastWeight?.weight),heightCm=num(g.height)*100,age=num(g.age);
const tmb=weight>0&&heightCm>=50&&heightCm<=270&&age>=18&&age<=110&&['male','female'].includes(g.sex)
 ? Math.round(10*weight+6.25*heightCm-5*age+(g.sex==='male'?5:-161)):null;
const tmbCard=`<div class="stat" aria-label="Taxa Metabólica Basal estimada"><span>TMB</span><strong>${tmb===null?'—':fmt(tmb)+' kcal'}</strong><span class="muted">${tmb===null?'Preencha seus dados na aba Perfil':'Estimativa diária em repouso'}</span></div>`;
const missing=items.some(e=>{const n=nutrients(e);return ['kcal','protein','carbs','fat'].some(k=>n[k]===null)});$('stats').innerHTML=(missing?'<p class="muted" style="grid-column:1/-1">Atenção: há alimentos com nutrientes não informados. Os totais abaixo podem estar incompletos.</p>':'')+tmbCard+['kcal','protein','carbs','fat'].map(k=>`<div class="stat"><span>${labels[k]}</span><strong>${fmt(total[k])} ${k==='kcal'?'kcal':'g'}</strong><div class="bar" role="progressbar" aria-label="Progresso de ${labels[k]}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.max(0,Math.min(100,num(data.goals[k])>0?100*total[k]/num(data.goals[k]):0)))}"><span class="${num(data.goals[k])>0&&total[k]>num(data.goals[k])?'over-goal':''}" style="width:${num(data.goals[k])>0?Math.max(0,Math.min(100,100*total[k]/num(data.goals[k]))):0}%"></span></div><div class="progress-meta"><span>${num(data.goals[k])>0?fmt(Math.round(100*total[k]/num(data.goals[k])))+'% da meta':'Meta não definida'}</span><span>Meta: ${fmt(data.goals[k])} ${k==='kcal'?'kcal':'g'}</span></div></div>`).join('');
$('microstats').innerHTML=Object.entries(MICRO).map(([k,label])=>{const available=items.map(e=>nutrients(e)[k]).filter(v=>v!==null);if(!available.length)return '';return `<div class="micro-item"><div class="micro-item-label"><span>${label.replace(' (mg)','')}</span><small>${available.length} de ${items.length} ${items.length===1?'alimento com dados':'alimentos com dados'}</small></div><span class="micro-item-value">${fmt(available.reduce((a,b)=>a+b,0))} mg</span></div>`}).filter(Boolean).join('')||'<p class="micro-empty">Nenhum dado de vitaminas ou minerais disponível para esta data.</p>';
$('todayentries').innerHTML=items.length?items.map(e=>{const f=data.foods.find(x=>x.id===e.foodId);return `<div class="listitem">${escape(e.meal)} · ${escape(f?.name||'Alimento excluído')} · ${fmt(e.quantity??e.grams)} ${escape(e.unit||'g')} <b>(${nutrients(e).kcal===null?'—':fmt(nutrients(e).kcal)} kcal)</b></div>`}).join(''):'Nenhuma refeição registrada nesta data.'}
function renderWater(){
 const day=$('day').value;
 const entries=data.waterEntries.filter(e=>e.date===day).slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 const total=entries.reduce((sum,e)=>sum+num(e.ml),0);
 const goal=num(data.goals.water)||2500;
 const percent=Math.round(total/goal*100);
 $('waterDateLabel').textContent=dateLabel(day);
 $('waterTotal').textContent=fmt(total)+' ml';
 $('waterGoalLabel').textContent='Meta: '+fmt(goal)+' ml';
 $('waterPercent').textContent=percent+'% da meta';
 $('waterRemaining').textContent=total<goal?'Faltam '+fmt(goal-total)+' ml':total===goal?'Meta atingida':'Meta atingida';
 $('waterProgressFill').style.width=Math.min(100,Math.max(0,total/goal*100))+'%';
 $('waterProgress').setAttribute('aria-valuenow',String(Math.min(100,Math.max(0,percent))));
 $('waterProgress').setAttribute('aria-valuetext',percent+'% da meta; '+fmt(total)+' de '+fmt(goal)+' mililitros');
 $('waterCount').textContent='('+entries.length+')';
 $('waterEntries').innerHTML=entries.length?entries.map(e=>`<div class="listitem row between"><span>${fmt(e.ml)} ml <span class="muted">· ${e.createdAt?new Date(e.createdAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):dateLabel(e.date)}</span></span><button class="danger" type="button" data-remove-water="${escape(e.id)}" aria-label="Excluir registro de ${fmt(e.ml)} ml">Excluir</button></div>`).join(''):'Nenhum registro de água nesta data.';
}
function addWater(ml){
 if(!Number.isSafeInteger(ml)||ml<1||ml>10000)return alert('Informe uma quantidade de 1 a 10.000 ml.');
 const date=$('day').value;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return alert('Selecione uma data válida.');
 if(!commit(()=>data.waterEntries.push({id:uid(),date,ml,createdAt:Date.now()})))return;
 renderWater();toast(fmt(ml)+' ml de água registrados');
}
let historyShown=5;
function historyMealMarkup(group){
 const total={kcal:0,protein:0,carbs:0,fat:0};
 for(const e of group.entries){const n=nutrients(e);for(const k of Object.keys(total))total[k]+=num(n[k])}
 const time=group.createdAt?new Date(group.createdAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'';
 const caption=`${dateLabel(group.date)}${time?' · '+time:''} · ${group.entries.length} alimento${group.entries.length!==1?'s':''}`;
 const foods=group.entries.map(e=>{const f=data.foods.find(x=>x.id===e.foodId),n=nutrients(e);return `<div class="history-meal-food"><div><b>${escape(f?.name||'Alimento excluído')}</b><small>${fmt(e.quantity??e.grams)} ${escape(e.unit||'g')} · ${n.kcal===null?'—':fmt(n.kcal)} kcal · ${n.protein===null?'—':fmt(n.protein)} g proteína</small></div><div class="history-food-actions"><button type="button" class="edit-entry" data-edit-entry="${escape(e.id)}">Editar</button><button type="button" class="danger" data-remove-entry="${escape(e.id)}">Excluir</button></div></div>`}).join('');
 return `<details class="history-card"><summary><div class="history-card-header"><div><div class="history-card-title">${escape(group.meal)}</div><div class="history-card-meta">${escape(caption)}</div></div><div class="history-card-right"><span class="history-card-kcal">${fmt(total.kcal)} kcal</span><span aria-hidden="true" class="history-card-chevron">⌄</span></div></div><div class="history-card-macros">P ${fmt(total.protein)} g · C ${fmt(total.carbs)} g · G ${fmt(total.fat)} g</div></summary><div class="history-card-body">${foods}</div></details>`;
}
function renderEntries(){
 const filter=$('historyDate').value;
 const grouped=new Map();
 data.entries.forEach((e,index)=>{
  if(filter&&e.date!==filter)return;
  const key=e.groupId?'group:'+e.groupId:'single:'+e.id;
  if(!grouped.has(key))grouped.set(key,{date:e.date,meal:e.meal,entries:[],lastIndex:index,createdAt:0});
  const group=grouped.get(key);group.entries.push(e);group.lastIndex=index;
  group.createdAt=Math.max(group.createdAt,Number(e.createdAt)||0);
 });
 const meals=[...grouped.values()].sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt-a.createdAt)||(b.lastIndex-a.lastIndex));
 $('historyCount').textContent=`${meals.length} refeição${meals.length===1?'':'ões'} registrada${meals.length===1?'':'s'}${filter?' nesta data':''}.`;
 $('entryList').innerHTML=meals.length?meals.slice(0,historyShown).map(historyMealMarkup).join(''):'Sem registros.';
 $('historyMore').hidden=meals.length<=historyShown;
 $('historyMore').textContent=`Mostrar mais (${meals.length-historyShown} restantes)`;
}
let foodPage=1;
function renderFoods(){
 const q=norm($('librarySearch').value),cat=$('foodCategory').value;
 const filtered=data.foods.filter(f=>(!cat||f.category===cat)&&norm(f.name+' '+(f.category||'')).includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const categories=[...new Set(data.foods.map(f=>f.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 $('foodCategory').innerHTML='<option value="">Todas as categorias</option>'+categories.map(c=>`<option value="${escape(c)}" ${c===cat?'selected':''}>${escape(c)}</option>`).join('');
 const limit=foodPage*12,shown=filtered.slice(0,limit);
 $('foodCount').textContent=`${filtered.length} alimento${filtered.length===1?'':'s'} encontrado${filtered.length===1?'':'s'}`;
 $('foodList').innerHTML=shown.length?shown.map(f=>`<div class="food-card"><div class="food-card-main"><b>${escape(f.name)}</b><small>${escape(f.category||'Outros')} · ${escape(f.source||'Manual')} · por 100 g</small><div class="food-macros"><span><strong>${f.kcal==null?'—':fmt(f.kcal)}</strong> kcal</span><span>P ${f.protein==null?'—':fmt(f.protein)} g</span><span>C ${f.carbs==null?'—':fmt(f.carbs)} g</span><span>G ${f.fat==null?'—':fmt(f.fat)} g</span></div></div>${f.sourceId?.startsWith('DEFAULT-BR-')?'':`<button class="danger" data-remove-food="${escape(f.id)}">Excluir</button>`}</div>`).join(''):'Nenhum alimento encontrado.';
 $('foodMoreBtn').hidden=filtered.length<=limit;
 $('foodMoreBtn').textContent=`Mostrar mais (${Math.max(0,filtered.length-limit)} restantes)`;
}

let goalsDirty=false;function renderGoals(force=false){if(goalsDirty&&!force)return;for(const k of ['kcal','protein','carbs','fat','fiber','water'])$('g'+k).value=data.goals[k]??0;for(const k of ['height','age','sex','activity','deficit'])$(k).value=data.goals[k]??({height:1.71,age:'',sex:'',activity:1.2,deficit:'moderate'}[k])}
function renderWeights(){const sorted=data.weights.slice().sort((a,b)=>a.date.localeCompare(b.date));const last=sorted.at(-1);const height=num(data.goals.height)||1.71;const bmi=last?last.weight/(height*height):null;const cat=bmi===null?'':bmi<18.5?'Abaixo do peso':bmi<25?'Faixa usual':bmi<30?'Sobrepeso':'Obesidade';$('bmiPanel').innerHTML=bmi?`<strong>IMC: ${fmt(bmi)}</strong><span class="muted">${cat} · ${fmt(last.weight)} kg / ${fmt(height)} m · indicador de triagem para adultos</span>`:'Registre seu peso para calcular o IMC.';$('weightList').innerHTML=sorted.slice().reverse().map(w=>`<div class="listitem row between"><span>${dateLabel(w.date)} — <b>${fmt(w.weight)} kg</b></span><button class="danger" data-remove-weight="${escape(w.id)}">Excluir</button></div>`).join('')||'Nenhum registro de peso.';if($('weightHistoryDetails').open)drawChart(sorted)}
function drawChart(arr){const c=$('weightChart'),ctx=c.getContext('2d'),W=c.width,H=c.height;ctx.clearRect(0,0,W,H);ctx.fillStyle='#f4f8f5';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#cbded3';ctx.beginPath();ctx.moveTo(50,18);ctx.lineTo(50,H-35);ctx.lineTo(W-20,H-35);ctx.stroke();if(!arr.length){ctx.fillStyle='#61786e';ctx.font='16px sans-serif';ctx.fillText('Registre seu peso para visualizar o gráfico.',70,120);return}const vals=arr.map(w=>num(w.weight)),min=Math.min(...vals)-1,max=Math.max(...vals)+1;ctx.strokeStyle='#24875e';ctx.lineWidth=3;ctx.beginPath();arr.forEach((w,i)=>{const x=50+(W-75)*(arr.length===1?.5:i/(arr.length-1)),y=18+(H-53)*(max-num(w.weight))/(max-min);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.stroke();ctx.fillStyle='#17664e';arr.forEach((w,i)=>{const x=50+(W-75)*(arr.length===1?.5:i/(arr.length-1)),y=18+(H-53)*(max-num(w.weight))/(max-min);ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill()});ctx.font='13px sans-serif';ctx.fillText(fmt(max)+' kg',3,25);ctx.fillText(fmt(min)+' kg',3,H-36);ctx.fillText(dateLabel(arr[0].date),50,H-10);if(arr.length>1)ctx.fillText(dateLabel(arr[arr.length-1].date),W-100,H-10)}

const TACO_BASE='https://brolesi.github.io/taco/';
const wanted=[
'arroz, branco, cozido','arroz, integral, cozido','feijão, carioca, cozido','feijão, preto, cozido',
'frango, peito, sem pele, cozido','frango, peito, sem pele, grelhado',
'ovo, de galinha, inteiro, cozido','carne, bovina, patinho, grelhado',
'banana, prata, crua','banana, nanica, crua','maçã, fuji, com casca, crua',
'mamão, papaia, cru','laranja, pera, crua','abacate, cru','tomate, com semente, cru',
'alface, crespa, crua','cenoura, crua','batata, inglesa, cozida','batata, doce, cozida',
'mandioca, cozida','macarrão, trigo, cru','macarrão, trigo, cozido',
'aveia, flocos, crua','pão, francês','leite, de vaca, integral','iogurte, natural',
'queijo, minas, frescal','brócolis, cozido','abóbora, cabotiá, cozida',
'óleo, de soja','azeite, de oliva','amendoim, torrado','farinha, de mandioca',
'cuscuz, de milho, cozido com sal','lentilha, cozida','café, infusão 10%'
];
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const tacoNum=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
async function importTaco(){
const status=$('tacoStatus'),btn=$('loadTaco');btn.disabled=true;status.textContent='Consultando catálogo...';
try{
 const response=await fetch(TACO_BASE+'foods.json',{cache:'no-cache'});
 if(!response.ok)throw Error('Catálogo indisponível');
 const raw=await response.json(),all=Array.isArray(raw)?raw:(raw.foods||[]);
 const chosen=[],used=new Set();
 for(const name of wanted){
   const candidate=all.find(f=>!used.has(f.id)&&norm(f.description)===norm(name)) ||
      all.find(f=>!used.has(f.id)&&norm(f.description).includes(norm(name)));
   if(candidate){chosen.push(candidate);used.add(candidate.id)}
 }
 if(!chosen.length)throw Error('Nenhum alimento correspondente no catálogo');
 let count=0,failed=0;
 for(const item of chosen){
   if(data.foods.some(f=>f.sourceId==='TACO:'+item.id))continue;
   try{
     const r=await fetch(TACO_BASE+'foods/'+item.id+'.json');
     if(!r.ok)throw Error('Detalhe indisponível');
     const f=await r.json();
     const food={
       id:uid(),sourceId:'TACO:'+item.id,source:'TACO / NEPA-Unicamp',category:f.category||item.category||'',
       name:f.description||item.description,
       kcal:tacoNum(f.energy_kcal),protein:tacoNum(f.protein_g),
       carbs:tacoNum(f.carbohydrate_g),fat:tacoNum(f.lipids_g),
       fiber:tacoNum(f.dietary_fiber_g),
       calcium:tacoNum(f.calcium_mg),iron:tacoNum(f.iron_mg),
       magnesium:tacoNum(f.magnesium_mg),potassium:tacoNum(f.potassium_mg),
       sodium:tacoNum(f.sodium_mg),vitaminc:tacoNum(f.vitamin_c_mg)
     };
     if(food.kcal===null||food.protein===null||food.carbs===null||food.fat===null){failed++;continue}
     if(!commit(()=>data.foods.push(food)))throw Error('Falha ao salvar alimento');count++;
     status.textContent=`${count} alimentos importados...`;
   }catch{failed++}
 }
 render();status.textContent=`${count} novos alimentos importados; ${failed} indisponíveis.`;
 if(count)toast('Base TACO adicionada');
}catch(err){status.textContent='Erro: '+err.message+'. Verifique a conexão.'}
finally{btn.disabled=false}
}
$('loadTaco').addEventListener('click',importTaco);

let draft=[];let tacoCatalog=[];const DRAFT_KEY='nutritrack_meal_draft';try{const stored=JSON.parse(sessionStorage.getItem(DRAFT_KEY)||'[]');if(Array.isArray(stored))draft=stored.filter(e=>e&&typeof e.foodId==='string'&&data.foods.some(f=>f.id===e.foodId)&&Number(e.grams)>0&&validDate(e.date)&&typeof e.meal==='string')}catch{}
function persistDraft(){try{sessionStorage.setItem(DRAFT_KEY,JSON.stringify(draft))}catch{}}
window.addEventListener('beforeunload',e=>{if(draft.length){e.preventDefault();e.returnValue=''}});
function renderDraft(){$('saveMeal').disabled=!draft.length;const total={kcal:0,protein:0,carbs:0,fat:0};for(const e of draft){const n=nutrients(e);for(const k in total)total[k]+=num(n[k])} $('mealDraft').innerHTML=draft.length?`<table><thead><tr><th>Alimento</th><th>Porção</th><th>kcal</th><th>Proteína</th><th></th></tr></thead><tbody>${draft.map((e,i)=>`<tr><td>${escape(data.foods.find(f=>f.id===e.foodId)?.name||'')}</td><td>${fmt(e.quantity??e.grams)} ${escape(e.unit||'g')}</td><td>${fmt(nutrients(e).kcal)}</td><td>${fmt(nutrients(e).protein)} g</td><td><button type="button" class="danger" data-draft-remove="${i}">Retirar</button></td></tr>`).join('')}</tbody></table><p><b>Total da refeição:</b> ${fmt(total.kcal)} kcal · ${fmt(total.protein)} g proteína · ${fmt(total.carbs)} g carboidratos · ${fmt(total.fat)} g gorduras</p>`:'Inclua um ou mais alimentos para montar a refeição.'}
$('mealDraft').addEventListener('click',e=>{const b=e.target.closest('[data-draft-remove]');if(!b)return;draft.splice(Number(b.dataset.draftRemove),1);persistDraft();renderDraft()});
$('saveMeal').addEventListener('click',()=>{if(!draft.length)return alert('Inclua pelo menos um alimento.');if(draft.some(x=>x.date!==draft[0].date||x.meal!==draft[0].meal))return alert('A montagem mistura datas ou refeições. Separe antes de salvar.');const groupId=uid(),createdAt=Date.now();if(!commit(()=>data.entries.push(...draft.map(e=>({...e,groupId,createdAt})))))return;draft=[];persistDraft();render();renderDraft();toast('Refeição completa salva')});
$('historyMore').addEventListener('click',()=>{historyShown+=5;renderEntries()});
$('librarySearch').addEventListener('input',()=>{foodPage=1;renderFoods()});
$('weightHistoryDetails').addEventListener('toggle',()=>{if($('weightHistoryDetails').open)drawChart(data.weights.slice().sort((a,b)=>a.date.localeCompare(b.date)))});
function proteinPerKg(activity,deficit){
 // Faixas pragmáticas dentro das recomendações esportivas: não são equações validadas por fator de atividade.
 const base=activity<1.35?1.2:activity<1.5?1.4:activity<1.65?1.6:activity<1.8?1.8:2.0;
 const extra=deficit==='none'?0:deficit==='light'?0.1:deficit==='moderate'?0.2:0.3;
 return Math.min(2.2,Math.round((base+extra)*10)/10);
}
function estimateGoals(){
 const last=data.weights.slice().sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
 if(!last){alert('Registre seu peso em Informações atuais, na aba Perfil, antes de calcular.');return false}
 const weight=num(last.weight),height=num($('height').value)*100,age=num($('age').value),sex=$('sex').value,activity=num($('activity').value),deficit=$('deficit').value;
 const cuts={none:0,light:.10,moderate:.20,strong:.25};
 if(!(weight>0&&height>=50&&height<=270&&age>=18&&age<=110&&['male','female'].includes(sex)&&activity>=1.2&&activity<=1.9&&Object.hasOwn(cuts,deficit))){alert('Informe altura, idade, sexo para a equação, atividade e déficit.');return false}
 const bmr=10*weight+6.25*height-5*age+(sex==='male'?5:-161),tdee=bmr*activity,target=Math.round(tdee*(1-cuts[deficit]));
 const factor=proteinPerKg(activity,deficit),protein=Math.round(weight*factor);
 $('gkcal').value=target;$('gprotein').value=protein;
 $('goalEstimate').textContent=`TMB: ${Math.round(bmr)} kcal/dia · Gasto estimado: ${Math.round(tdee)} kcal/dia · Déficit: ${Math.round(cuts[deficit]*100)}% · Meta: ${target} kcal/dia · Proteína: ${protein} g/dia (${factor.toFixed(1).replace('.',',')} g/kg). Estimativa para preservar massa muscular, não garantia. Salve as metas para aplicar.`;
 if(target<1200)$('goalEstimate').textContent+=' Atenção: meta calórica muito baixa; procure orientação profissional.';
 return true;
}
$('calcGoals').addEventListener('click',estimateGoals);
async function fetchCatalog(){const r=await fetch(TACO_BASE+'foods.json');if(!r.ok)throw Error('Não foi possível acessar TACO');const payload=await r.json();tacoCatalog=Array.isArray(payload)?payload:(payload.foods||[]);renderCatalog();return tacoCatalog}
function renderCatalog(){const q=norm($('tacoSearch').value);const results=tacoCatalog.filter(f=>norm(f.description).includes(q)).sort((a,b)=>{const x=commonScore(a.description),y=commonScore(b.description);return y-x||a.description.localeCompare(b.description,'pt-BR')}).slice(0,60);$('tacoResults').innerHTML=tacoCatalog.length?`<p class="muted">${tacoCatalog.length} alimentos no catálogo · ${tacoCatalog.filter(f=>norm(f.description).includes(q)).length} correspondências · exibindo até 60</p>${results.map(f=>`<div class="listitem taco-food-item"><div class="taco-food-info"><b>${escape(f.description)}</b><div class="muted">${escape(f.category||'')}</div></div><button type="button" data-import-id="${escape(f.id)}" ${data.foods.some(x=>x.sourceId==='TACO:'+f.id)?'disabled':''}>${data.foods.some(x=>x.sourceId==='TACO:'+f.id)?'Adicionado':'Adicionar'}</button></div>`).join('')}`:'Clique em “Carregar catálogo completo TACO” para pesquisar.'}
const commonTerms=['arroz','feijao','frango','ovo','banana','maca','leite','pao','cafe','batata','carne','tomate','alface','cenoura','mandioca','macarrao','aveia','queijo','iogurte','laranja','mamao','brocolis','farinha','peixe','lentilha','milho','abobora','oleo','azeite','acucar','sal'];
function commonScore(name){const n=norm(name);let score=0;for(const [i,term] of commonTerms.entries())if(n.includes(term))score=Math.max(score,100-i);if(n.includes('cozido')||n.includes('grelhado'))score+=5;return score}
async function importOneTaco(id){const existing=data.foods.find(f=>f.sourceId==='TACO:'+id);if(existing)return false;const r=await fetch(TACO_BASE+'foods/'+encodeURIComponent(id)+'.json');if(!r.ok)throw Error('Falha ao carregar alimento');const f=await r.json();const mapping={kcal:'energy_kcal',protein:'protein_g',carbs:'carbohydrate_g',fat:'lipids_g',fiber:'dietary_fiber_g',calcium:'calcium_mg',iron:'iron_mg',magnesium:'magnesium_mg',potassium:'potassium_mg',sodium:'sodium_mg',vitaminc:'vitamin_c_mg'};const food={id:uid(),sourceId:'TACO:'+id,source:'TACO / NEPA-Unicamp',category:f.category||'',name:f.description};for(const [k,v] of Object.entries(mapping))food[k]=tacoNum(f[v]);if(food.kcal===null||food.protein===null||food.carbs===null||food.fat===null)throw Error('Dados básicos incompletos');if(!commit(()=>data.foods.push(food)))throw Error('Não foi possível salvar alimento');return true}
$('catalogBtn').addEventListener('click',async()=>{const b=$('catalogBtn');b.disabled=true;$('tacoStatus').textContent='Carregando catálogo...';try{await fetchCatalog();$('tacoStatus').textContent='Catálogo disponível para pesquisa.'}catch(e){$('tacoStatus').textContent=e.message}finally{b.disabled=false}});
$('tacoSearch').addEventListener('input',renderCatalog);
$('tacoResults').addEventListener('click',async e=>{const b=e.target.closest('[data-import-id]');if(!b)return;b.disabled=true;try{await importOneTaco(b.dataset.importId);render();renderCatalog();toast('Alimento adicionado ao banco')}catch(err){alert(err.message);b.disabled=false}});

function render(){selectFood();renderDashboard();renderWater();renderEntries();renderFoods();renderGoals();renderWeights()}
function updateHeaderGreeting(){
 const now=new Date(),hour=now.getHours();
 const greeting=hour<12?'Bom dia! ☀️':hour<18?'Boa tarde! ☀️':'Boa noite! 🌙';
 $('greetingText').textContent=greeting;
 $('greetingDate').textContent=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long'}).format(now);
}
updateHeaderGreeting();
function switchTab(t){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('hidden',v.id!==t));document.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===t;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false')});if(t==='perfil')renderWeights();$('headerGreeting').hidden=t!=='dashboard';if(t==='dashboard')updateHeaderGreeting();window.scrollTo({top:0,behavior:'instant'})}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));$('openProfile').addEventListener('click',()=>{switchTab('perfil');$('personalDetails').open=true});
for(const id of ['day','entryDate','weightDate'])$(id).value=today();
document.querySelectorAll('[data-date-shift]').forEach(btn=>btn.addEventListener('click',()=>{
 const [id,offset]=btn.dataset.dateShift.split(':');const el=$(id);if(!el.value)return;
 const [y,m,d]=el.value.split('-').map(Number);const next=new Date(y,m-1,d+Number(offset));
 el.value=[next.getFullYear(),String(next.getMonth()+1).padStart(2,'0'),String(next.getDate()).padStart(2,'0')].join('-');
 el.dispatchEvent(new Event('change',{bubbles:true}));
}));
$('clearHistoryDate').addEventListener('click',()=>{$('historyDate').value='';historyShown=5;renderEntries()});
$('day').addEventListener('change',()=>{renderDashboard();renderWater()});$('historyDate').addEventListener('change',()=>{historyShown=5;renderEntries()});
$('diaryFoodSearch').addEventListener('focus',()=>{foodSearchOpen=true;selectFood()});
$('diaryFoodSearch').addEventListener('input',()=>{$('foodSelect').value='';$('foodSelectedHint').textContent='';foodSearchOpen=true;selectFood()});
$('foodSuggestions').addEventListener('click',e=>{const b=e.target.closest('[data-food-id]');if(b)chooseFood(b.dataset.foodId)});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.food-search-field'))closeFoodSearch()});
$('diaryFoodSearch').addEventListener('keydown',e=>{if(e.key==='Escape'){closeFoodSearch();e.target.blur()}else if(e.key==='Enter'&&foodSearchOpen){const first=$('foodSuggestions').querySelector('[data-food-id]');if(first){e.preventDefault();chooseFood(first.dataset.foodId)}}});
$('foodCategory').addEventListener('change',()=>{foodPage=1;renderFoods()});
$('foodMoreBtn').addEventListener('click',()=>{foodPage++;renderFoods()});
$('foodForm').addEventListener('submit',e=>{e.preventDefault();const f={id:uid(),name:$('foodName').value.trim()};if(!f.name)return;for(const k of ['kcal','protein','carbs','fat','fiber'])f[k]=num($(k).value);for(const k of Object.keys(MICRO))f[k]=$(k).value===''?null:num($(k).value);f.source='Manual';if(!commit(()=>data.foods.push(f)))return;e.target.reset();render();toast('Alimento cadastrado')});
$('entryUnit').addEventListener('change',()=>{$('unitHint').hidden=$('entryUnit').value!=='ml';$('grams').placeholder=$('entryUnit').value==='ml'?'Ex.: 200':'Ex.: 150'});
$('entryForm').addEventListener('submit',e=>{e.preventDefault();const foodId=$('foodSelect').value,quantity=num($('grams').value),unit=$('entryUnit').value,grams=quantity;if(!data.foods.some(f=>f.id===foodId)||grams<=0)return alert('Selecione um alimento e informe a quantidade.');const date=$('entryDate').value,meal=$('meal').value;if(!validDate(date))return alert('Data inválida');if(draft.length&&draft.some(x=>x.date!==date||x.meal!==meal))return alert('Salve ou remova os alimentos da refeição em montagem antes de alterar a data ou o tipo de refeição.');draft.push({id:uid(),date,meal,foodId,grams,quantity,unit});persistDraft();$('grams').value='';$('diaryFoodSearch').value='';$('foodSelect').value='';$('foodSelectedHint').textContent='';closeFoodSearch();renderDraft();toast('Alimento incluído na refeição')});
$('goalsForm').addEventListener('invalid',e=>{if(['height','age','sex','activity','deficit'].includes(e.target.id)){$('personalDetails').open=true;switchTab('perfil')}},true);
$('goalsForm').addEventListener('input',()=>goalsDirty=true);$('goalsForm').addEventListener('change',()=>goalsDirty=true);for(const id of ['age','sex','activity','deficit','height'])$(id).addEventListener('change',()=>{$('goalEstimate').textContent='Dados alterados. Clique em “Pré-visualizar minha meta diária” ou em “Calcular e salvar minhas metas”.'});
$('goalsForm').addEventListener('submit',e=>{e.preventDefault();if(!estimateGoals())return;const next={...data.goals};for(const k of ['kcal','protein','carbs','fat','fiber','water'])next[k]=num($('g'+k).value);next.height=num($('height').value);next.age=num($('age').value);next.sex=$('sex').value;next.activity=num($('activity').value);next.deficit=$('deficit').value;if(!commit(()=>{data.goals=next}))return;goalsDirty=false;render();toast('Metas atualizadas')});
$('weightForm').addEventListener('submit',e=>{e.preventDefault();const weight=num($('weight').value);if(!(weight>=1&&weight<=600))return alert('Informe um peso válido.');if(!commit(()=>data.weights.push({id:uid(),date:$('weightDate').value,weight})))return;e.target.reset();$('weightDate').value=today();renderWeights();$('goalEstimate').textContent='Peso atualizado. Calcule e salve novamente as metas para usar o peso atual.';toast('Peso registrado')});
document.addEventListener('click',e=>{const b=e.target.closest('button[data-edit-entry]');if(!b)return;const entry=data.entries.find(x=>x.id===b.dataset.editEntry);if(!entry)return;const value=prompt(`Nova quantidade em ${entry.unit||'g'}:`,String(entry.quantity??entry.grams));if(value===null)return;const qty=Number(value.replace(',','.'));if(!Number.isFinite(qty)||qty<=0||qty>10000)return alert('Informe uma quantidade válida entre 0 e 10.000.');if(!commit(()=>{const item=data.entries.find(x=>x.id===entry.id);item.grams=qty;item.quantity=qty}))return;render();toast('Quantidade atualizada')});
document.addEventListener('click',e=>{const btn=e.target.closest('button[data-remove-entry],button[data-remove-food],button[data-remove-weight]');if(!btn)return;if(btn.dataset.removeFood){const id=btn.dataset.removeFood;if(data.foods.some(f=>f.id===id&&f.sourceId?.startsWith('DEFAULT-BR-')))return alert('Alimentos padrão não podem ser excluídos.');if(data.entries.some(x=>x.foodId===id)||draft.some(x=>x.foodId===id))return alert('Este alimento está em refeições registradas. Exclua essas refeições antes de removê-lo.')}if(!commit(()=>{if(btn.dataset.removeFood)data.foods=data.foods.filter(x=>x.id!==btn.dataset.removeFood);else if(btn.dataset.removeEntry)data.entries=data.entries.filter(x=>x.id!==btn.dataset.removeEntry);else data.weights=data.weights.filter(x=>x.id!==btn.dataset.removeWeight)}))return;render();if(btn.dataset.removeWeight)$('goalEstimate').textContent='Peso alterado. Recalcule e salve suas metas para atualizar calorias e proteínas.';toast('Registro excluído')});
document.querySelectorAll('[data-add-water]').forEach(btn=>btn.addEventListener('click',()=>addWater(Number(btn.dataset.addWater))));
$('waterForm').addEventListener('submit',e=>{e.preventDefault();const ml=Number($('waterCustom').value);if(!Number.isSafeInteger(ml)||ml<1||ml>10000)return alert('Informe uma quantidade inteira de 1 a 10.000 ml.');addWater(ml);$('waterCustom').value=''});
$('waterEntries').addEventListener('click',e=>{const btn=e.target.closest('button[data-remove-water]');if(!btn)return;if(!commit(()=>{data.waterEntries=data.waterEntries.filter(w=>w.id!==btn.dataset.removeWater)}))return;renderWater();toast('Registro de água excluído')});
$('exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='nutritrack-backup-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
function validDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const [y,m,d]=s.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d));return y>=1900&&y<=2200&&dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d}
function validImport(o){
 if(!o||o.version!==1||!Array.isArray(o.foods)||!Array.isArray(o.entries)||!Array.isArray(o.weights)||!o.goals||typeof o.goals!=='object'||Array.isArray(o.goals))return false;
 const vn=(n,min=0,max=1e9)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
 const opt=(n,min=0,max=1e9)=>n===null||n===undefined||vn(n,min,max);
 const ids=new Set(),foods=new Set(),groups=new Map();
 if(!['kcal','protein','carbs','fat','fiber'].every(k=>vn(o.goals[k],0,1e6)))return false;
 if(o.goals.water!==undefined&&!vn(o.goals.water,100,10000))return false;
 if(!opt(o.goals.height,.5,2.7)||!opt(o.goals.age,0,110)||!opt(o.goals.activity,1,2.5))return false;
 if(o.goals.sex!==undefined&&!['','male','female'].includes(o.goals.sex))return false;
 if(o.goals.deficit!==undefined&&!['none','light','moderate','strong'].includes(o.goals.deficit))return false;
 for(const f of o.foods){if(!f||typeof f.id!=='string'||!f.id||ids.has(f.id)||typeof f.name!=='string'||!f.name.trim()||!['kcal','protein','carbs','fat','fiber',...Object.keys(MICRO)].every(k=>opt(f[k],0,1e6)))return false;ids.add(f.id);foods.add(f.id)}
 ids.clear();for(const e of o.entries){if(!e||typeof e.id!=='string'||!e.id||ids.has(e.id)||!foods.has(e.foodId)||!validDate(e.date)||typeof e.meal!=='string'||!e.meal.trim()||!vn(e.grams,.01,1e6))return false;if(e.groupId!=null){if(typeof e.groupId!=='string'||!e.groupId)return false;const g=groups.get(e.groupId);if(g&&(g.date!==e.date||g.meal!==e.meal))return false;groups.set(e.groupId,{date:e.date,meal:e.meal})}ids.add(e.id)}
 ids.clear();for(const w of o.weights){if(!w||typeof w.id!=='string'||!w.id||ids.has(w.id)||!validDate(w.date)||!vn(w.weight,1,600))return false;ids.add(w.id)}
 if(o.waterEntries!==undefined){if(!Array.isArray(o.waterEntries))return false;ids.clear();for(const w of o.waterEntries){if(!w||typeof w.id!=='string'||!w.id||ids.has(w.id)||!validDate(w.date)||!Number.isSafeInteger(w.ml)||w.ml<1||w.ml>10000||(w.createdAt!==undefined&&!vn(w.createdAt,0,1e15)))return false;ids.add(w.id)}}
 return true;
}
function normalizeData(o){const base=defaultFoods(),present=new Set(o.foods.map(f=>f.id));return {...o,foods:[...o.foods,...base.filter(f=>!present.has(f.id)&&!o.foods.some(x=>x.sourceId===f.sourceId))],waterEntries:o.waterEntries||[],goals:{...initial().goals,...o.goals}}}

$('importFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;if(file.size>5_000_000)return alert('Arquivo muito grande.');try{const imported=JSON.parse(await file.text());if(!validImport(imported))throw Error('Formato de backup inválido');if(confirm('Substituir TODOS os dados atuais pelos dados do backup?')){if(!commit(()=>{data=normalizeData(imported)}))return;draft=[];persistDraft();goalsDirty=false;render();renderDraft();toast('Backup restaurado')}}catch(err){alert('Não foi possível importar: '+err.message)}e.target.value=''});
$('resetBtn').addEventListener('click',()=>{if(confirm('Apagar permanentemente todos os alimentos, refeições, metas, medidas e registros de água?')){if(!commit(()=>{data=initial()}))return;draft=[];persistDraft();goalsDirty=false;render();renderDraft();toast('Dados apagados')}});
let deferredPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').classList.remove('hidden')});$('installBtn').addEventListener('click',async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null}});
function connection(){const offline=!navigator.onLine;$('offline').hidden=!offline;$('offline').textContent=offline?'● Offline — dados locais':''}window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
render();renderDraft();
})();