/* Timbercrest schedule popup — Worker-backed availability + prices. */
(function(){
  const D=window.TC;
  if(!D||typeof D.apiUrl!=="function") return;

  const COLORS={
    "the-birch":"#54687a",
    "the-mahogany":"#7a4a3a",
    "the-myrtle":"#6e5840",
    "the-timbercrest":"#3a3f49"
  };
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money=v=>v?"$"+Number(v).toLocaleString():"";
  const ymd=d=>d.toISOString().slice(0,10);
  const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
  const monthStart=d=>new Date(d.getFullYear(),d.getMonth(),1);
  const monthEnd=d=>new Date(d.getFullYear(),d.getMonth()+1,0);
  const fmtDate=s=>s?new Date(s+"T00:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}):"—";
  const props=()=>Array.isArray(D.PROPERTIES)&&D.PROPERTIES.length?D.PROPERTIES:D.PROPERTIES_FALLBACK||[];
  const byId=id=>props().find(p=>p.id===id);
  const currentSlug=()=> (location.pathname.split("/").pop()||"").replace(/\.html$/i,"");
  const isBooking=()=>/booking\.html$/i.test(location.pathname);
  const isStay=()=>/\/stays\//.test(location.pathname);
  const baseBooking=()=>isStay()?"../booking.html":"booking.html";

  let modal,scrim;
  let state={month:monthStart(new Date()),ids:[],mode:"single",checkIn:"",checkOut:"",loading:false,error:"",data:{}};
  const cache=new Map();

  function selectedProps(){return state.ids.map(byId).filter(Boolean);}
  function getIdsFromUrl(){
    const q=new URLSearchParams(location.search);
    const ids=(q.get("ids")||"").split(",").filter(Boolean);
    if(ids.length) return ids;
    if(isStay()) return [currentSlug()].filter(Boolean);
    if(q.get("event")==="1") return props().map(p=>p.id);
    return [(props()[0]||{}).id].filter(Boolean);
  }

  function ensureShell(){
    if(scrim&&modal) return;
    scrim=document.createElement("div");scrim.className="tc-cal-scrim";
    modal=document.createElement("div");modal.className="tc-cal-modal";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");
    document.body.append(scrim,modal);
    scrim.addEventListener("click",close);
    document.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
  }
  function open(opts={}){
    ensureShell();
    const q=new URLSearchParams(location.search);
    state={
      month:monthStart(opts.month||new Date(q.get("checkIn")||Date.now())),
      ids:opts.ids&&opts.ids.length?opts.ids:getIdsFromUrl(),
      mode:opts.mode||((opts.ids&&opts.ids.length>1)||q.get("event")==="1"?"combined":"single"),
      checkIn:q.get("checkIn")||opts.checkIn||"",
      checkOut:q.get("checkOut")||opts.checkOut||"",
      loading:false,error:"",data:{}
    };
    render();
    scrim.classList.add("open");modal.classList.add("open");document.documentElement.style.overflow="hidden";
    loadMonth();
  }
  function close(){if(!modal)return;scrim.classList.remove("open");modal.classList.remove("open");document.documentElement.style.overflow="";}
  window.TC_OPEN_SCHEDULE=open;

  function title(){
    const names=selectedProps().map(p=>p.name);
    if(state.mode==="combined") return "Combined mansion availability";
    return names[0]?names[0]+" availability":"Availability";
  }
  function subtitle(){
    return state.mode==="combined"?"Each color is one mansion. Prices and status come from the cached Guesty calendar.":"Live dates and nightly prices from Guesty.";
  }
  function legend(){
    return selectedProps().map(p=>`<div class="tc-cal-pill"><span class="tc-cal-dot" style="--tc-color:${COLORS[p.id]||p.g1||'#1c1917'}"></span><span>${esc(p.name)}</span></div>`).join("");
  }
  function rangeBox(){
    const n=state.checkIn&&state.checkOut?Math.max(0,(new Date(state.checkOut)-new Date(state.checkIn))/86400000):0;
    return `<div class="tc-cal-range"><b>Your dates</b><div>${fmtDate(state.checkIn)} → ${fmtDate(state.checkOut)}</div>${n?`<div class="tc-cal-legend-small">${n} night${n>1?"s":""}</div>`:"<div class="tc-cal-legend-small">Click a check-in date, then a checkout date.</div>"}</div>`;
  }
  function render(){
    const m=state.month;
    modal.innerHTML=`
      <div class="tc-cal-head"><div><div class="tc-cal-kicker">Schedule</div><h2 class="tc-cal-title">${esc(title())}</h2><p class="tc-cal-sub">${esc(subtitle())}</p></div><button class="tc-cal-x" type="button" aria-label="Close">×</button></div>
      <div class="tc-cal-body"><aside class="tc-cal-side">${legend()}${rangeBox()}<div class="tc-cal-note">Available days show a price. Grey days are booked or blocked. In combined mode, filled color bars show which mansions are open that day.</div><div class="tc-cal-actions"><button class="tc-cal-btn primary" data-cal-apply ${state.checkIn&&state.checkOut?"":"disabled"}>Continue with dates</button><button class="tc-cal-btn secondary" data-cal-clear>Clear dates</button></div></aside><main class="tc-cal-main">${calendarHtml(m)}</main></div>`;
    $(".tc-cal-x",modal).onclick=close;
    $("[data-cal-clear]",modal).onclick=()=>{state.checkIn="";state.checkOut="";render();};
    $("[data-cal-apply]",modal).onclick=apply;
    $$('[data-cal-nav]',modal).forEach(b=>b.onclick=()=>{state.month=new Date(m.getFullYear(),m.getMonth()+Number(b.dataset.calNav),1);render();loadMonth();});
    $$('[data-date]',modal).forEach(b=>b.onclick=()=>pick(b.dataset.date));
  }
  function calendarHtml(m){
    const name=m.toLocaleDateString(undefined,{month:"long",year:"numeric"});
    if(state.loading) return `<div class="tc-cal-toolbar"><div class="tc-cal-month">${name}</div></div><div class="tc-cal-loading">Loading schedule…</div>`;
    if(state.error) return `<div class="tc-cal-toolbar"><div class="tc-cal-month">${name}</div></div><div class="tc-cal-error">${esc(state.error)}</div>`;
    const week="SMTWTFS".split("").map(x=>`<span>${x}</span>`).join("");
    const first=monthStart(m),last=monthEnd(m),gridStart=addDays(first,-first.getDay());
    let cells="";
    for(let i=0;i<42;i++){
      const d=addDays(gridStart,i),date=ymd(d),out=d.getMonth()!==m.getMonth();
      cells+=dayCell(date,out);
    }
    return `<div class="tc-cal-toolbar"><div class="tc-cal-month">${name}</div><div class="tc-cal-nav"><button data-cal-nav="-1">‹</button><button data-cal-nav="1">›</button></div></div><div class="tc-cal-week">${week}</div><div class="tc-cal-grid">${cells}</div>`;
  }
  function dayInfo(date){
    const arr=selectedProps().map(p=>({p,day:(state.data[p.id]||{})[date]}));
    const open=arr.filter(x=>x.day&&x.day.available!==false&&x.day.status!=="booked"&&x.day.status!=="unavailable");
    const prices=open.map(x=>Number(x.day.price||0)).filter(Boolean);
    return {arr,open,price:prices.length?Math.min(...prices):0,allOpen:open.length===arr.length&&arr.length>0};
  }
  function isInRange(date){return state.checkIn&&state.checkOut&&date>state.checkIn&&date<state.checkOut;}
  function dayCell(date,out){
    const info=dayInfo(date),d=new Date(date+"T00:00:00").getDate();
    const sel=date===state.checkIn||date===state.checkOut;
    const unavailable=state.mode!=="combined"&&!info.allOpen;
    const status=state.mode==="combined"?(info.allOpen?"All open":info.open.length?`${info.open.length}/${info.arr.length} open`:"Booked"):(info.allOpen?"Available":"Booked");
    const bars=state.mode==="combined"?`<div class="tc-cal-bars">${info.arr.map(x=>`<span class="tc-cal-bar ${x.day&&x.day.available!==false?'open':''}" style="--tc-color:${COLORS[x.p.id]||x.p.g1||'#1c1917'}"></span>`).join("")}</div>`:"";
    return `<button type="button" class="tc-cal-day ${out?'out':''} ${unavailable?'unavailable':''} ${sel?'selected':''} ${isInRange(date)?'in-range':''}" data-date="${date}"><span class="tc-cal-date">${d}</span>${info.price?`<span class="tc-cal-price">from ${money(info.price)}</span>`:""}<span class="tc-cal-status">${status}</span>${bars}</button>`;
  }
  function pick(date){
    const info=dayInfo(date);
    if(state.mode!=="combined"&&!info.allOpen) return;
    if(!state.checkIn||state.checkOut||date<=state.checkIn){state.checkIn=date;state.checkOut="";}else{state.checkOut=date;}
    render();
  }
  function apply(){
    const ids=state.ids.join(",");
    const q=new URLSearchParams(location.search);
    q.set("ids",ids);q.set("checkIn",state.checkIn);q.set("checkOut",state.checkOut);
    if(state.mode==="combined"||q.get("event")==="1") q.set("event","1");
    location.href=baseBooking()+"?"+q.toString();
  }
  async function loadMonth(){
    state.loading=true;state.error="";render();
    const from=ymd(monthStart(state.month)),to=ymd(monthEnd(state.month));
    try{
      await Promise.all(selectedProps().map(async p=>{
        const key=p.id+"|"+from+"|"+to;
        if(cache.has(key)){state.data[p.id]=cache.get(key);return;}
        const url=D.apiUrl("calendar")+"?id="+encodeURIComponent(p.id)+"&from="+from+"&to="+to;
        const r=await fetch(url,{headers:{Accept:"application/json"},credentials:"omit"});
        const j=await r.json().catch(()=>({}));
        if(!r.ok||!j.ok) throw new Error(j.message||j.error||("Calendar "+r.status));
        const map={};(j.days||[]).forEach(day=>{if(day.date)map[day.date]=day;});
        cache.set(key,map);state.data[p.id]=map;
      }));
    }catch(e){state.error=e.message||"Calendar unavailable.";}
    state.loading=false;render();
  }
  function wire(){
    document.addEventListener("click",e=>{
      const explicit=e.target.closest("[data-tc-schedule]");
      if(explicit){e.preventDefault();open({ids:(explicit.dataset.ids||"").split(",").filter(Boolean),mode:explicit.dataset.mode||"single"});return;}
      const a=e.target.closest('a[href*="booking.html?ids="]');
      if(a&&isStay()){e.preventDefault();const url=new URL(a.href,location.href);open({ids:(url.searchParams.get("ids")||currentSlug()).split(",").filter(Boolean),mode:"single"});}
    });
    if(isBooking()) injectCheckoutButton();
  }
  function injectCheckoutButton(){
    const tries=setInterval(()=>{
      const h=$$(".bk-sec h2").find(x=>/dates/i.test(x.textContent));
      if(!h) return;
      if($("[data-tc-checkout-schedule]")){clearInterval(tries);return;}
      const btn=document.createElement("button");btn.type="button";btn.className="tc-cal-open";btn.dataset.tcCheckoutSchedule="1";btn.textContent=new URLSearchParams(location.search).get("event")==="1"?"Open combined mansion calendar":"Open calendar with prices";
      btn.onclick=()=>open({ids:getIdsFromUrl(),mode:(getIdsFromUrl().length>1||new URLSearchParams(location.search).get("event")==="1")?"combined":"single"});
      h.parentElement.insertBefore(btn,h.nextSibling);clearInterval(tries);
    },250);
    setTimeout(()=>clearInterval(tries),5000);
  }
  wire();
})();