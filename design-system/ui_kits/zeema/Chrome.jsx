function TopBar({ view, setView, theme, setTheme, right }) {
  const { Button, StatusText } = window.DS;
  const tabs = [["editor","Editor"],["findings","Findings"],["browse","Browse"],["detail","Design"],["catalog","Catalog"],["auth","Sign in"]];
  return (
    <header style={{display:"flex",alignItems:"center",gap:"var(--sp-3)",padding:"var(--sp-1-5) var(--sp-3)",borderBottom:"1px solid var(--line)",background:"var(--panel)"}}>
      <span style={{fontWeight:"var(--fw-semibold)",fontSize:"var(--fs-title)",letterSpacing:"var(--ls-title)"}}>Zeema</span>
      <nav style={{display:"flex",gap:"var(--sp-0-5)"}}>
        {tabs.map(([id,label]) => (
          <button key={id} onClick={() => setView(id)} style={{
            font:"inherit",fontSize:"var(--fs-small)",padding:"5px 11px",borderRadius:"var(--rc)",cursor:"pointer",
            border:"1px solid "+(view===id?"var(--line)":"transparent"),
            background:view===id?"var(--bg)":"transparent",
            color:view===id?"var(--ink)":"var(--muted)",fontWeight:view===id?"var(--fw-medium)":"var(--fw-regular)",whiteSpace:"nowrap"}}>{label}</button>
        ))}
      </nav>
      <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"var(--sp-1-5)"}}>
        {right}
        <Button size="sm" variant="ghost" onClick={() => setTheme(theme==="dark"?"light":"dark")}>{theme==="dark"?"light":"dark"}</Button>
      </div>
    </header>
  );
}

function Panel({ label, children, style, scroll = false }) {
  const { SectionLabel } = window.DS;
  return (
    <section style={{display:"flex",flexDirection:"column",gap:"var(--sp-1-5)",minHeight:0,minWidth:0,...style}}>
      {label && <SectionLabel>{label}</SectionLabel>}
      <div style={{minHeight:0,minWidth:0,...(scroll?{overflow:"auto"}:null),display:"flex",flexDirection:"column",gap:"var(--sp-1-5)"}}>{children}</div>
    </section>
  );
}

Object.assign(window, { TopBar, Panel });
