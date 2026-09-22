/**
 * HATTAB AUTO — Local Database Shim
 * Replaces Claude's cloud db with localStorage for self-hosting.
 * Drop this file next to index.html and include it BEFORE the main script.
 */
(function(){
  function store(col){return'hattab_'+col}
  function readAll(col){try{return JSON.parse(localStorage.getItem(store(col))||'{}')}catch(e){return{}}}
  function writeAll(col,data){try{localStorage.setItem(store(col),JSON.stringify(data))}catch(e){alert('مساحة التخزين ممتلئة!')}}
  function uid(){return'id_'+Date.now()+'_'+Math.random().toString(36).slice(2,8)}

  const listeners={};
  function notify(col){const all=readAll(col);const docs=Object.entries(all).map(([id,d])=>({id,data:()=>d,exists:true}));(listeners[col]||[]).forEach(fn=>fn({docs}))}

  window._localDB={
    collection(col){
      return{
        add:async function(data){const all=readAll(col);const id=uid();all[id]=data;writeAll(col,all);notify(col);return{id}},
        onSnapshot(cb,err){
          if(!listeners[col])listeners[col]=[];
          const all=readAll(col);cb({docs:Object.entries(all).map(([id,d])=>({id,data:()=>d}))});
          listeners[col].push(cb);return()=>{listeners[col]=listeners[col].filter(f=>f!==cb)};
        },
        get:async function(){const all=readAll(col);return{docs:Object.entries(all).map(([id,d])=>({id,data:()=>d}))}}
      }
    },
    doc(path){
      const[col,id]=path.split('/');
      return{
        update:async function(data){const all=readAll(col);all[id]={...(all[id]||{}),...data};writeAll(col,all);notify(col)},
        delete:async function(){const all=readAll(col);delete all[id];writeAll(col,all);notify(col)},
        set:async function(data){const all=readAll(col);all[id]=data;writeAll(col,all);notify(col)},
        get:async function(){const all=readAll(col);return{exists:!!all[id],id,data:()=>all[id]}}
      }
    }
  };
  console.log('[HATTAB AUTO] Local DB shim loaded — data stored in localStorage');
})();
