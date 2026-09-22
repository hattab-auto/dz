import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
const $=id=>document.getElementById(id);let pdfText="",vehicles=[];
$("pdfInput").addEventListener("change",e=>{$("fileName").textContent=e.target.files[0]?.name||"لم يتم اختيار ملف بعد";$('extractBtn').disabled=!e.target.files[0]});
$('extractBtn').addEventListener('click',async()=>{const f=$('pdfInput').files[0];if(!f)return;setStatus('جاري قراءة ملف PDF...');try{pdfText=await readPdf(f);const d=parseBL(pdfText);fillShipment(d);vehicles=d.vehicles;renderVehicles();setStatus(`تم استخراج ${vehicles.length} سيارة. راجع البيانات قبل الحفظ.`)}catch(e){console.error(e);setStatus('تعذر قراءة الملف.',true)}});
async function readPdf(file){const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;let pages=[];for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p),c=await page.getTextContent(),rows={};for(const x of c.items){const y=Math.round(x.transform?.[5]||0);(rows[y]??=[]).push(x)}const lines=Object.keys(rows).sort((a,b)=>b-a).map(y=>rows[y].sort((a,b)=>(a.transform?.[4]||0)-(b.transform?.[4]||0)).map(x=>x.str).join(' '));pages.push(lines.join('\n'))}return pages.join('\n');}
function clean(s=''){return s.replace(/[\u00a0]/g,' ').replace(/[ \t]+/g,' ').trim()}function first(...v){return v.find(x=>clean(x))?clean(v.find(x=>clean(x))):''}function val(block,re){const m=block.match(re);return m?clean(m[1]):''}function lineAfter(block,re){const lines=block.split(/\n/).map(clean);for(let i=0;i<lines.length;i++)if(re.test(lines[i]))return clean(lines[i+1]||'');return ''}
function parseBL(text){const t=clean(text.replace(/\n/g,' '));return {blNumber:first(val(t,/(?:BILL OF LADING(?: NUMBER| NO\.?| No\.?)|BL NO\.?|B\/L NO\.?)\s*[:.]?\s*([A-Z]{3,5}\d{6,12})/i),val(t,/\b(MEDUY\d{7,}|CHN\d{6,}|HMM[A-Z0-9-]+)\b/i)),containerNumber:first(val(t,/(?:CONTAINER(?: NO\.?| NUMBER)?|CONTAINER AND SEALS)[^A-Z0-9]*([A-Z]{4}\d{7})/i),val(t,/\b([A-Z]{4}\d{7})\b/i)),sealNumber:first(val(t,/SEAL(?: NO\.?| NUMBER)?[^A-Z0-9]*([A-Z0-9-]{6,})/i)),shippingLine:/\bMSC\b|MEDITERRANEAN SHIPPING/i.test(t)?'MSC':/CMA\s*CGM/i.test(t)?'CMA CGM':/\bHMM\b|HYUNDAI MERCHANT/i.test(t)?'HMM':'',vessel:first(val(t,/VESSEL\s*(?:&|AND)?\s*VOYAGE\s*\n?\s*([^\n]+)/i),val(t,/VESSEL\s*\n?\s*([^\n]+)/i)),voyage:first(val(t,/VOYAGE(?: NUMBER| NO\.?)?\s*[:.]?\s*([A-Z0-9-]{4,})/i),val(t,/\b(FD\d{3,}[A-Z]?)\b/i)),portLoading:first(val(t,/PORT OF LOADING\s*[:.]?\s*([^\n]+)/i),val(t,/PLACE OF LOADING\s*[:.]?\s*([^\n]+)/i)),portDischarge:val(t,/PORT OF DISCHARGE\s*[:.]?\s*([^\n]+)/i),vehicles:parseVehicles(text)} }
function parseVehicles(text){
  const lines=text.split(/\n/).map(clean);
  const chassisRe=/^(?:CHASSIS NUMBER|CHAISEIS NUMBER|CHASSIS NUMBER\s*:)\s*:?\s*([A-Z0-9]{10,})/i;
  const positions=[];
  lines.forEach((line,i)=>{const m=line.match(chassisRe);if(m)positions.push({i,chassis:m[1]});});
  const out=[];
  for(let n=0;n<positions.length;n++){
    const pos=positions[n].i;
    const end=positions[n+1]?.i ?? lines.length;
    const before=lines.slice(Math.max(0,pos-4),pos);
    const block=lines.slice(Math.max(0,pos-1),end).join('\n');
    const get=(re)=>val(block,re);
    const getAll=(re)=>{const m=block.match(re);return m?clean(m[1]):''};
    const modelLine=[...before].reverse().find(x=>x && !/^(?:\d+\.|CHASSIS|CHAISEIS|BRAND|COLOR|YEAR|FINAL|PASSPORT|ID NO|NIN)/i.test(x));
    const model=clean((modelLine||'').replace(/^\d+\.\s*/,'').replace(/\s+(?:CHASSIS|CHAISEIS).*/i,''));
    const nin=getAll(/\bNIN\.?\s*[:.]?\s*([^\n]+)/i);
    const blockLines=block.split('\n').map(clean);
    const ninIndex=blockLines.findIndex(x=>/\bNIN\.?/i.test(x));
    const address=ninIndex>=0?clean(blockLines[ninIndex+1]||''):'';
    out.push({
      owner:getAll(/FINAL RECEIVER\s*:?\s*([^\n]+)/i),
      brand:getAll(/BRAND\s*:?\s*([^\n]+)/i),
      model:first(getAll(/PRODUCT\s*:?\s*([^\n]+)/i),model),
      color:getAll(/COLOR\s*:?\s*([^\n]+)/i),
      chassis:positions[n].chassis,
      year:getAll(/YEAR OF MANUFACTURE\s*:?\s*(\d{4})/i),
      passport:first(getAll(/PASSPORT\s*NO\.?\s*:?\s*([^\n]+)/i),getAll(/ID NO\.?\s*:?\s*([^\n]+)/i)),
      nin:nin.replace(/^NIN\.?\s*[:.]?\s*/i,''),
      address
    });
  }
  return out;
}
function fillShipment(d){['blNumber','containerNumber','sealNumber','shippingLine','vessel','voyage','portLoading','portDischarge'].forEach(k=>$(k).value=d[k]||'')}
function renderVehicles(){$('vehiclesBody').innerHTML='';vehicles.forEach((v,i)=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${i+1}</td>${field('owner',i,v.owner)}${field('brand',i,v.brand)}${field('model',i,v.model)}${field('color',i,v.color)}${field('chassis',i,v.chassis)}${field('year',i,v.year)}${field('passport',i,v.passport)}${field('nin',i,v.nin)}${field('address',i,v.address)}<td><button class="delete" data-delete="${i}">حذف</button></td>`;$('vehiclesBody').appendChild(tr)});document.querySelectorAll('[data-field]').forEach(x=>{x.addEventListener('input',e=>vehicles[+e.target.dataset.index][e.target.dataset.field]=e.target.value);x.addEventListener('click',()=>copyText(x.value))});document.querySelectorAll('[data-delete]').forEach(x=>x.addEventListener('click',()=>{vehicles.splice(+x.dataset.delete,1);renderVehicles()}))}
function field(n,i,v){return `<td><input title="اضغط لنسخ المعلومة" data-field="${n}" data-index="${i}" value="${escapeHtml(v||'')}"></td>`}function escapeHtml(s){return String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;')}
async function copyText(s){if(!s)return;try{await navigator.clipboard.writeText(s);setStatus('تم نسخ المعلومة.')}catch{setStatus('تعذر النسخ التلقائي؛ انسخ يدويًا.',true)}}
$('addVehicleBtn').addEventListener('click',()=>{vehicles.push({owner:'',brand:'',model:'',color:'',chassis:'',year:'',passport:'',nin:'',address:''});renderVehicles()});
function collect(){return {blNumber:$('blNumber').value.trim(),containerNumber:$('containerNumber').value.trim(),sealNumber:$('sealNumber').value.trim(),shippingLine:$('shippingLine').value.trim(),vessel:$('vessel').value.trim(),voyage:$('voyage').value.trim(),portLoading:$('portLoading').value.trim(),portDischarge:$('portDischarge').value.trim(),vehicles}}
$('saveBtn').addEventListener('click',()=>{localStorage.setItem('hattabBL',JSON.stringify(collect()));$('saveStatus').textContent='تم حفظ البيانات.'});$('loadBtn').addEventListener('click',()=>{const s=localStorage.getItem('hattabBL');if(!s){$('saveStatus').textContent='لا توجد بيانات محفوظة.';return}const d=JSON.parse(s);fillShipment(d);vehicles=d.vehicles||[];renderVehicles();$('saveStatus').textContent='تم الاسترجاع.'});$('exportBtn').addEventListener('click',()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(collect(),null,2)],{type:'application/json'}));a.download=(($('blNumber').value||'shipment')+'.json');a.click()});
$('themeBtn').addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem('hattabTheme',document.body.classList.contains('dark')?'dark':'light');$('themeBtn').textContent=document.body.classList.contains('dark')?'☀️ نهاري':'🌙 ليلي'});if(localStorage.getItem('hattabTheme')==='dark'){$('themeBtn').click()};function setStatus(m,e=false){$('status').textContent=m;$('status').className=e?'status error':'status'}
