function CatalogScreen() {
  const { ComponentRow, TextInput, EmptyState, SectionLabel, Icon, PropertyTable, Tag, Button } = window.DS;
  const [q, setQ] = React.useState("");
  const [pick, setPick] = React.useState(window.KIT.catalog[0]);
  const list = window.KIT.catalog.filter((c) =>
    !q || (c.name + " " + c.slug + " " + c.kind + " " + (c.provider||"")).toLowerCase().includes(q.toLowerCase()));

  return (
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.5fr) 300px",gap:"var(--sp-3)",padding:"var(--sp-3)",alignItems:"start"}}>
      <Panel label={"Component catalog · " + list.length + " of " + window.KIT.catalog.length}>
        <div style={{maxWidth:340}}><TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="sqs, kind:queue, aws" /></div>
        {list.length ? (
          <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--rp)",overflow:"hidden",maxHeight:480,overflowY:"auto"}}>
            {list.map((c,i) => (
              <div key={c.slug} onClick={() => setPick(c)} style={{cursor:"pointer",background:pick.slug===c.slug?"var(--bg)":"transparent"}}>
                <ComponentRow {...c} iconKind={c.iconKind||"component"} last={i===list.length-1} />
              </div>
            ))}
          </div>
        ) : <EmptyState>Nothing matches. Try a product name, or <span style={{fontFamily:"var(--mono)"}}>kind:queue</span>.</EmptyState>}
      </Panel>

      <Panel label="Kind schema">
        <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--rp)",padding:"var(--sp-2)",display:"flex",flexDirection:"column",gap:"var(--sp-1)"}}>
          <div style={{display:"flex",gap:"var(--sp-1)",alignItems:"center"}}>
            <Icon src={pick.icon} kind={pick.iconKind||"component"} size="var(--icon-lg)" />
            <div style={{display:"flex",flexDirection:"column"}}>
              <span style={{fontWeight:"var(--fw-medium)"}}>{pick.name}</span>
              <span style={{fontFamily:"var(--mono)",fontSize:"0.8em",color:"var(--muted)"}}>{pick.slug}</span>
            </div>
          </div>
          <div style={{display:"flex",gap:"var(--sp-0-5)",flexWrap:"wrap"}}>
            {pick.provider && <Tag mono>{pick.provider}</Tag>}<Tag>{pick.kind}</Tag>
          </div>
        </div>
        <PropertyTable rows={[
          ["delivery","enum",{label:"required",tone:"err"}],
          ["ordering","enum","none"],
          ["replay","boolean","false"],
          ["deadLetterQueue","boolean","true"],
        ]} />
        <Button size="sm">Add to design</Button>
      </Panel>
    </div>
  );
}
window.CatalogScreen = CatalogScreen;
