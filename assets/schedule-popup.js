/* Timbercrest schedule popup — Fletschhorn-style Worker calendar.
   One shared calendar for property pages, checkout, and event CTAs. */
(function(){
  if(window.__TC_SCHEDULE_POPUP_READY) return;
  window.__TC_SCHEDULE_POPUP_READY=true;

  const D=window.TC;
  if(!D||typeof D.apiUrl!=="function") return;

  const COLORS={
    "the-birch":"#2563eb",
    "the-mahogany":"#dc2626",
    "the-myrtle":"#eab308",
    "the-timbercrest":"#16a34a"
  };
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#39;"}[c]));
  const props=()=>Array.isArray(D.PROPERTIES)&&D.PROPERTIES.length?D.PROPERTIES:(D.PROPERTIES_FALLBACK||[]);
  const byId=id=>props().find(p=>p.id===id)||null;
  const isStay=()=>/\/stays\//.test(location.pathname);
  const isBooking=()=>/booking\.html$/i.test(location.pathname);
  const slug=()=> (location.pathname.split("/").pop()||"").replace(/\.html$/i,"");
  const baseBooking=()=>isStay()?"../booking.html":"booking.html";
  const toIso=d=>{const x=new Date(d);x.setMinutes(x.getMinutes()-x.getTimezoneOffset());return x.toISOString().slice(0,10);};
  const todayIso=()=>{const d=new Date();d.setHours(0,0,0,0);return toIso(d);};
  const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
  const monthStart=d=>new Date(d.getFullYear(),d.getMonth(),1);
  const monthEnd=d=>new Date(d.getFullYear(),d.getMonth()+1,0);
  const money=(v,c="USD")=>v!==null&&v!==undefined&&v!==""&&!Number.isNaN(Number(v))?new Intl.NumberFormat("en-US",{style:"currency",currency:c,maximumFractionDigits:0}).format(Number(v)):"";
  const fmtDate=s=>s?new Date(s+"T00:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}):"—";
  const fmtShort=s=>s?new Date(s+"T00:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"}):"—";

  const store={};
  let modal=null,scrim=null;
  let state={ids:[],mode:"single",month:monthStart(new Date()),checkIn:"",checkOut:"",loading:false,error:"",data:{}};

  function ensureAssets(){
    if(document.querySelector('link[data-schedule-popup]')) return;
    const css=document.createElement("link");
    css.rel="stylesheet";
    css.href=(isStay()?"../":"")+"assets/schedule-popup.css?v=7";
    css.dataset.schedulePopup="1";
    document.head.appendChild(css);
  }
  function selectedProps(){return state.ids.map(byId).filter(Boolean);}
  function selectedSearchIds(){return $$(".tcsearch-opt.on[data-id]").map(x=>x.dataset.id).filter(Boolean);}
  function selectedCheckoutIds(){return isBooking()?$$('.bk-prop.on[data-id]').map(x=>x.dataset.id).filter(Boolean):[];}
  function allIds(){return props().map(p=>p.id).filter(Boolean);}
  function hrefIds(href){
    try{
      const u=new URL(href,location.href);
      const ids=(u.searchParams.get("ids")||"").split(",").filter(Boolean);
      if(ids.length) return ids;
      if(u.searchParams.get("event")==="1") return allIds();
    }catch(_){ }
    return [];
  }
  function contextIds(){
    const checkout=selectedCheckoutIds();
    if(checkout.length) return checkout;
    const q=new URLSearchParams(location.search);
    const ids=(q.get("ids")||"").split(",").filter(Boolean);
    if(ids.length) return ids;
    const picked=selectedSearchIds();
    if(picked.length) return picked;
    if(q.get("event")==="1") return allIds();
    if(isStay()) return [slug()].filter(Boolean);
    return allIds();
  }

  function normalizeDay(item){
    if(!item||typeof item!=="object") return null;
    const date=String(item.date||item.day||item.dateString||item.startDate||item._id||"").slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const status=String(item.status||item.availability||"").toLowerCase();
    const unavailable=item.available===false||item.isAvailable===false||status==="unavailable"||status==="booked"||status==="blocked"||status==="reserved";
    const available=!unavailable&&(item.available===true||item.isAvailable===true||status==="available"||status==="open"||status==="selectable"||status==="");
    const price=item.price??item.nightlyPrice??item.basePrice??item.rate??item.amount??item.totalPrice??null;
    return {date,available:available&&!unavailable,unavailable,price,currency:item.currency||D.CURRENCY||"USD",status:item.status||item.availability||(available?"available":"booked")};
  }
  function collectDays(data){
    const found=[];
    function walk(v){
      if(!v||typeof v!=="object") return;
      if(Array.isArray(v)){v.forEach(walk);return;}
      const day=normalizeDay(v);
      if(day) found.push(day);
      Object.keys(v).forEach(k=>walk(v[k]));
    }
    if(data&&Array.isArray(data.days)) data.days.forEach(d=>{const x=normalizeDay(d);if(x) found.push(x);});
    else walk(data);
    return found;
  }

  function ensureShell(){
    ensureAssets();
    if(modal&&scrim) return;
    scrim=document.createElement("div");
    scrim.className="tc-cal-scrim";
    modal=document.createElement("div");
    modal.className="tc-cal-modal";
    modal.setAttribute("role","dialog");
    modal.setAttribute("aria-modal","true");
    document.body.append(scrim,modal);
    scrim.addEventListener("click",close);
    document.addEventListener("keydown",e=>{if(e.key==="Escape") close();});
  }
  function openCalendar(opts={}){
    ensureShell();
    const q=new URLSearchParams(location.search);
    const ids=(opts.ids&&opts.ids.length?opts.ids:contextIds()).filter(Boolean);
    const checkIn=opts.checkIn||q.get("checkIn")||"";
    const d=checkIn?new Date(checkIn+"T00:00:00"):new Date();
    state={ids,mode:opts.mode||((ids.length>1||q.get("event")==="1")?"combined":"single"),month:monthStart(isNaN(d.getTime())?new Date():d),checkIn,checkOut:opts.checkOut||q.get("checkOut")||"",loading:false,error:"",data:{}};
    render();
    scrim.classList.add("open");
    modal.classList.add("open");
    document.documentElement.style.overflow="hidden";
    loadMonth();
  }
  function close(){
    if(!modal) return;
    scrim.classList.remove("open");
    modal.classList.remove("open");
    document.documentElement.style.overflow="";
  }
  window.TC_OPEN_SCHEDULE=openCalendar;

  function headerTitle(){return state.mode==="combined"?"Combined mansion availability":((selectedProps()[0]?.name||"Availability")+" availability").replace("Availability availability","Availability");}
  function legend(){return selectedProps().map(p=>`<div class="tc-cal-pill"><span class="tc-cal-dot" style="--tc-color:${COLORS[p.id]||p.g1||"#1c1917"}"></span><span>${esc(p.name)}</span></div>`).join("");}
  function selectedNights(){return state.checkIn&&state.checkOut?Math.max(0,Math.round((new Date(state.checkOut)-new Date(state.checkIn))/86400000)):0;}
  function render(){
    const n=selectedNights(), combined=state.mode==="combined";
    modal.innerHTML=`<div class="tc-cal-head"><div><div class="tc-cal-kicker">Schedule</div><h2 class="tc-cal-title">${esc(headerTitle())}</h2><p class="tc-cal-sub">${combined?"Dots show each selected mansion. Colored dot = available, red dot = blocked. Total nightly price appears first.":"Live availability and nightly prices from Guesty."}</p></div><button class="tc-cal-x" type="button" aria-label="Close">×</button></div><div class="tc-cal-body"><aside class="tc-cal-side">${legend()}<div class="tc-cal-range"><b>Your dates</b><div>${fmtDate(state.checkIn)} → ${fmtDate(state.checkOut)}</div>${n?`<div class="tc-cal-legend-small">${n} night${n>1?"s":""}</div>`:`<div class="tc-cal-legend-small">Click a check-in date, then checkout date.</div>`}</div><div class="tc-cal-note">Green outline = bookable. Yellow = partial. Grey/red = not possible.</div>${state.error?`<div class="tc-cal-error">${esc(state.error)}</div>`:""}<div class="tc-cal-actions"><button class="tc-cal-btn primary" data-apply ${state.checkIn&&state.checkOut?"":"disabled"}>Continue with dates</button><button class="tc-cal-btn secondary" data-clear>Clear dates</button></div></aside><main class="tc-cal-main">${calendarHtml()}</main></div>`;
    $(".tc-cal-x",modal).onclick=close;
    $("[data-clear]",modal).onclick=()=>{state.checkIn="";state.checkOut="";state.error="";render();};
    $("[data-apply]",modal).onclick=applyDates;
    $$('[data-cal-nav]',modal).forEach(b=>b.onclick=()=>{state.month=new Date(state.month.getFullYear(),state.month.getMonth()+Number(b.dataset.calNav),1);loadMonth();});
    $$('[data-date]',modal).forEach(b=>b.onclick=()=>selectDate(b.dataset.date));
  }
  function calendarHtml(){
    const m=state.month;
    const title=m.toLocaleDateString(undefined,{month:"long",year:"numeric"});
    if(state.loading) return `<div class="tc-cal-toolbar"><div class="tc-cal-month">${title}</div></div><div class="tc-cal-loading">Loading live calendar…</div>`;
    const weekdays="SMTWTFS".split("").map(x=>`<span>${x}</span>`).join("");
    const first=monthStart(m), gridStart=addDays(first,-first.getDay());
    let cells="";
    for(let i=0;i<42;i++){const d=addDays(gridStart,i);cells+=dayCell(toIso(d),d.getMonth()!==m.getMonth());}
    return `<div class="tc-cal-toolbar"><div class="tc-cal-month">${title}</div><div class="tc-cal-nav"><button type="button" data-cal-nav="-1">‹</button><button type="button" data-cal-nav="1">›</button></div></div><div class="tc-cal-week">${weekdays}</div><div class="tc-cal-grid">${cells}</div>`;
  }
  function dayPrice(row){
    if(!row.isOpen) return 0;
    const raw=row.day?.price??row.p?.nightlyFrom??0;
    const n=Number(raw);
    return Number.isFinite(n)&&n>0?n:0;
  }
  function infoForDate(date){
    const rows=selectedProps().map(p=>{
      const day=(state.data[p.id]||{})[date]||null;
      const isOpen=Boolean(day&&!day.unavailable&&day.available!==false);
      const currency=day?.currency||D.CURRENCY||"USD";
      return {p,day,isOpen,currency};
    });
    const open=rows.filter(x=>x.isOpen);
    const allOpen=rows.length>0&&open.length===rows.length;
    const partial=state.mode==="combined"&&open.length>0&&!allOpen;
    const noneOpen=rows.length>0&&open.length===0;
    const total=allOpen?rows.reduce((sum,row)=>sum+dayPrice(row),0):0;
    return {rows,open,price:total||null,allOpen,partial,noneOpen,currency:(open[0]?.currency)||"USD"};
  }
  function inRange(date){return state.checkIn&&state.checkOut&&date>state.checkIn&&date<state.checkOut;}
  function dayCell(date,out){
    const d=new Date(date+"T00:00:00"), info=infoForDate(date), past=date<todayIso();
    const disabled=out||past||!info.allOpen;
    const selected=date===state.checkIn||date===state.checkOut;
    const price=info.price?money(info.price,info.currency):"";
    const status=state.mode==="combined"?(info.allOpen?"All open":info.partial?`${info.open.length}/${info.rows.length} open`:"Not open"):(info.allOpen?"Available":"Booked");
    const details=info.rows.map(x=>`${x.p.name}: ${x.isOpen?"open":"not available"}`).join(" | ");
    const dots=state.mode==="combined"?`<div class="tc-cal-dots">${info.rows.map(x=>`<span class="tc-cal-state-dot ${x.isOpen?"open":"closed"}" style="--tc-color:${COLORS[x.p.id]||x.p.g1||"#1c1917"}" aria-label="${esc(x.p.name)} ${x.isOpen?"open":"blocked"}"></span>`).join("")}</div>`:"";
    return `<button type="button" class="tc-cal-day ${out?"out":""} ${info.allOpen?"all-open":""} ${info.partial?"partial":""} ${info.noneOpen?"none-open":""} ${disabled?"unavailable":""} ${selected?"selected":""} ${inRange(date)?"in-range":""}" data-date="${date}" title="${esc(details)}${price?` · Total ${esc(price)}`:""}" ${disabled?"aria-disabled='true'":""} ${out?"tabindex='-1'":""}><span class="tc-cal-top"><span class="tc-cal-date">${d.getDate()}</span>${price?`<span class="tc-cal-price">${price}</span>`:""}</span><span class="tc-cal-status">${past?"Past":status}</span>${dots}</button>`;
  }
  function rangeHasClosed(start,end){
    if(!start||!end) return false;
    for(let d=new Date(start+"T00:00:00");d<new Date(end+"T00:00:00");d.setDate(d.getDate()+1)){if(!infoForDate(toIso(d)).allOpen) return true;}
    return false;
  }
  function selectDate(date){
    if(date<todayIso()) return;
    const info=infoForDate(date);
    if(!info.allOpen){state.error=state.mode==="combined"?"At least one selected mansion is unavailable on that date. Choose a fully open date.":"That date is unavailable. Please choose another date.";render();return;}
    if(!state.checkIn||state.checkOut||date<=state.checkIn){state.checkIn=date;state.checkOut="";state.error="";}
    else if(rangeHasClosed(state.checkIn,date)){state.error=state.mode==="combined"?"At least one selected mansion is unavailable inside that range. Please choose another range.":"One or more selected nights is unavailable. Please choose another range.";state.checkOut="";}
    else{state.checkOut=date;state.error="";}
    render();
  }
  function applyDates(){
    if(!state.checkIn||!state.checkOut) return;
    const q=new URLSearchParams(location.search);
    q.set("ids",state.ids.join(","));
    q.set("checkIn",state.checkIn);
    q.set("checkOut",state.checkOut);
    if(state.mode==="combined"||q.get("event")==="1") q.set("event","1");
    location.href=baseBooking()+"?"+q.toString();
  }
  async function loadMonth(){
    state.loading=true;state.error="";render();
    const from=toIso(monthStart(state.month)), to=toIso(monthEnd(state.month));
    try{
      await Promise.all(selectedProps().map(async p=>{
        const key=p.id+"|"+from+"|"+to;
        if(store[key]){state.data[p.id]=store[key];return;}
        const url=D.apiUrl("calendar")+"?id="+encodeURIComponent(p.id)+"&listingId="+encodeURIComponent(p.listingId||"")+"&from="+from+"&to="+to;
        const r=await fetch(url,{headers:{Accept:"application/json"},credentials:"omit",cache:"default"});
        const text=await r.text();
        let data={};
        try{data=JSON.parse(text);}catch(_){data={rawText:text};}
        if(!r.ok||data.ok===false||data.error) throw new Error(data.message||data.error||("Calendar "+r.status));
        const map={};
        collectDays(data).forEach(day=>{map[day.date]=day;});
        store[key]=map;state.data[p.id]=map;
      }));
    }catch(err){console.warn("Timbercrest calendar failed",err);state.error=err.message||"Calendar unavailable.";}
    finally{state.loading=false;render();}
  }

  function openFromTarget(target){
    const explicit=target.closest&&target.closest("[data-tc-schedule],[data-tc-open-schedule],[data-tc-checkout-schedule]");
    if(explicit){const ids=(explicit.dataset.ids||"").split(",").filter(Boolean);const picked=ids.length?ids:contextIds();openCalendar({ids:picked,mode:explicit.dataset.mode||(picked.length>1||new URLSearchParams(location.search).get("event")==="1"?"combined":"single")});return true;}
    const when=target.closest&&target.closest('.tcsearch-seg[data-seg="when"],.tcsearch-pane[data-pane="when"] [data-tc-open-schedule]');
    if(when){const ids=contextIds();openCalendar({ids,mode:ids.length>1?"combined":"single"});return true;}
    const a=target.closest&&target.closest('a[href*="booking.html"],a[href*="../booking.html"]');
    if(a){
      const href=a.getAttribute("href")||"", isBookLink=/booking\.html/.test(href), isEvent=/event=1/.test(href), hasIds=/ids=/.test(href), text=(a.textContent||"").toLowerCase();
      const shouldOpen=isEvent||hasIds||isStay()||/book|reserve|availability|group stay|plan/.test(text);
      if(isBookLink&&shouldOpen){const ids=isEvent?allIds():(hrefIds(a.href).length?hrefIds(a.href):contextIds());openCalendar({ids,mode:(isEvent||ids.length>1)?"combined":"single"});return true;}
    }
    return false;
  }
  document.addEventListener("click",function(e){if(openFromTarget(e.target)){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();}},true);

  function replaceOldDateInputs(){
    if(!document.getElementById("tc-calendar-old-date-kill")){
      const style=document.createElement("style");
      style.id="tc-calendar-old-date-kill";
      style.textContent='.tcsearch-pane[data-pane="when"] .tcsearch-dates{display:none!important}.tcsearch-pane[data-pane="when"] [data-tc-open-schedule]{display:inline-flex!important}';
      document.head.appendChild(style);
    }
    document.querySelectorAll('.tcsearch-pane[data-pane="when"]').forEach(pane=>{
      if(pane.querySelector('[data-tc-open-schedule]')) return;
      const btn=document.createElement("button");
      btn.type="button";btn.className="tc-cal-open";btn.dataset.tcOpenSchedule="1";btn.textContent="Open calendar with prices";pane.appendChild(btn);
    });
  }
  function ensureCheckoutButton(){
    if(!isBooking()) return;
    replaceOldDateInputs();
    const h=$$(".bk-sec h2").find(x=>/date/i.test(x.textContent));
    if(!h) return;
    const sec=h.closest(".bk-sec");
    if(!sec) return;
    sec.classList.add("tc-cal-booking-sec");
    const ids=contextIds(), q=new URLSearchParams(location.search);
    const mode=(ids.length>1||q.get("event")==="1")?"combined":"single";
    const label=ids.length>1?`Live schedule for ${ids.length} mansions`:"Live schedule for this mansion";
    const dateText=q.get("checkIn")&&q.get("checkOut")?`${fmtShort(q.get("checkIn"))} → ${fmtShort(q.get("checkOut"))}`:"No dates selected";
    let box=sec.querySelector('[data-tc-checkout-schedule]');
    if(!box){box=document.createElement("div");box.className="tc-cal-checkout-control";box.dataset.tcCheckoutSchedule="1";h.insertAdjacentElement("afterend",box);}
    const html=`<button type="button" class="tc-cal-open tc-cal-open--checkout" data-tc-open-schedule>${q.get("event")==="1"||ids.length>1?"Open combined mansion schedule":"Open live schedule"}</button><span><b>${esc(label)}</b><small>${esc(dateText)}</small></span>`;
    const key=mode+"|"+ids.join(",")+"|"+dateText+"|"+html;
    box.dataset.mode=mode;
    if(box.dataset.renderKey!==key){box.dataset.renderKey=key;box.innerHTML=html;}
  }
  function startCheckoutInjection(){
    if(!isBooking()) return;
    ensureCheckoutButton();
    const timer=setInterval(ensureCheckoutButton,200);
    setTimeout(()=>clearInterval(timer),7000);
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>{replaceOldDateInputs();startCheckoutInjection();});
  else{replaceOldDateInputs();startCheckoutInjection();}
  document.addEventListener("tc:properties-ready",()=>{replaceOldDateInputs();ensureCheckoutButton();});
  new MutationObserver(()=>{replaceOldDateInputs();ensureCheckoutButton();}).observe(document.documentElement,{childList:true,subtree:true});
})();