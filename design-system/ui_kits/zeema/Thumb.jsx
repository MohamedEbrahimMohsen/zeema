function Thumb({ kind, title }) {
  if (kind === "diagram") {
    const boxes = [["14%","30%","rose"],["42%","22%","blue"],["42%","56%","green"],["70%","40%","amber"]];
    return (
      <>
        {boxes.map(([l,t,c]) => <div key={c} style={{position:"absolute",left:l,top:t,width:"18%",height:"22%",borderRadius:4,background:`var(--t-${c}-fill)`,border:`1px solid var(--t-${c}-line)`}} />)}
        <div style={{position:"absolute",left:"32%",top:"41%",width:"10%",borderTop:"1px solid var(--muted)"}} />
        <div style={{position:"absolute",left:"60%",top:"36%",width:"10%",borderTop:"1px solid var(--muted)",transform:"rotate(25deg)"}} />
        <div style={{position:"absolute",left:"60%",top:"64%",width:"10%",borderTop:"1px dashed var(--muted)",transform:"rotate(-25deg)"}} />
      </>
    );
  }
  if (kind === "plate") {
    return (
      <div style={{position:"absolute",inset:0,display:"grid",placeItems:"center",background:"var(--t-blue-fill)",padding:16,textAlign:"center"}}>
        <span style={{fontWeight:"var(--fw-semibold)",fontSize:"1.3em",letterSpacing:"var(--ls-display)",lineHeight:"var(--lh-tight)"}}>{title}</span>
      </div>
    );
  }
  return (
    <div style={{position:"absolute",inset:0,display:"grid",placeItems:"center",background:"repeating-linear-gradient(135deg,var(--bg) 0 8px,var(--panel) 8px 16px)"}}>
      <span style={{fontFamily:"var(--mono)",fontSize:"var(--fs-micro)",color:"var(--muted)",background:"var(--panel)",padding:"2px 8px",borderRadius:"var(--rc)",border:"1px solid var(--line)"}}>brand mark · {title.toLowerCase()}</span>
    </div>
  );
}
window.Thumb = Thumb;
