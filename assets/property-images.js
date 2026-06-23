(function(){
  const D=window.TC;
  if(!D||typeof D.apiUrl!=="function") return;
  const slug=(location.pathname.split("/").pop()||"").replace(/\.html$/i,"");
  const list=D.PROPERTIES_FALLBACK||D.PROPERTIES||[];
  const prop=list.find(p=>p.id===slug);
  if(!prop||!prop.listingId) return;
  const cleanUrl=v=>String(v||"").replace(/'/g,"%27");
  function imagesFrom(payload){
    const raw=Array.isArray(payload)?payload:(Array.isArray(payload&&payload.images)?payload.images:(Array.isArray(payload&&payload.pictures)?payload.pictures:[]));
    return raw.map(x=>({url:x.url||x.src||x.original||x.regular||x.thumbnail||x.large,alt:x.alt||x.caption||prop.name,caption:x.caption||""})).filter(x=>x.url);
  }
  function photos(){
    const marked=[...document.querySelectorAll("[data-property-gallery] .photo")];
    if(marked.length) return marked;
    const reserve=document.querySelector('a[href*="booking.html?ids="]');
    const gallery=reserve&&reserve.closest("div[style*='grid-template-columns']");
    const found=gallery?[...gallery.querySelectorAll(".photo")]:[];
    return found.length?found:[...document.querySelectorAll("main .photo")].slice(0,5);
  }
  function paint(items){
    const nodes=photos();
    if(!nodes.length||!items.length) return;
    nodes.forEach((el,i)=>{
      const img=items[i%items.length];
      el.style.backgroundImage="url('"+cleanUrl(img.url)+"')";
      el.style.backgroundSize="cover";
      el.style.backgroundPosition="center";
      el.setAttribute("role","img");
      el.setAttribute("aria-label",img.alt||prop.name||"Property image");
      const tag=el.querySelector(".tag");
      if(tag&&img.caption) tag.textContent=img.caption;
    });
  }
  fetch(D.apiUrl("images")+"?listingId="+encodeURIComponent(prop.listingId),{headers:{Accept:"application/json"},credentials:"omit"})
    .then(r=>r.ok?r.json():Promise.reject(new Error("images "+r.status)))
    .then(data=>paint(imagesFrom(data)))
    .catch(e=>console.warn("Timbercrest images fallback",e));
})();