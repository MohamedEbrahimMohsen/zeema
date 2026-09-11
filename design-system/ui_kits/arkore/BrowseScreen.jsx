function BrowseScreen({ onOpen }) {
  const { DesignCard, TextInput, Button, EmptyState, SectionLabel, Tag } = window.DS;
  const [q, setQ] = React.useState("");
  const [provider, setProvider] = React.useState(null);
  const list = window.KIT.designs.filter((d) =>
    (!q || (d.title + " " + (d.description || "")).toLowerCase().includes(q.toLowerCase())) &&
    (!provider || d.provider === provider));

  return (
    <div style={{padding:"var(--sp-3)",display:"flex",flexDirection:"column",gap:"var(--sp-2)"}}>
      <div style={{display:"flex",gap:"var(--sp-1-5)",alignItems:"center"}}>
        <div style={{maxWidth:340,flex:1}}><TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search designs, or kind:queue" /></div>
        <div style={{display:"flex",gap:"var(--sp-0-5)"}}>
          {["aws","gcp","cloudflare"].map((p) => (
            <button key={p} onClick={() => setProvider(provider===p?null:p)} style={{
              font:"inherit",fontFamily:"var(--mono)",fontSize:"var(--fs-meta)",padding:"2px 10px",borderRadius:"var(--r-round)",cursor:"pointer",
              border:"1px solid "+(provider===p?"var(--accent)":"var(--line)"),
              background:provider===p?"var(--accent)":"transparent",
              color:provider===p?"var(--accent-ink)":"var(--muted)"}}>{p}</button>
          ))}
        </div>
        <Button variant="primary" size="sm" style={{marginLeft:"auto"}}>New design</Button>
      </div>
      <SectionLabel>{list.length} design{list.length===1?"":"s"}</SectionLabel>
      {list.length ? (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:"var(--sp-2)"}}>
          {list.map((d) => (
            <div key={d.title} onClick={() => onOpen && onOpen(d)} style={{cursor:"pointer"}}>
              <DesignCard {...d} thumbnail={<Thumb kind={d.thumb} title={d.title} />} />
            </div>
          ))}
        </div>
      ) : <EmptyState>Nothing matches. Try a product name, or <span style={{fontFamily:"var(--mono)"}}>kind:queue</span>.</EmptyState>}
    </div>
  );
}
window.BrowseScreen = BrowseScreen;
