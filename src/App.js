import { useState, useEffect, useCallback, useRef } from "react";
import * as sb from "./supabase";

const C = {
  bg:"#0D0D0D",surface:"#111",card:"#181818",border:"#242424",
  accent:"#F5C842",accentDim:"#F5C84215",text:"#F0EDE6",muted:"#666",
  success:"#4ECB71",danger:"#E05C5C",sidebar:"#0A0A0A",info:"#5CA8E0",
};
const FONT="'Open Sans',sans-serif";
const MATERIAS=["Matemáticas","Física","Química","Inglés","Programación","Historia","Biología","Literatura","Economía","Arte"];
const avatarColor=(l)=>["#F5C842","#4ECB71","#E05C5C","#5CA8E0","#C85CE0"][(l||"?").toUpperCase().charCodeAt(0)%5];
const fmt=(d)=>d?new Date(d).toLocaleDateString("es-AR",{day:"numeric",month:"short",year:"numeric"}):"";
const fmtPrice=(p)=>p?`$${Number(p).toLocaleString("es-AR")}`:"A convenir";

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
const Spinner=({small})=>(
  <div style={{display:"flex",justifyContent:"center",padding:small?"6px":"36px 0"}}>
    <div style={{width:small?16:26,height:small?16:26,border:`3px solid ${C.border}`,borderTop:`3px solid ${C.accent}`,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
  </div>
);
const Avatar=({letra,size=38})=>(
  <div style={{width:size,height:size,borderRadius:"50%",background:avatarColor(letra),display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:size*.4,color:"#0D0D0D",flexShrink:0,fontFamily:FONT}}>
    {(letra||"?")[0].toUpperCase()}
  </div>
);
const Tag=({tipo})=>(
  <span style={{fontSize:11,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",padding:"3px 10px",borderRadius:20,background:tipo==="oferta"?"#4ECB7122":"#F5C84222",color:tipo==="oferta"?C.success:C.accent,border:`1px solid ${tipo==="oferta"?"#4ECB7144":"#F5C84244"}`,fontFamily:FONT}}>
    {tipo==="oferta"?"📚 Oferta":"🔍 Búsqueda"}
  </span>
);
const StatusBadge=({activo})=>(
  <span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20,background:activo?"#4ECB7115":"#E05C5C15",color:activo?C.success:C.danger,border:`1px solid ${activo?"#4ECB7133":"#E05C5C33"}`,fontFamily:FONT}}>
    {activo?"● Activa":"○ Pausada"}
  </span>
);
const VerifiedBadge=()=>(
  <span title="Conocimiento verificado" style={{fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:20,background:"#5CA8E022",color:C.info,border:"1px solid #5CA8E044",fontFamily:FONT}}>✓ Verificado</span>
);
const StarRating=({val,count,small})=>{
  if(!count&&!val) return <span style={{color:C.muted,fontSize:small?11:12,fontStyle:"italic"}}>Sin valoraciones</span>;
  const v=parseFloat(val)||0;
  return <span style={{color:C.accent,fontSize:small?12:13}}>{"★".repeat(Math.round(v))}{"☆".repeat(5-Math.round(v))}<span style={{color:C.muted,marginLeft:4,fontSize:small?11:12}}>{v.toFixed(1)}{count!==undefined&&` (${count})`}</span></span>;
};
const Input=({style={},...props})=>(
  <input style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 13px",color:C.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:FONT,...style}} {...props}/>
);
const Btn=({children,variant="primary",style={},...props})=>(
  <button style={{background:variant==="primary"?C.accent:variant==="danger"?C.danger:variant==="success"?C.success:"transparent",color:variant==="primary"||variant==="success"?"#0D0D0D":C.text,border:variant==="ghost"?`1px solid ${C.border}`:"none",borderRadius:10,padding:"9px 18px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:FONT,...style}} {...props}>{children}</button>
);
const ErrMsg=({msg})=>msg?<div style={{color:C.danger,fontSize:12,margin:"5px 0",fontFamily:FONT}}>{msg}</div>:null;
const Label=({children})=><div style={{color:C.muted,fontSize:11,fontWeight:600,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>{children}</div>;
const Modal=({children,onClose,width="min(560px,95vw)"})=>(
  <div style={{position:"fixed",inset:0,background:"#000b",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:14,fontFamily:FONT}}>
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,width,maxHeight:"92vh",overflowY:"auto"}}>{children}</div>
  </div>
);
const Chip=({label,val})=>val?(
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 13px"}}>
    <div style={{color:C.muted,fontSize:10,letterSpacing:1,marginBottom:1}}>{label}</div>
    <div style={{color:C.text,fontWeight:600,fontSize:13}}>{val}</div>
  </div>
):null;

// ─── VALORACION HELPERS ────────────────────────────────────────────────────────
const calcAvg=(arr)=>{
  if(!arr||arr.length===0)return null;
  return arr.reduce((a,r)=>a+(r.estrellas||0),0)/arr.length;
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function AuthScreen({onLogin}){
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState("");const [pass,setPass]=useState("");const [pass2,setPass2]=useState("");
  const [loading,setLoading]=useState(false);const [err,setErr]=useState("");const [ok,setOk]=useState("");
  const handle=async()=>{
    setErr("");setOk("");
    if(!email){setErr("Ingresá tu email");return;}
    if(mode!=="forgot"&&!pass){setErr("Ingresá tu contraseña");return;}
    if(mode==="register"&&pass!==pass2){setErr("Las contraseñas no coinciden");return;}
    setLoading(true);
    try{
      if(mode==="forgot"){await sb.resetPassword(email);setOk("Te enviamos un email.");}
      else if(mode==="register"){const r=await sb.signUp(email,pass);if(r.access_token){sb.saveSession(r);onLogin(r);}else setOk("Confirmá tu email.");}
      else{const r=await sb.signIn(email,pass);sb.saveSession(r);onLogin(r);}
    }catch(e){setErr(e.message||"Error");}finally{setLoading(false);}
  };
  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:FONT}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:22,padding:"38px 34px",width:"min(420px,90vw)",textAlign:"center"}}>
        <div style={{fontSize:46,marginBottom:10}}>🎓</div>
        <h2 style={{fontFamily:"Georgia,serif",color:C.text,fontSize:26,margin:"0 0 4px"}}>ClasseLink</h2>
        <p style={{color:C.muted,marginBottom:26,fontSize:13}}>Conectá con profesores y estudiantes</p>
        <div style={{display:"flex",gap:4,marginBottom:22,background:C.card,borderRadius:12,padding:4}}>
          {["login","register"].map(m=>(
            <button key={m} onClick={()=>{setMode(m);setErr("");setOk("");}} style={{flex:1,padding:"8px",borderRadius:9,border:"none",fontWeight:600,fontSize:13,cursor:"pointer",background:mode===m?C.accent:"transparent",color:mode===m?"#0D0D0D":C.muted,fontFamily:FONT}}>
              {m==="login"?"Iniciar sesión":"Registrarse"}
            </button>
          ))}
        </div>
        {mode==="forgot"?(
          <>
            <Input type="email" placeholder="tu@email.com" value={email} onChange={e=>setEmail(e.target.value)} style={{marginBottom:10}}/>
            <ErrMsg msg={err}/>{ok&&<div style={{color:C.success,fontSize:13,marginBottom:8}}>{ok}</div>}
            <Btn onClick={handle} disabled={loading} style={{width:"100%",marginBottom:10}}>{loading?"Enviando...":"Enviar link"}</Btn>
            <button onClick={()=>{setMode("login");setErr("");setOk("");}} style={{background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:FONT}}>← Volver</button>
          </>
        ):(
          <>
            <Input type="email" placeholder="tu@email.com" value={email} onChange={e=>setEmail(e.target.value)} style={{marginBottom:9}} onKeyDown={e=>e.key==="Enter"&&handle()}/>
            <Input type="password" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)} style={{marginBottom:9}} onKeyDown={e=>e.key==="Enter"&&handle()}/>
            {mode==="register"&&<Input type="password" placeholder="Repetir contraseña" value={pass2} onChange={e=>setPass2(e.target.value)} style={{marginBottom:9}}/>}
            <ErrMsg msg={err}/>{ok&&<div style={{color:C.success,fontSize:13,marginBottom:8}}>{ok}</div>}
            <Btn onClick={handle} disabled={loading} style={{width:"100%",padding:"12px",fontSize:14,marginBottom:12,borderRadius:12}}>{loading?"...":mode==="login"?"Entrar →":"Crear cuenta →"}</Btn>
            {mode==="login"&&<button onClick={()=>{setMode("forgot");setErr("");setOk("");}} style={{background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:FONT}}>¿Olvidaste tu contraseña?</button>}
          </>
        )}
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({page,setPage,session,onLogout,onNewPost,unreadCount,mobile,open,onClose}){
  const nombre=session.user.email.split("@")[0];
  const nav=[{id:"explore",icon:"⊞",label:"Explorar"},{id:"chats",icon:"💬",label:"Mis chats",badge:unreadCount},{id:"myposts",icon:"◧",label:"Mis publicaciones"},{id:"inscripciones",icon:"📚",label:"Mis inscripciones"}];
  const inner=(
    <div style={{width:224,height:"100%",background:C.sidebar,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",fontFamily:FONT}}>
      <div style={{padding:"18px 18px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <span style={{fontSize:19}}>🎓</span>
          <span style={{fontFamily:"Georgia,serif",fontSize:16,fontWeight:700,color:C.text}}>Classe<span style={{color:C.accent}}>Link</span></span>
        </div>
        {mobile&&<button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:20,cursor:"pointer"}}>×</button>}
      </div>
      <nav style={{padding:"12px 10px",flex:1}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:C.muted,padding:"0 8px",marginBottom:7}}>MENÚ</div>
        {nav.map(item=>(
          <button key={item.id} onClick={()=>{setPage(item.id);if(mobile)onClose();}} style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"9px 11px",borderRadius:10,border:"none",background:page===item.id?C.accentDim:"transparent",color:page===item.id?C.accent:C.muted,fontWeight:page===item.id?600:400,fontSize:13,cursor:"pointer",marginBottom:2,fontFamily:FONT,textAlign:"left"}}>
            <span style={{fontSize:14}}>{item.icon}</span>{item.label}
            {item.badge>0&&<span style={{marginLeft:"auto",background:C.danger,color:"#fff",borderRadius:20,fontSize:10,fontWeight:700,padding:"1px 6px"}}>{item.badge}</span>}
          </button>
        ))}
        <div style={{margin:"12px 0 9px",height:1,background:C.border}}/>
        <Btn onClick={()=>{onNewPost();if(mobile)onClose();}} style={{width:"100%",padding:"9px 11px",fontSize:12,borderRadius:10,display:"flex",alignItems:"center",gap:7}}>
          <span>+</span> Nueva publicación
        </Btn>
      </nav>
      <div style={{padding:"10px 10px",borderTop:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:9,padding:"7px 10px",marginBottom:5}}>
          <Avatar letra={nombre[0]} size={28}/>
          <div style={{overflow:"hidden"}}>
            <div style={{color:C.text,fontSize:12,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{nombre}</div>
            <div style={{color:C.muted,fontSize:10,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{session.user.email}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{width:"100%",background:"none",border:`1px solid ${C.border}`,borderRadius:9,color:C.muted,padding:"7px 11px",cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",gap:7,fontFamily:FONT}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=C.danger;e.currentTarget.style.color=C.danger;}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}>
          ↩ Cerrar sesión
        </button>
      </div>
    </div>
  );
  if(mobile)return(
    <>{open&&<div onClick={onClose} style={{position:"fixed",inset:0,background:"#000a",zIndex:89}}/>}
    <div style={{position:"fixed",left:0,top:0,height:"100vh",zIndex:90,transform:open?"translateX(0)":"translateX(-100%)",transition:"transform .25s"}}>{inner}</div></>
  );
  return <div style={{position:"fixed",left:0,top:0,height:"100vh",zIndex:40}}>{inner}</div>;
}

// ─── FAVORITO BUTTON ──────────────────────────────────────────────────────────
function FavBtn({post,session}){
  const [favId,setFavId]=useState(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    sb.getFavoritos(session.user.email,session.access_token).then(favs=>{
      const f=favs.find(f=>f.publicacion_id===post.id);
      setFavId(f?.id||null);
    }).finally(()=>setLoading(false));
  },[post.id,session]);
  const toggle=async(e)=>{
    e.stopPropagation();
    if(loading)return;
    setLoading(true);
    try{
      if(favId){await sb.deleteFavorito(favId,session.access_token);setFavId(null);}
      else{const r=await sb.insertFavorito({publicacion_id:post.id,usuario_email:session.user.email},session.access_token);setFavId(r[0]?.id);}
    }finally{setLoading(false);}
  };
  return(
    <button onClick={toggle} title={favId?"Quitar favorito":"Agregar a favoritos"} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:favId?C.accent:C.border,transition:"color .15s",padding:"0 2px"}}>
      {favId?"★":"☆"}
    </button>
  );
}

// ─── OFERTA SOBRE BUSQUEDA BTN ────────────────────────────────────────────────
function OfertarBtn({post,session}){
  const [open,setOpen]=useState(false);
  const [precio,setPrecio]=useState("");const [tipo,setTipo]=useState("hora");const [msg,setMsg]=useState("");const [saving,setSaving]=useState(false);
  if(post.tipo!=="busqueda"||post.autor_email===session.user.email)return null;
  const enviar=async()=>{
    if(!msg.trim()){return;}
    setSaving(true);
    try{
      await sb.insertOfertaBusq({busqueda_id:post.id,busqueda_autor_email:post.autor_email,ofertante_email:session.user.email,ofertante_nombre:session.user.email.split("@")[0],precio:precio?parseFloat(precio):null,precio_tipo:tipo,mensaje:msg},session.access_token);
      setOpen(false);setMsg("");setPrecio("");
    }finally{setSaving(false);}
  };
  const iS={width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:FONT,marginBottom:9};
  return(
    <>
      <button onClick={e=>{e.stopPropagation();setOpen(true);}} style={{background:"#5CA8E022",border:"1px solid #5CA8E044",borderRadius:10,color:C.info,padding:"6px 13px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:FONT}}>
        🙋 Ofertar mis clases
      </button>
      {open&&(
        <div onClick={e=>e.stopPropagation()} style={{position:"fixed",inset:0,background:"#000b",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:FONT}}>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:18,width:"min(420px,95vw)",padding:"22px 22px"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
              <h3 style={{color:C.text,margin:0,fontSize:16,fontWeight:700}}>Ofertá tus clases</h3>
              <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:C.muted,fontSize:20,cursor:"pointer"}}>×</button>
            </div>
            <div style={{background:C.card,borderRadius:10,padding:"10px 13px",marginBottom:12,fontSize:12,color:C.muted}}>Búsqueda: <span style={{color:C.text,fontWeight:600}}>{post.titulo}</span></div>
            <Label>Tu propuesta de precio (opcional)</Label>
            <div style={{display:"flex",gap:8,marginBottom:9}}>
              <input value={precio} onChange={e=>setPrecio(e.target.value)} placeholder="Precio" type="number" min="0" style={{...iS,margin:0,flex:2}}/>
              <select value={tipo} onChange={e=>setTipo(e.target.value)} style={{...iS,margin:0,flex:1,cursor:"pointer"}}><option value="hora">/ hora</option><option value="clase">/ clase</option><option value="mes">/ mes</option></select>
            </div>
            <Label>Mensaje al estudiante</Label>
            <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Contale tu experiencia, disponibilidad, cómo podés ayudarlo..." style={{...iS,minHeight:80,resize:"vertical"}}/>
            <Btn onClick={enviar} disabled={saving||!msg.trim()} style={{width:"100%",padding:"10px",marginTop:4}}>{saving?"Enviando...":"Enviar oferta →"}</Btn>
          </div>
        </div>
      )}
    </>
  );
}

// ─── POST CARD ────────────────────────────────────────────────────────────────
function PostCard({post,session,onOpenChat,onOpenDetail}){
  const nombre=post.autor_nombre||post.autor_email?.split("@")[0]||"Usuario";
  const esMio=post.autor_email===session.user.email;
  return(
    <div onClick={()=>onOpenDetail(post)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"17px 19px",cursor:"pointer",transition:"border-color .2s,transform .15s",position:"relative",overflow:"hidden",fontFamily:FONT}}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.transform="translateY(-2px)";}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="translateY(0)";}}>
      <div style={{position:"absolute",top:0,left:0,width:"100%",height:3,background:post.tipo==="oferta"?C.success:C.accent}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:9,gap:8}}>
        <div style={{display:"flex",gap:9,alignItems:"center",minWidth:0}}>
          <Avatar letra={nombre[0]}/>
          <div style={{minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
              <span style={{fontWeight:600,color:C.text,fontSize:13}}>{nombre}</span>
              {post.verificado&&<VerifiedBadge/>}
            </div>
            <div style={{fontSize:11,color:C.muted,marginTop:1}}>{post.materia}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          <FavBtn post={post} session={session}/>
          <Tag tipo={post.tipo}/>
        </div>
      </div>
      <h3 style={{color:C.text,fontSize:14,fontWeight:700,margin:"0 0 4px",lineHeight:1.3}}>{post.titulo}</h3>
      <p style={{color:C.muted,fontSize:12,lineHeight:1.5,margin:"0 0 9px"}}>{post.descripcion?.slice(0,110)}{post.descripcion?.length>110?"...":""}</p>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:9}}>
        {post.modo==="curso"&&<span style={{fontSize:11,color:C.muted,background:C.surface,borderRadius:7,padding:"2px 7px"}}>📦 Curso</span>}
        {post.precio&&<span style={{fontSize:12,color:C.accent,fontWeight:700,background:C.accentDim,borderRadius:7,padding:"2px 8px"}}>💰 {fmtPrice(post.precio)}{post.precio_tipo&&post.modo!=="curso"?` /${post.precio_tipo}`:""}</span>}
        {post.fecha_inicio&&<span style={{fontSize:11,color:C.muted,background:C.surface,borderRadius:7,padding:"2px 7px"}}>📅 {fmt(post.fecha_inicio)}</span>}
      </div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}} onClick={e=>e.stopPropagation()}>
        {!esMio&&<button onClick={e=>{e.stopPropagation();onOpenChat(post);}} style={{background:C.accent,color:"#0D0D0D",border:"none",borderRadius:9,padding:"5px 12px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:FONT}}>💬 Contactar</button>}
        <OfertarBtn post={post} session={session}/>
        {esMio&&<span style={{fontSize:11,color:C.muted,fontStyle:"italic"}}>Tu publicación</span>}
      </div>
    </div>
  );
}

// ─── MY POST CARD ─────────────────────────────────────────────────────────────
function MyPostCard({post,onEdit,onToggle,onDelete,toggling}){
  const [confirmDelete,setConfirmDelete]=useState(false);
  const activo=post.activo!==false;
  return(
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 16px",position:"relative",overflow:"hidden",fontFamily:FONT}}>
      <div style={{position:"absolute",top:0,left:0,width:"100%",height:3,background:activo?post.tipo==="oferta"?C.success:C.accent:C.muted}}/>
      <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
            <Tag tipo={post.tipo}/><StatusBadge activo={activo}/>{post.verificado&&<VerifiedBadge/>}
          </div>
          <h3 style={{color:activo?C.text:C.muted,fontSize:13,fontWeight:700,margin:"0 0 3px"}}>{post.titulo}</h3>
          <p style={{color:C.muted,fontSize:12,margin:0,lineHeight:1.4}}>{post.descripcion?.slice(0,90)}</p>
          {post.precio&&<div style={{marginTop:5,fontSize:12,color:C.muted}}>💰 <span style={{color:C.accent,fontWeight:600}}>{fmtPrice(post.precio)}</span>{post.precio_tipo&&post.modo!=="curso"?` /${post.precio_tipo}`:""}</div>}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
          <button onClick={()=>onEdit(post)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"5px 10px",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:FONT}}>✏️ Editar</button>
          <button onClick={()=>onToggle(post)} disabled={toggling===post.id} style={{background:activo?"#E05C5C15":"#4ECB7115",border:`1px solid ${activo?"#E05C5C33":"#4ECB7133"}`,borderRadius:8,color:activo?C.danger:C.success,padding:"5px 10px",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:FONT,opacity:toggling===post.id?.5:1}}>
            {toggling===post.id?"...":(activo?"⏸ Pausar":"▶ Activar")}
          </button>
          {!confirmDelete
            ?<button onClick={()=>setConfirmDelete(true)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"5px 10px",cursor:"pointer",fontSize:11,fontFamily:FONT}}>🗑 Eliminar</button>
            :<div style={{display:"flex",flexDirection:"column",gap:3}}>
              <div style={{fontSize:10,color:C.danger,textAlign:"center"}}>¿Seguro?</div>
              <button onClick={()=>onDelete(post)} style={{background:C.danger,border:"none",borderRadius:8,color:"#fff",padding:"5px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:FONT}}>Sí</button>
              <button onClick={()=>setConfirmDelete(false)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"5px 10px",cursor:"pointer",fontSize:11,fontFamily:FONT}}>No</button>
            </div>}
        </div>
      </div>
    </div>
  );
}

