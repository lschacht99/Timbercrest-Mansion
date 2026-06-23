/* Force all Timbercrest date/schedule actions into the new Worker-backed popup.
   This sits above older search/date behavior and prevents direct redirects. */
(function(){
  const D=window.TC;
  if(!D) return;

  const isStay=()=>/\/stays\//.test(location.pathname);
  const isBooking=()=>/booking\.html$/i.test(location.pathname);
  const slug=()=> (location.pathname.split("/").pop()||"").replace(/\.html$/i,"");
  const props=()=>Array.isArray(D.PROPERTIES)&&D.PROPERTIES.length?D.PROPERTIES:D.PROPERTIES_FALLBACK||[];
  const allIds=()=>props().map(p=>p.id).filter(Boolean);
  const prefix=()=>isStay()?"../":"";

  function selectedFromSearch(){
    const picked=[...document.querySelectorAll(".tcsearch-opt.on[data-id]")].map(x=>x.dataset.id).filter(Boolean);
    return picked.length?picked:null;
  }

  function idsFromHref(href){
    try{
      const u=new URL(href,location.href);
      const ids=(u.searchParams.get("ids")||"").split(",").filter(Boolean);
      if(ids.length) return ids;
      if(u.searchParams.get("event")==="1") return allIds();
    }catch(_){ }
    return null;
  }

  function idsFromContext(){
    const q=new URLSearchParams(location.search);
    const fromUrl=(q.get("ids")||"").split(",").filter(Boolean);
    if(fromUrl.length) return fromUrl;
    const fromSearch=selectedFromSearch();
    if(fromSearch&&fromSearch.length) return fromSearch;
    if(q.get("event")==="1") return allIds();
    if(isStay()) return [slug()].filter(Boolean);
    return allIds();
  }

  function loadScheduleAssets(cb){
    if(typeof window.TC_OPEN_SCHEDULE==="function"){cb();return;}
    let css=document.querySelector('link[data-schedule-popup]');
    if(!css){
      css=document.createElement("link");
      css.rel="stylesheet";
      css.href=prefix()+"assets/schedule-popup.css?v=2";
      css.dataset.schedulePopup="1";
      document.head.appendChild(css);
    }
    let script=document.querySelector('script[data-schedule-popup]');
    if(!script){
      script=document.createElement("script");
      script.src=prefix()+"assets/schedule-popup.js?v=2";
      script.dataset.schedulePopup="1";
      script.async=false;
      document.body.appendChild(script);
    }
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(typeof window.TC_OPEN_SCHEDULE==="function"){
        clearInterval(timer);
        cb();
      }else if(tries>80){
        clearInterval(timer);
        console.warn("Schedule popup did not load in time.");
      }
    },50);
  }

  function openSchedule(ids,mode,extra={}){
    const clean=(ids&&ids.length?ids:idsFromContext()).filter(Boolean);
    const finalMode=mode||(clean.length>1?"combined":"single");
    loadScheduleAssets(()=>window.TC_OPEN_SCHEDULE({ids:clean,mode:finalMode,...extra}));
  }

  function installOldDatePanelReplacement(){
    if(!document.getElementById("tc-kill-old-date-panels")){
      const style=document.createElement("style");
      style.id="tc-kill-old-date-panels";
      style.textContent=`
        .tcsearch-pane[data-pane="when"] .tcsearch-dates{display:none!important}
        .tcsearch-pane[data-pane="when"] .tc-old-date-note{display:none!important}
        .tcsearch-pane[data-pane="when"] [data-tc-open-schedule]{display:inline-flex!important}
      `;
      document.head.appendChild(style);
    }
    document.querySelectorAll('.tcsearch-pane[data-pane="when"]').forEach(pane=>{
      if(pane.querySelector("[data-tc-open-schedule]")) return;
      const btn=document.createElement("button");
      btn.type="button";
      btn.className="tc-cal-open";
      btn.dataset.tcOpenSchedule="1";
      btn.textContent="Open calendar with prices";
      const note=document.createElement("p");
      note.className="text-sm text-stone-500 mt-3";
      note.textContent="Dates, availability, and nightly pricing are shown in the live calendar.";
      pane.append(btn,note);
    });
  }

  document.addEventListener("click",function(e){
    const scheduleBtn=e.target.closest("[data-tc-open-schedule],[data-tc-schedule]");
    if(scheduleBtn){
      e.preventDefault();
      e.stopImmediatePropagation();
      const ids=(scheduleBtn.dataset.ids||"").split(",").filter(Boolean);
      openSchedule(ids.length?ids:idsFromContext(),scheduleBtn.dataset.mode||null);
      return;
    }

    const whenSeg=e.target.closest('.tcsearch-seg[data-seg="when"]');
    if(whenSeg){
      e.preventDefault();
      e.stopImmediatePropagation();
      openSchedule(idsFromContext(),idsFromContext().length>1?"combined":"single");
      return;
    }

    const eventLink=e.target.closest('a[href*="booking.html?event=1"],a[href*="../booking.html?event=1"]');
    if(eventLink){
      e.preventDefault();
      e.stopImmediatePropagation();
      openSchedule(allIds(),"combined");
      return;
    }

    const bookingLink=e.target.closest('a[href*="booking.html?ids="],a[href*="../booking.html?ids="]');
    if(bookingLink){
      e.preventDefault();
      e.stopImmediatePropagation();
      const ids=idsFromHref(bookingLink.href)||idsFromContext();
      openSchedule(ids,ids.length>1?"combined":"single");
    }
  },true);

  document.addEventListener("tc:properties-ready",installOldDatePanelReplacement);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",installOldDatePanelReplacement);
  else installOldDatePanelReplacement();
  new MutationObserver(installOldDatePanelReplacement).observe(document.documentElement,{childList:true,subtree:true});
})();