// ─── MY POSTS PAGE ────────────────────────────────────────────────────────────
function MyPostsPage({session,onEdit,onNew}){
  const [posts,setPosts]=useState([]);const [loading,setLoading]=useState(true);const [toggling,setToggling]=useState(null);
  const cargar=useCallback(async()=>{setLoading(true);try{const d=await sb.getPublicaciones({},session.access_token);setPosts(d.filter(p=>p.autor_email===session.user.email));}finally{setLoading(false);};},[session]);
  useEffect(()=>{cargar();},[cargar]);
  const toggle=async(post)=>{setToggling(post.id);try{await sb.updatePublicacion(post.id,{activo:post.activo===false},session.access_token);await cargar();}catch(e){alert("Error: "+e.message);}finally{setToggling(null);};};
  const remove=async(post)=>{await sb.deletePublicacion(post.id,session.access_token);cargar();};
  return(
    <div style={{fontFamily:FONT}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div><h2 style={{fontSize:20,color:C.text,margin:"0 0 3px",fontWeight:700}}>Mis publicaciones</h2><p style={{color:C.muted,fontSize:12,margin:0}}>{posts.length} publicación{posts.length!==1?"es":""}</p></div>
        <Btn onClick={onNew} style={{padding:"7px 13px",fontSize:12}}>+ Nueva</Btn>
      </div>
      {loading?<Spinner/>:posts.length===0?(
        <div style={{textAlign:"center",padding:"60px 0"}}><div style={{fontSize:40,marginBottom:12}}>📭</div><p style={{color:C.muted,fontSize:13}}>Todavía no publicaste nada.</p><Btn onClick={onNew} style={{marginTop:12}}>Crear primera publicación</Btn></div>
      ):<div style={{display:"grid",gap:9}}>{posts.map(p=><MyPostCard key={p.id} post={p} onEdit={onEdit} onToggle={toggle} onDelete={remove} toggling={toggling}/>)}</div>}
    </div>
  );
}

// ─── INSCRIPCIONES PAGE ───────────────────────────────────────────────────────
function InscripcionesPage({session,onOpenCurso}){
  const [inscripciones,setInscripciones]=useState([]);const [posts,setPosts]=useState({});const [loading,setLoading]=useState(true);
  useEffect(()=>{
    sb.getMisInscripciones(session.user.email,session.access_token).then(async ins=>{
      setInscripciones(ins);
      const ids=[...new Set(ins.map(i=>i.publicacion_id))];
      if(ids.length>0){
        const pubs=await sb.getPublicaciones({},session.access_token);
        const map={};pubs.filter(p=>ids.includes(p.id)).forEach(p=>map[p.id]=p);
        setPosts(map);
      }
    }).finally(()=>setLoading(false));
  },[session]);
  if(loading)return <Spinner/>;
  return(
    <div style={{fontFamily:FONT}}>
      <h2 style={{fontSize:20,color:C.text,margin:"0 0 18px",fontWeight:700}}>Mis inscripciones</h2>
      {inscripciones.length===0?(
        <div style={{textAlign:"center",padding:"60px 0"}}><div style={{fontSize:40,marginBottom:12}}>📚</div><p style={{color:C.muted,fontSize:13}}>No estás inscripto en ningún curso.</p></div>
      ):(
        <div style={{display:"grid",gap:10}}>
          {inscripciones.map(ins=>{
            const p=posts[ins.publicacion_id];
            if(!p)return null;
            return(
              <div key={ins.id} onClick={()=>onOpenCurso(p)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 18px",cursor:"pointer",display:"flex",gap:14,alignItems:"center"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                <div style={{width:44,height:44,borderRadius:12,background:C.accentDim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>📦</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,color:C.text,fontSize:14,marginBottom:2}}>{p.titulo}</div>
                  <div style={{fontSize:12,color:C.muted}}>{p.materia} · {p.autor_nombre||p.autor_email?.split("@")[0]}</div>
                </div>
                <div style={{fontSize:11,color:C.muted,flexShrink:0}}>Inscripto {fmt(ins.created_at)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── CHATS PAGE ───────────────────────────────────────────────────────────────
function ChatsPage({session,onOpenChat}){
  const [chats,setChats]=useState([]);const [loading,setLoading]=useState(true);
  const miEmail=session.user.email;
  useEffect(()=>{
    sb.getMisChats(miEmail,session.access_token).then(msgs=>{
      const map={};
      msgs.forEach(m=>{
        const otro=m.de_nombre===miEmail?m.para_nombre:m.de_nombre;
        const key=`${m.publicacion_id}__${otro}`;
        if(!map[key])map[key]={pubId:m.publicacion_id,otro,ultimo:m,unread:0};
        if(m.de_nombre!==miEmail&&!m.leido)map[key].unread++;
      });
      setChats(Object.values(map));
    }).finally(()=>setLoading(false));
  },[miEmail,session.access_token]);
  return(
    <div style={{fontFamily:FONT}}>
      <h2 style={{fontSize:20,color:C.text,margin:"0 0 16px",fontWeight:700}}>Mis chats</h2>
      {loading?<Spinner/>:chats.length===0?(
        <div style={{textAlign:"center",padding:"60px 0"}}><div style={{fontSize:40,marginBottom:12}}>💬</div><p style={{color:C.muted,fontSize:13}}>No iniciaste ninguna conversación.</p></div>
      ):(
        <div style={{display:"grid",gap:7}}>
          {chats.map((c,i)=>(
            <div key={i} onClick={()=>onOpenChat({id:c.pubId,autor_email:c.otro,titulo:"Conversación",autor_nombre:c.otro.split("@")[0]})}
              style={{background:C.card,border:`1px solid ${c.unread>0?C.accent:C.border}`,borderRadius:13,padding:"11px 15px",cursor:"pointer",display:"flex",alignItems:"center",gap:11,transition:"border-color .15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=c.unread>0?C.accent:C.border}>
              <Avatar letra={c.otro[0]} size={36}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,color:C.text,fontSize:13,marginBottom:1}}>{c.otro.split("@")[0]}</div>
                <div style={{color:C.muted,fontSize:12,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.ultimo.texto}</div>
              </div>
              {c.unread>0&&<span style={{background:C.accent,color:"#0D0D0D",borderRadius:20,fontSize:10,fontWeight:700,padding:"2px 7px",flexShrink:0}}>{c.unread} nuevo{c.unread!==1?"s":""}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CHAT MODAL ───────────────────────────────────────────────────────────────
function ChatModal({post,session,onClose,onUnreadChange}){
  const miEmail=session.user.email;
  const otroEmail=post.autor_email;
  const [msgs,setMsgs]=useState([]);const [input,setInput]=useState("");const [loading,setLoading]=useState(true);
  const bottomRef=useRef(null);
  const cargar=useCallback(async()=>{
    try{
      const data=await sb.getMensajes(post.id,miEmail,otroEmail,session.access_token);
      setMsgs(data);setLoading(false);
      setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),50);
      // Marcar como leídos al abrir
      await sb.marcarLeidos(post.id,miEmail,session.access_token).catch(()=>{});
      if(onUnreadChange)onUnreadChange();
    }catch(e){console.error(e);}
  },[post.id,miEmail,otroEmail,session.access_token]);
  useEffect(()=>{cargar();const t=setInterval(cargar,3000);return()=>clearInterval(t);},[cargar]);
  const send=async()=>{
    if(!input.trim())return;
    const txt=input;setInput("");
    try{await sb.insertMensaje({publicacion_id:post.id,de_nombre:miEmail,para_nombre:otroEmail,texto:txt,leido:false},session.access_token);cargar();}
    catch(e){alert("Error al enviar: "+e.message);}
  };
  const nombre=post.autor_nombre||otroEmail?.split("@")[0]||"Usuario";
  return(
    <div style={{position:"fixed",inset:0,background:"#000a",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FONT}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:18,width:"min(460px,95vw)",maxHeight:"84vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"13px 17px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <Avatar letra={nombre[0]} size={32}/>
            <div><div style={{fontWeight:700,color:C.text,fontSize:13}}>{nombre}</div><div style={{fontSize:11,color:C.muted}}>{post.titulo}</div></div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:21,cursor:"pointer"}}>×</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"11px 15px",display:"flex",flexDirection:"column",gap:6,minHeight:150}}>
          {loading?<Spinner/>:msgs.length===0?<div style={{color:C.muted,textAlign:"center",padding:22,fontSize:13}}>Empezá la conversación 👋</div>
            :msgs.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.de_nombre===miEmail?"flex-end":"flex-start"}}>
                <div style={{background:m.de_nombre===miEmail?C.accent:C.card,color:m.de_nombre===miEmail?"#0D0D0D":C.text,padding:"7px 11px",borderRadius:12,maxWidth:"80%",fontSize:13,lineHeight:1.5}}>{m.texto}</div>
              </div>
            ))}
          <div ref={bottomRef}/>
        </div>
        <div style={{padding:"9px 13px",borderTop:`1px solid ${C.border}`,display:"flex",gap:7}}>
          <Input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Escribí un mensaje..."/>
          <button onClick={send} style={{background:C.accent,border:"none",borderRadius:9,padding:"9px 12px",fontWeight:700,cursor:"pointer",color:"#0D0D0D",fontSize:15,flexShrink:0}}>↑</button>
        </div>
      </div>
    </div>
  );
}

// ─── CALENDARIO ────────────────────────────────────────────────────────────────
function CalendarioCurso({post}){
  const [mesOffset,setMesOffset]=useState(0);const [diaSelec,setDiaSelec]=useState(null);
  const clasesSinc=useRef(null);
  if(!clasesSinc.current){try{clasesSinc.current=post.clases_sinc?JSON.parse(post.clases_sinc):[];}catch{clasesSinc.current=[];}}
  const cs=clasesSinc.current;
  if(cs.length===0)return null;
  const hoy=new Date();
  const base=new Date(hoy.getFullYear(),hoy.getMonth()+mesOffset,1);
  const year=base.getFullYear();const month=base.getMonth();
  const primerDia=(base.getDay()+6)%7;
  const diasEnMes=new Date(year,month+1,0).getDate();
  const inicio=post.fecha_inicio?new Date(post.fecha_inicio):null;
  const fin=post.fecha_fin?new Date(post.fecha_fin):null;
  const DIAS_NOMBRES=["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
  const claseDias=new Set();
  for(let d=1;d<=diasEnMes;d++){
    const fecha=new Date(year,month,d);
    if(inicio&&fecha<inicio)continue;
    if(fin&&fecha>fin)continue;
    const diaSemana=(fecha.getDay()+6)%7;
    if(cs.some(c=>c.dia===DIAS_NOMBRES[diaSemana]))claseDias.add(d);
  }
  const clasesDelDia=(d)=>{const dn=DIAS_NOMBRES[(new Date(year,month,d).getDay()+6)%7];return cs.filter(c=>c.dia===dn);};
  const celdas=[];for(let i=0;i<primerDia;i++)celdas.push(null);for(let d=1;d<=diasEnMes;d++)celdas.push(d);
  const mesLabel=base.toLocaleDateString("es-AR",{month:"long",year:"numeric"});
  return(
    <div style={{background:C.card,borderRadius:14,padding:14,border:`1px solid ${C.border}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <button onClick={()=>setMesOffset(m=>m-1)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"3px 10px",cursor:"pointer",fontFamily:FONT,fontSize:16}}>‹</button>
        <span style={{color:C.text,fontWeight:600,fontSize:13,textTransform:"capitalize"}}>{mesLabel}</span>
        <button onClick={()=>setMesOffset(m=>m+1)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"3px 10px",cursor:"pointer",fontFamily:FONT,fontSize:16}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:3}}>
        {["Lu","Ma","Mi","Ju","Vi","Sá","Do"].map(d=><div key={d} style={{textAlign:"center",fontSize:10,color:C.muted,fontWeight:600,padding:"2px 0"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {celdas.map((d,i)=>{
          if(!d)return <div key={i}/>;
          const tc=claseDias.has(d);const esHoy=d===hoy.getDate()&&month===hoy.getMonth()&&year===hoy.getFullYear();const sel=diaSelec===d;
          return(
            <div key={i} onClick={()=>tc&&setDiaSelec(sel?null:d)} style={{textAlign:"center",padding:"5px 1px",borderRadius:7,fontSize:12,fontWeight:tc?700:400,background:sel?C.accent:tc?C.accentDim:"transparent",color:sel?"#0D0D0D":tc?C.accent:esHoy?C.text:C.muted,border:esHoy?`1px solid ${C.border}`:"1px solid transparent",cursor:tc?"pointer":"default",position:"relative"}}>
              {d}
              {tc&&!sel&&<div style={{width:4,height:4,background:C.accent,borderRadius:"50%",margin:"1px auto 0"}}/>}
            </div>
          );
        })}
      </div>
      {diaSelec&&clasesDelDia(diaSelec).map((c,i)=>(
        <div key={i} style={{marginTop:9,background:C.accentDim,border:`1px solid #F5C84233`,borderRadius:9,padding:"9px 13px",display:"flex",alignItems:"center",gap:9}}>
          <span style={{fontSize:16}}>🕐</span>
          <div>
            <div style={{color:C.accent,fontWeight:700,fontSize:12}}>{c.dia} {new Date(year,month,diaSelec).toLocaleDateString("es-AR",{day:"numeric",month:"short"})}</div>
            <div style={{color:C.text,fontSize:13}}>{c.hora_inicio} → {c.hora_fin}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── CURSO MODAL (inscripto) ───────────────────────────────────────────────────
function CursoModal({post,session,onClose}){
  const [contenido,setContenido]=useState([]);const [loading,setLoading]=useState(true);
  const [inscripcion,setInscripcion]=useState(null);const [inscLoading,setInscLoading]=useState(true);
  const [inscripciones,setInscripciones]=useState([]);
  const esMio=post.autor_email===session.user.email;
  const miEmail=session.user.email;

  useEffect(()=>{
    Promise.all([
      sb.getContenido(post.id,session.access_token),
      sb.getMisInscripciones(miEmail,session.access_token),
      esMio?sb.getInscripciones(post.id,session.access_token):Promise.resolve([]),
    ]).then(([cont,misIns,todos])=>{
      setContenido(cont);
      setInscripcion(misIns.find(i=>i.publicacion_id===post.id)||null);
      if(esMio)setInscripciones(todos);
    }).finally(()=>{setLoading(false);setInscLoading(false);});
  },[post.id,miEmail,esMio,session]);

  const inscribirse=async()=>{
    setInscLoading(true);
    try{const r=await sb.insertInscripcion({publicacion_id:post.id,alumno_email:miEmail},session.access_token);setInscripcion(r[0]);}
    finally{setInscLoading(false);}
  };
  const desinscribirse=async()=>{
    if(!inscripcion)return;setInscLoading(true);
    try{await sb.deleteInscripcion(inscripcion.id,session.access_token);setInscripcion(null);}
    finally{setInscLoading(false);}
  };

  // Contenido editor (solo profesor)
  const [showAddContenido,setShowAddContenido]=useState(false);
  const [nuevoTipo,setNuevoTipo]=useState("video");const [nuevoTitulo,setNuevoTitulo]=useState("");const [nuevoUrl,setNuevoUrl]=useState("");const [nuevoTexto,setNuevoTexto]=useState("");const [savingContenido,setSavingContenido]=useState(false);
  const addContenido=async()=>{
    if(!nuevoTitulo.trim())return;setSavingContenido(true);
    try{
      const data={publicacion_id:post.id,tipo:nuevoTipo,titulo:nuevoTitulo,orden:contenido.length+1};
      if(nuevoTipo!=="texto")data.url=nuevoUrl;else data.texto=nuevoTexto;
      const r=await sb.insertContenido(data,session.access_token);
      setContenido(prev=>[...prev,r[0]]);setNuevoTitulo("");setNuevoUrl("");setNuevoTexto("");setShowAddContenido(false);
    }finally{setSavingContenido(false);}
  };
  const removeContenido=async(id)=>{await sb.deleteContenido(id,session.access_token);setContenido(prev=>prev.filter(c=>c.id!==id));};

  const tieneAcceso=esMio||!!inscripcion;
  const iS={width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:FONT,marginBottom:8};

  return(
    <Modal onClose={onClose} width="min(680px,95vw)">
      <div style={{padding:"20px 22px"}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div style={{flex:1,minWidth:0,paddingRight:12}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
              <Tag tipo={post.tipo}/>
              {post.verificado&&<VerifiedBadge/>}
              {post.modo==="curso"&&<span style={{fontSize:11,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"2px 8px",color:C.muted}}>📦 Curso</span>}
              {post.sinc&&<span style={{fontSize:11,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"2px 8px",color:C.muted}}>{post.sinc==="sinc"?"🔴 Sincrónico":"📹 Asincrónico"}</span>}
            </div>
            <h2 style={{color:C.text,fontSize:18,fontWeight:700,margin:"0 0 4px"}}>{post.titulo}</h2>
            <p style={{color:C.muted,fontSize:13,margin:0}}>{post.materia} · {post.autor_nombre||post.autor_email?.split("@")[0]}</p>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:21,cursor:"pointer",flexShrink:0}}>×</button>
        </div>

        {/* Info chips */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
          {post.precio&&<Chip label="PRECIO" val={fmtPrice(post.precio)}/>}
          {post.duracion_curso&&<Chip label="DURACIÓN" val={post.duracion_curso}/>}
          {post.fecha_inicio&&<Chip label="INICIO" val={fmt(post.fecha_inicio)}/>}
          {post.fecha_fin&&<Chip label="FIN" val={fmt(post.fecha_fin)}/>}
          {esMio&&<Chip label="INSCRIPTOS" val={`${inscripciones.length} alumno${inscripciones.length!==1?"s":""}`}/>}
        </div>

        {/* Inscripción */}
        {!esMio&&(
          <div style={{background:inscripcion?"#4ECB7115":C.card,border:`1px solid ${inscripcion?"#4ECB7133":C.border}`,borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <div>
              <div style={{color:inscripcion?C.success:C.text,fontWeight:600,fontSize:13}}>{inscripcion?"✓ Inscripto en este curso":"¿Te interesa este curso?"}</div>
              <div style={{color:C.muted,fontSize:12,marginTop:2}}>{inscripcion?`Inscripto el ${fmt(inscripcion.created_at)}`:"Inscribite para acceder al contenido y calendario"}</div>
            </div>
            {inscLoading?<Spinner small/>:(
              inscripcion
                ?<button onClick={desinscribirse} style={{background:"none",border:`1px solid ${C.danger}`,borderRadius:9,color:C.danger,padding:"6px 12px",cursor:"pointer",fontSize:12,fontFamily:FONT}}>Desincribirme</button>
                :<Btn onClick={inscribirse} variant="success" style={{padding:"8px 16px",fontSize:13}}>Inscribirme gratis →</Btn>
            )}
          </div>
        )}

        {/* Alumnos (solo para el docente) */}
        {esMio&&inscripciones.length>0&&(
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 16px",marginBottom:16}}>
            <div style={{fontWeight:600,color:C.text,fontSize:13,marginBottom:10}}>👥 Alumnos inscriptos</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {inscripciones.map(ins=>(
                <div key={ins.id} style={{display:"flex",alignItems:"center",gap:9}}>
                  <Avatar letra={ins.alumno_email[0]} size={28}/>
                  <span style={{color:C.text,fontSize:13}}>{ins.alumno_email.split("@")[0]}</span>
                  <span style={{color:C.muted,fontSize:11,marginLeft:"auto"}}>{fmt(ins.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Calendario */}
        {post.sinc==="sinc"&&tieneAcceso&&(
          <div style={{marginBottom:16}}>
            <div style={{fontWeight:600,color:C.text,fontSize:13,marginBottom:8}}>📅 Calendario de clases</div>
            <CalendarioCurso post={post}/>
          </div>
        )}

        {/* Contenido */}
        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontWeight:600,color:C.text,fontSize:13}}>📋 Contenido del curso ({contenido.length})</div>
            {esMio&&<button onClick={()=>setShowAddContenido(v=>!v)} style={{background:C.accentDim,border:`1px solid #F5C84233`,borderRadius:8,color:C.accent,padding:"5px 11px",cursor:"pointer",fontSize:12,fontFamily:FONT}}>+ Agregar</button>}
          </div>

          {/* Form add contenido */}
          {esMio&&showAddContenido&&(
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",marginBottom:12}}>
              <div style={{display:"flex",gap:6,marginBottom:9}}>
                {["video","archivo","texto"].map(t=>(
                  <button key={t} onClick={()=>setNuevoTipo(t)} style={{flex:1,padding:"6px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",background:nuevoTipo===t?C.accent:C.surface,color:nuevoTipo===t?"#0D0D0D":C.muted,border:`1px solid ${nuevoTipo===t?"transparent":C.border}`,fontFamily:FONT}}>
                    {t==="video"?"🎬 Video":t==="archivo"?"📁 Archivo":"📝 Texto"}
                  </button>
                ))}
              </div>
              <input value={nuevoTitulo} onChange={e=>setNuevoTitulo(e.target.value)} placeholder="Título de la clase o recurso" style={iS}/>
              {nuevoTipo!=="texto"
                ?<input value={nuevoUrl} onChange={e=>setNuevoUrl(e.target.value)} placeholder={nuevoTipo==="video"?"URL del video (YouTube, Vimeo...)":"URL del archivo (Drive, Dropbox...)"} style={iS}/>
                :<textarea value={nuevoTexto} onChange={e=>setNuevoTexto(e.target.value)} placeholder="Contenido de la clase..." style={{...iS,minHeight:80,resize:"vertical"}}/>
              }
              <div style={{display:"flex",gap:8}}>
                <Btn onClick={addContenido} disabled={savingContenido||!nuevoTitulo.trim()} style={{padding:"7px 14px",fontSize:12}}>{savingContenido?"Guardando...":"Guardar"}</Btn>
                <button onClick={()=>setShowAddContenido(false)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:9,color:C.muted,padding:"7px 14px",cursor:"pointer",fontSize:12,fontFamily:FONT}}>Cancelar</button>
              </div>
            </div>
          )}

          {loading?<Spinner/>:contenido.length===0?(
            <div style={{textAlign:"center",padding:"30px 0",color:C.muted,fontSize:13}}>
              {esMio?"Aún no agregaste contenido. ¡Empezá cargando tu primera clase!":"El docente aún no cargó contenido."}
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {contenido.map((c,i)=>(
                <div key={c.id} style={{background:C.card,border:`1px solid ${tieneAcceso?C.border:C.border+"55"}`,borderRadius:12,padding:"12px 15px",opacity:tieneAcceso?1:.55}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:9,flex:1,minWidth:0}}>
                      <div style={{width:32,height:32,borderRadius:9,background:C.surface,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                        {c.tipo==="video"?"🎬":c.tipo==="archivo"?"📁":"📝"}
                      </div>
                      <div style={{minWidth:0}}>
                        <div style={{fontWeight:600,color:C.text,fontSize:13}}>{i+1}. {c.titulo}</div>
                        {c.tipo==="texto"&&c.texto&&tieneAcceso&&<p style={{color:C.muted,fontSize:12,margin:"4px 0 0",lineHeight:1.5}}>{c.texto}</p>}
                        {c.tipo!=="texto"&&c.url&&tieneAcceso&&(
                          <a href={c.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{color:C.accent,fontSize:12,textDecoration:"none"}}>
                            {c.tipo==="video"?"▶ Ver video":"📥 Abrir archivo"}
                          </a>
                        )}
                        {!tieneAcceso&&<div style={{color:C.muted,fontSize:11,marginTop:2}}>🔒 Inscribite para ver este contenido</div>}
                      </div>
                    </div>
                    {esMio&&<button onClick={()=>removeContenido(c.id)} style={{background:"none",border:"none",color:C.danger,fontSize:16,cursor:"pointer",flexShrink:0,padding:"0 2px"}}>×</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── DETAIL MODAL ─────────────────────────────────────────────────────────────
function DetailModal({post,session,onClose,onChat,onOpenCurso}){
  const [reseñas,setReseñas]=useState([]);const [reseñasUsuario,setReseñasUsuario]=useState([]);
  const [reseña,setReseña]=useState("");const [estrella,setEstrella]=useState(5);
  const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [err,setErr]=useState("");
  const nombre=post.autor_nombre||post.autor_email?.split("@")[0]||"Usuario";
  const esMio=post.autor_email===session.user.email;

  useEffect(()=>{
    Promise.all([
      sb.getReseñas(post.id,session.access_token),
      sb.getReseñasByAutor(post.autor_email,session.access_token),
    ]).then(([pub,usr])=>{setReseñas(pub);setReseñasUsuario(usr);}).finally(()=>setLoading(false));
  },[post.id,post.autor_email,session.access_token]);

  const avgPub=calcAvg(reseñas);
  const avgUser=calcAvg(reseñasUsuario);

  const enviar=async()=>{
    if(!reseña.trim()){setErr("Escribí tu reseña");return;}
    setSaving(true);setErr("");
    try{
      const mn=session.user.email.split("@")[0];
      await sb.insertReseña({publicacion_id:post.id,autor_nombre:mn,autor_pub_email:post.autor_email,texto:reseña,estrellas:estrella},session.access_token);
      const[pub,usr]=await Promise.all([sb.getReseñas(post.id,session.access_token),sb.getReseñasByAutor(post.autor_email,session.access_token)]);
      setReseñas(pub);setReseñasUsuario(usr);setReseña("");
    }catch(e){setErr("Error: "+e.message);}finally{setSaving(false);}
  };

  return(
    <Modal onClose={onClose} width="min(660px,95vw)">
      <div style={{padding:"19px 21px"}}>
        {/* Header autor */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <Avatar letra={nombre[0]} size={48}/>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:3}}>
                <span style={{fontWeight:700,color:C.text,fontSize:15}}>{nombre}</span>
                {post.verificado&&<VerifiedBadge/>}
              </div>
              {/* Valoracion usuario (todas sus publicaciones) */}
              <div style={{fontSize:11,color:C.muted,marginBottom:2}}>Valoración del docente:</div>
              {loading?<Spinner small/>:<StarRating val={avgUser} count={reseñasUsuario.length}/>}
              <div style={{marginTop:5}}><Tag tipo={post.tipo}/></div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:21,cursor:"pointer",flexShrink:0}}>×</button>
        </div>

        {/* Valoracion publicacion */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:3}}>VALORACIÓN DE ESTA PUBLICACIÓN</div>
            {loading?<Spinner small/>:<StarRating val={avgPub} count={reseñas.length}/>}
          </div>
          <div style={{width:1,height:30,background:C.border}}/>
          <div>
            <div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:3}}>MATERIA</div>
            <span style={{background:C.accentDim,color:C.accent,fontSize:12,fontWeight:600,padding:"2px 9px",borderRadius:7}}>{post.materia}</span>
          </div>
        </div>

        <h2 style={{color:C.text,fontSize:18,fontWeight:700,margin:"0 0 7px"}}>{post.titulo}</h2>
        <p style={{color:C.muted,fontSize:13,lineHeight:1.7,marginBottom:14}}>{post.descripcion}</p>

        {/* Chips modo/precio/fechas */}
        {post.tipo==="oferta"&&(
          <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>
            {post.modo==="curso"?(
              <><Chip label="MODALIDAD" val="📦 Curso"/>{post.sinc&&<Chip label="TIPO" val={post.sinc==="sinc"?"🔴 Sincrónico":"📹 Asincrónico"}/>}{post.precio&&<Chip label="PRECIO CURSO" val={fmtPrice(post.precio)}/>}{post.duracion_curso&&<Chip label="DURACIÓN" val={post.duracion_curso}/>}{post.fecha_inicio&&<Chip label="INICIO" val={fmt(post.fecha_inicio)}/>}{post.fecha_fin&&<Chip label="FIN" val={fmt(post.fecha_fin)}/>}</>
            ):(
              <><Chip label="MODALIDAD" val="👤 Clase particular"/>{post.precio&&<Chip label="PRECIO" val={`${fmtPrice(post.precio)} /${post.precio_tipo||"hora"}`}/>}<Chip label="HORARIO" val="A convenir"/></>
            )}
          </div>
        )}

        {/* Acciones */}
        <div style={{display:"flex",gap:9,flexWrap:"wrap",marginBottom:post.tipo==="oferta"&&post.modo==="curso"&&post.sinc==="sinc"?0:16}}>
          {!esMio&&<button onClick={()=>{onClose();onChat(post);}} style={{background:C.accent,color:"#0D0D0D",border:"none",borderRadius:11,padding:"9px 18px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:FONT}}>💬 Iniciar conversación</button>}
          {post.tipo==="oferta"&&<button onClick={()=>{onClose();onOpenCurso(post);}} style={{background:"#4ECB7122",color:C.success,border:"1px solid #4ECB7144",borderRadius:11,padding:"9px 18px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:FONT}}>📚 Ver curso</button>}
          <OfertarBtn post={post} session={session}/>
        </div>

        {/* Calendario preview */}
        {post.tipo==="oferta"&&post.modo==="curso"&&post.sinc==="sinc"&&(
          <div style={{margin:"14px 0"}}>
            <div style={{fontWeight:600,color:C.text,fontSize:13,marginBottom:7}}>📅 Calendario de clases</div>
            <CalendarioCurso post={post}/>
          </div>
        )}

        {/* Reseñas */}
        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:14}}>
          <h4 style={{color:C.text,marginBottom:11,fontSize:13}}>Reseñas de esta publicación ({reseñas.length})</h4>
          {loading?<Spinner/>:reseñas.map(r=>(
            <div key={r.id} style={{background:C.card,borderRadius:11,padding:"10px 13px",marginBottom:8}}>
              <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:4}}>
                <Avatar letra={r.autor_nombre?.[0]||"?"} size={26}/>
                <span style={{fontWeight:600,color:C.text,fontSize:12}}>{r.autor_nombre}</span>
                <span style={{color:C.accent,fontSize:11}}>{"★".repeat(r.estrellas||0)}</span>
              </div>
              <p style={{color:C.muted,fontSize:12,margin:0,lineHeight:1.5}}>{r.texto}</p>
            </div>
          ))}
          {!esMio&&(
            <div style={{marginTop:12}}>
              <div style={{display:"flex",gap:3,marginBottom:7}}>{[1,2,3,4,5].map(n=><button key={n} onClick={()=>setEstrella(n)} style={{background:"none",border:"none",fontSize:19,cursor:"pointer",color:n<=estrella?C.accent:C.border}}>★</button>)}</div>
              <textarea value={reseña} onChange={e=>setReseña(e.target.value)} placeholder="Dejá tu reseña..." style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",resize:"vertical",minHeight:65,boxSizing:"border-box",fontFamily:FONT}}/>
              <ErrMsg msg={err}/>
              <Btn onClick={enviar} disabled={saving} variant="ghost" style={{marginTop:6,color:C.accent,border:`1px solid ${C.accent}`,fontSize:12,padding:"6px 13px"}}>{saving?"Guardando...":"Publicar reseña"}</Btn>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── VERIFICACIÓN IA ──────────────────────────────────────────────────────────
function VerificacionIA({titulo,materia,onVerificado}){
  const [pregunta,setPregunta]=useState("");const [respuesta,setRespuesta]=useState("");
  const [estado,setEstado]=useState("cargando");const [feedback,setFeedback]=useState("");
  useEffect(()=>{
    if(!titulo||!materia)return;
    setEstado("cargando");setRespuesta("");setPregunta("");setFeedback("");
    sb.verificarConIA(titulo,materia,"").then(r=>{setPregunta(r.pregunta||"Contá tu experiencia en el tema.");setEstado("esperando");}).catch(()=>{setPregunta("Contá brevemente tu experiencia enseñando este tema.");setEstado("esperando");});
  },[titulo,materia]);
  const evaluar=async()=>{
    if(!respuesta.trim())return;setEstado("evaluando");
    try{const r=await sb.verificarConIA(titulo,materia,respuesta);setFeedback(r.feedback||"");if(r.correcta){setEstado("ok");onVerificado();}else setEstado("error");}
    catch{setEstado("error");setFeedback("No se pudo evaluar, podés continuar igual.");}
  };
  if(estado==="ok")return <div style={{color:C.success,fontSize:12,padding:"7px 11px",background:"#4ECB7115",borderRadius:8,border:"1px solid #4ECB7133"}}>✓ ¡Verificado! Tu publicación tendrá la insignia.</div>;
  return(
    <div style={{background:C.accentDim,border:`1px solid #F5C84233`,borderRadius:10,padding:13,marginTop:8}}>
      <div style={{color:C.accent,fontSize:10,fontWeight:700,marginBottom:5,letterSpacing:1}}>✓ VERIFICACIÓN DE CONOCIMIENTO (IA)</div>
      {estado==="cargando"?<div style={{color:C.muted,fontSize:13,display:"flex",alignItems:"center",gap:7}}><Spinner small/>Generando pregunta...</div>:<>
        <p style={{color:C.text,fontSize:13,marginBottom:7,lineHeight:1.5}}>{pregunta}</p>
        <textarea value={respuesta} onChange={e=>setRespuesta(e.target.value)} placeholder="Tu respuesta..." style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 11px",color:C.text,fontSize:13,outline:"none",resize:"vertical",minHeight:56,boxSizing:"border-box",fontFamily:FONT,marginBottom:7}}/>
        {estado==="error"&&<div style={{color:C.danger,fontSize:11,marginBottom:6}}>{feedback||"Respuesta incorrecta. Intentá de nuevo."}</div>}
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={evaluar} disabled={estado==="evaluando"||!respuesta.trim()} style={{background:C.accent,color:"#0D0D0D",border:"none",borderRadius:8,padding:"6px 13px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:FONT,opacity:!respuesta.trim()?.5:1}}>{estado==="evaluando"?"Evaluando...":"Verificar →"}</button>
          <button onClick={onVerificado} style={{background:"none",border:"none",color:C.muted,fontSize:11,cursor:"pointer",fontFamily:FONT}}>Omitir</button>
        </div>
      </>}
    </div>
  );
}

// ─── POST FORM MODAL ──────────────────────────────────────────────────────────
function PostFormModal({session,postToEdit,onClose,onSave}){
  const editing=!!postToEdit;
  const [tipo,setTipo]=useState(postToEdit?.tipo||"busqueda");
  const [materia,setMateria]=useState(postToEdit?.materia||"");
  const [titulo,setTitulo]=useState(postToEdit?.titulo||"");
  const [descripcion,setDescripcion]=useState(postToEdit?.descripcion||"");
  const [modo,setModo]=useState(postToEdit?.modo||"particular");
  const [precio,setPrecio]=useState(postToEdit?.precio||"");
  const [precioTipo,setPrecioTipo]=useState(postToEdit?.precio_tipo||"hora");
  const [sinc,setSinc]=useState(postToEdit?.sinc||"sinc");
  const [duracionCurso,setDuracionCurso]=useState(postToEdit?.duracion_curso||"");
  const [fechaInicio,setFechaInicio]=useState(postToEdit?.fecha_inicio||"");
  const [fechaFin,setFechaFin]=useState(postToEdit?.fecha_fin||"");
  const [clasesSinc,setClasesSinc]=useState(()=>{try{return postToEdit?.clases_sinc?JSON.parse(postToEdit.clases_sinc):[]}catch{return [];}});
  const [verificado,setVerificado]=useState(postToEdit?.verificado||false);
  const [saving,setSaving]=useState(false);const [err,setErr]=useState("");

  const addClase=()=>setClasesSinc(prev=>[...prev,{dia:"Lunes",hora_inicio:"09:00",hora_fin:"10:00"}]);
  const updClase=(i,f,v)=>setClasesSinc(prev=>prev.map((c,idx)=>idx===i?{...c,[f]:v}:c));
  const remClase=(i)=>setClasesSinc(prev=>prev.filter((_,idx)=>idx!==i));

  const iS={width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:9,fontFamily:FONT};

  const guardar=async()=>{
    if(!titulo||!descripcion||!materia){setErr("Completá título, materia y descripción");return;}
    setSaving(true);setErr("");
    try{
      const nombre=session.user.email.split("@")[0];
      const data={tipo,materia,titulo,descripcion,autor_email:session.user.email,autor_nombre:nombre,autor_avatar:nombre[0].toUpperCase(),activo:true,verificado,modo};
      if(tipo==="oferta"){
        if(precio)data.precio=parseFloat(precio);
        if(modo==="particular")data.precio_tipo=precioTipo;
        else{data.sinc=sinc;data.duracion_curso=duracionCurso;if(fechaInicio)data.fecha_inicio=fechaInicio;if(fechaFin)data.fecha_fin=fechaFin;if(sinc==="sinc")data.clases_sinc=JSON.stringify(clasesSinc);}
      }
      if(editing){await sb.updatePublicacion(postToEdit.id,data,session.access_token);onSave();}
      else{const r=await sb.insertPublicacion(data,session.access_token);onSave(r[0]);}
      onClose();
    }catch(e){setErr("Error: "+e.message);}finally{setSaving(false);}
  };

  return(
    <Modal onClose={onClose}>
      <div style={{padding:"20px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
          <h3 style={{color:C.text,margin:0,fontSize:16,fontWeight:700}}>{editing?"Editar publicación":"Nueva publicación"}</h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:21,cursor:"pointer"}}>×</button>
        </div>
        <div style={{display:"flex",gap:7,marginBottom:11}}>
          {["busqueda","oferta"].map(t=>(
            <button key={t} onClick={()=>setTipo(t)} style={{flex:1,padding:"8px",borderRadius:9,fontWeight:700,fontSize:12,cursor:"pointer",background:tipo===t?(t==="oferta"?C.success:C.accent):C.card,color:tipo===t?"#0D0D0D":C.muted,border:`1px solid ${tipo===t?"transparent":C.border}`,fontFamily:FONT}}>
              {t==="busqueda"?"🔍 Busco clases":"📚 Ofrezco clases"}
            </button>
          ))}
        </div>
        <select value={materia} onChange={e=>setMateria(e.target.value)} style={{...iS,cursor:"pointer"}}><option value="">Seleccioná una materia</option>{MATERIAS.map(m=><option key={m} value={m}>{m}</option>)}</select>
        <input value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Título del curso o clase" style={iS}/>
        <textarea value={descripcion} onChange={e=>setDescripcion(e.target.value)} placeholder="Descripción..." style={{...iS,minHeight:72,resize:"vertical"}}/>

        {tipo==="oferta"&&(
          <>
            <Label>Modalidad</Label>
            <div style={{display:"flex",gap:7,marginBottom:11}}>
              {[{v:"particular",l:"👤 Clase particular"},{v:"curso",l:"📦 Curso"}].map(({v,l})=>(
                <button key={v} onClick={()=>setModo(v)} style={{flex:1,padding:"7px",borderRadius:9,fontWeight:600,fontSize:12,cursor:"pointer",background:modo===v?C.accent:C.card,color:modo===v?"#0D0D0D":C.muted,border:`1px solid ${modo===v?"transparent":C.border}`,fontFamily:FONT}}>{l}</button>
              ))}
            </div>
            {modo==="particular"&&(
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10,marginBottom:4}}>
                <Label>Precio (horario a convenir)</Label>
                <div style={{display:"flex",gap:7}}>
                  <input value={precio} onChange={e=>setPrecio(e.target.value)} placeholder="Precio" type="number" min="0" style={{...iS,margin:0,flex:2}}/>
                  <select value={precioTipo} onChange={e=>setPrecioTipo(e.target.value)} style={{...iS,margin:0,flex:1,cursor:"pointer"}}><option value="hora">/ hora</option><option value="clase">/ clase</option></select>
                </div>
              </div>
            )}
            {modo==="curso"&&(
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}>
                <Label>Precio del curso completo</Label>
                <input value={precio} onChange={e=>setPrecio(e.target.value)} placeholder="Precio total" type="number" min="0" style={iS}/>
                <Label>Duración total</Label>
                <input value={duracionCurso} onChange={e=>setDuracionCurso(e.target.value)} placeholder="Ej: 8 semanas, 20 horas..." style={iS}/>
                <Label>Tipo</Label>
                <div style={{display:"flex",gap:7,marginBottom:9}}>
                  {[{v:"sinc",l:"🔴 Sincrónico"},{v:"asinc",l:"📹 Asincrónico"}].map(({v,l})=>(
                    <button key={v} onClick={()=>setSinc(v)} style={{flex:1,padding:"7px",borderRadius:9,fontWeight:600,fontSize:12,cursor:"pointer",background:sinc===v?C.accent:C.card,color:sinc===v?"#0D0D0D":C.muted,border:`1px solid ${sinc===v?"transparent":C.border}`,fontFamily:FONT}}>{l}</button>
                  ))}
                </div>
                <div style={{display:"flex",gap:7,marginBottom:9}}>
                  <div style={{flex:1}}><Label>Fecha inicio</Label><input type="date" value={fechaInicio} onChange={e=>setFechaInicio(e.target.value)} style={{...iS,margin:0,colorScheme:"dark"}}/></div>
                  <div style={{flex:1}}><Label>Fecha fin</Label><input type="date" value={fechaFin} onChange={e=>setFechaFin(e.target.value)} style={{...iS,margin:0,colorScheme:"dark"}}/></div>
                </div>
                {sinc==="sinc"&&(
                  <>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                      <Label>Horarios recurrentes</Label>
                      <button onClick={addClase} style={{background:C.accentDim,border:`1px solid #F5C84244`,borderRadius:7,color:C.accent,padding:"3px 9px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:FONT}}>+ Agregar</button>
                    </div>
                    {clasesSinc.length===0&&<div style={{color:C.muted,fontSize:11,marginBottom:8,fontStyle:"italic"}}>Agregá los horarios semanales.</div>}
                    {clasesSinc.map((c,i)=>(
                      <div key={i} style={{display:"flex",gap:5,alignItems:"center",marginBottom:6,background:C.card,borderRadius:9,padding:"7px 9px",border:`1px solid ${C.border}`}}>
                        <select value={c.dia} onChange={e=>updClase(i,"dia",e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"4px 7px",color:C.text,fontSize:11,fontFamily:FONT,cursor:"pointer",outline:"none",flex:2}}>
                          {["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"].map(d=><option key={d}>{d}</option>)}
                        </select>
                        <input type="time" value={c.hora_inicio} onChange={e=>updClase(i,"hora_inicio",e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"4px 7px",color:C.text,fontSize:11,fontFamily:FONT,outline:"none",colorScheme:"dark",flex:2}}/>
                        <span style={{color:C.muted,fontSize:11}}>→</span>
                        <input type="time" value={c.hora_fin} onChange={e=>updClase(i,"hora_fin",e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"4px 7px",color:C.text,fontSize:11,fontFamily:FONT,outline:"none",colorScheme:"dark",flex:2}}/>
                        <button onClick={()=>remClase(i)} style={{background:"none",border:"none",color:C.danger,fontSize:15,cursor:"pointer",flexShrink:0}}>×</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
            {titulo&&materia&&!verificado&&<VerificacionIA titulo={titulo} materia={materia} onVerificado={()=>setVerificado(true)}/>}
            {verificado&&<div style={{color:C.success,fontSize:11,padding:"5px 10px",background:"#4ECB7115",borderRadius:7,border:"1px solid #4ECB7133",marginTop:5}}>✓ Conocimiento verificado</div>}
          </>
        )}
        <ErrMsg msg={err}/>
        <Btn onClick={guardar} disabled={saving} style={{width:"100%",padding:"10px",fontSize:13,marginTop:11,borderRadius:11}}>{saving?"Guardando...":editing?"Guardar cambios":"Publicar"}</Btn>
      </div>
    </Modal>
  );
}

// ─── EXPLORE PAGE ─────────────────────────────────────────────────────────────
function ExplorePage({session,onOpenChat,onOpenDetail}){
  const [posts,setPosts]=useState([]);const [loading,setLoading]=useState(true);
  const [filtroTipo,setFiltroTipo]=useState("all");const [filtroMateria,setFiltroMateria]=useState("");const [busqueda,setBusqueda]=useState("");
  const cargar=useCallback(async()=>{
    setLoading(true);
    try{const f={};if(filtroTipo!=="all")f.tipo=filtroTipo;if(filtroMateria)f.materia=filtroMateria;const d=await sb.getPublicaciones(f,session.access_token);setPosts(d.filter(p=>p.activo!==false));}
    finally{setLoading(false);}
  },[session,filtroTipo,filtroMateria]);
  useEffect(()=>{cargar();},[cargar]);
  const filtered=posts.filter(p=>!busqueda||p.titulo?.toLowerCase().includes(busqueda.toLowerCase())||p.descripcion?.toLowerCase().includes(busqueda.toLowerCase()));
  return(
    <div style={{fontFamily:FONT}}>
      <div style={{marginBottom:22}}>
        <h1 style={{fontSize:"clamp(20px,4vw,32px)",fontWeight:700,margin:"0 0 5px",lineHeight:1.2}}>Conectá con el <span style={{color:C.accent}}>conocimiento</span></h1>
        <p style={{color:C.muted,fontSize:13,margin:0}}>Publicá lo que querés aprender o lo que podés enseñar.</p>
      </div>
      <Input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="🔍  Buscá por tema..." style={{marginBottom:11,background:C.surface,padding:"10px 14px"}}/>
      <div style={{display:"flex",gap:6,marginBottom:9,flexWrap:"wrap"}}>
        {["all","busqueda","oferta"].map(t=>(
          <button key={t} onClick={()=>setFiltroTipo(t)} style={{background:filtroTipo===t?C.accent:C.surface,color:filtroTipo===t?"#0D0D0D":C.muted,border:`1px solid ${filtroTipo===t?C.accent:C.border}`,borderRadius:20,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:FONT}}>
            {t==="all"?"Todo":t==="busqueda"?"🔍 Búsquedas":"📚 Ofertas"}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:5,marginBottom:20,overflowX:"auto",paddingBottom:3}}>
        {["Todas",...MATERIAS].map(m=>(
          <button key={m} onClick={()=>setFiltroMateria(m==="Todas"?"":m)} style={{background:(m==="Todas"&&!filtroMateria)||filtroMateria===m?C.accent:C.card,color:(m==="Todas"&&!filtroMateria)||filtroMateria===m?"#0D0D0D":C.muted,border:"none",borderRadius:20,padding:"5px 10px",fontSize:11,fontWeight:(m==="Todas"&&!filtroMateria)||filtroMateria===m?700:400,cursor:"pointer",whiteSpace:"nowrap",fontFamily:FONT}}>
            {m}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:9,marginBottom:18,flexWrap:"wrap"}}>
        {[{label:"Activas",val:posts.length},{label:"Búsquedas",val:posts.filter(p=>p.tipo==="busqueda").length},{label:"Docentes",val:posts.filter(p=>p.tipo==="oferta").length}].map(s=>(
          <div key={s.label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:11,padding:"10px 15px",flex:1,minWidth:80}}>
            <div style={{fontSize:22,fontWeight:700,color:C.accent}}>{s.val}</div>
            <div style={{color:C.muted,fontSize:11}}>{s.label}</div>
          </div>
        ))}
      </div>
      {loading?<Spinner/>:filtered.length===0?(
        <div style={{textAlign:"center",color:C.muted,padding:"46px 0",fontSize:13}}>{posts.length===0?"¡Sé el primero en publicar! 🚀":"Sin resultados."}</div>
      ):<div style={{display:"grid",gap:11}}>{filtered.map(p=><PostCard key={p.id} post={p} session={session} onOpenChat={onOpenChat} onOpenDetail={onOpenDetail}/>)}</div>}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const [session,setSession]=useState(()=>sb.loadSession());
  const [page,setPage]=useState("explore");
  const [chatPost,setChatPost]=useState(null);
  const [detailPost,setDetailPost]=useState(null);
  const [cursoPost,setCursoPost]=useState(null);
  const [showForm,setShowForm]=useState(false);
  const [editPost,setEditPost]=useState(null);
  const [myPostsKey,setMyPostsKey]=useState(0);
  const [unread,setUnread]=useState(0);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [isMobile,setIsMobile]=useState(window.innerWidth<768);

  useEffect(()=>{const fn=()=>setIsMobile(window.innerWidth<768);window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);

  const sessionRef=useRef(session);
  useEffect(()=>{sessionRef.current=session;},[session]);
  useEffect(()=>{
    sb.setSessionRefreshCallback(async()=>{
      const c=sessionRef.current;if(!c?.refresh_token)return null;
      try{const s=await sb.refreshSession(c.refresh_token);sb.saveSession(s);setSession(s);return s;}
      catch{sb.clearSession();setSession(null);return null;}
    });
  },[]);

  const refreshUnread=useCallback(()=>{
    if(!session)return;
    sb.getMisChats(session.user.email,session.access_token).then(msgs=>{
      setUnread(msgs.filter(m=>m.de_nombre!==session.user.email&&!m.leido).length);
    }).catch(()=>{});
  },[session]);

  useEffect(()=>{refreshUnread();const t=setInterval(refreshUnread,15000);return()=>clearInterval(t);},[refreshUnread]);

  const logout=()=>{sb.clearSession();setSession(null);};

  if(!session)return(
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;margin:0;padding:0}html,body,#root{background:${C.bg};min-height:100vh;font-family:${FONT}}`}</style>
      <AuthScreen onLogin={s=>{sb.saveSession(s);setSession(s);}}/>
    </>
  );

  const SW=isMobile?0:224;
  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:FONT,color:C.text,display:"flex"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}html,body,#root{background:${C.bg};min-height:100vh;font-family:${FONT}}::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}`}</style>
      <Sidebar page={page} setPage={setPage} session={session} onLogout={logout} onNewPost={()=>{setEditPost(null);setShowForm(true);}} unreadCount={unread} mobile={isMobile} open={sidebarOpen} onClose={()=>setSidebarOpen(false)}/>
      {isMobile&&(
        <div style={{position:"fixed",top:0,left:0,right:0,height:50,background:C.sidebar,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 13px",zIndex:50}}>
          <button onClick={()=>setSidebarOpen(true)} style={{background:"none",border:"none",color:C.text,fontSize:21,cursor:"pointer"}}>☰</button>
          <span style={{fontFamily:"Georgia,serif",fontSize:15,fontWeight:700,color:C.text}}>Classe<span style={{color:C.accent}}>Link</span></span>
          <Btn onClick={()=>{setEditPost(null);setShowForm(true);}} style={{padding:"5px 9px",fontSize:11}}>+ Publicar</Btn>
        </div>
      )}
      <main style={{marginLeft:SW,flex:1,padding:isMobile?"66px 13px 22px":"32px 32px",minHeight:"100vh",maxWidth:`calc(100vw - ${SW}px)`}}>
        <div style={{maxWidth:820,margin:"0 auto"}}>
          {page==="explore"&&<ExplorePage session={session} onOpenChat={setChatPost} onOpenDetail={setDetailPost}/>}
          {page==="chats"&&<ChatsPage session={session} onOpenChat={setChatPost}/>}
          {page==="myposts"&&<MyPostsPage key={myPostsKey} session={session} onEdit={p=>{setEditPost(p);setShowForm(true);}} onNew={()=>{setEditPost(null);setShowForm(true);}}/>}
          {page==="inscripciones"&&<InscripcionesPage session={session} onOpenCurso={setCursoPost}/>}
        </div>
      </main>
      {chatPost&&<ChatModal post={chatPost} session={session} onClose={()=>setChatPost(null)} onUnreadChange={refreshUnread}/>}
      {detailPost&&<DetailModal post={detailPost} session={session} onClose={()=>setDetailPost(null)} onChat={p=>{setDetailPost(null);setChatPost(p);}} onOpenCurso={p=>{setDetailPost(null);setCursoPost(p);}}/>}
      {cursoPost&&<CursoModal post={cursoPost} session={session} onClose={()=>setCursoPost(null)}/>}
      {showForm&&<PostFormModal session={session} postToEdit={editPost} onClose={()=>{setShowForm(false);setEditPost(null);}} onSave={()=>setMyPostsKey(k=>k+1)}/>}
    </div>
  );
}
