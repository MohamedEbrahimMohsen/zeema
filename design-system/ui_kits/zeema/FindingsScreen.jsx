function FindingsScreen({ onJump }) {
  const { FindingsPanel, Finding, PropertyTable, Button, EmptyState, SectionLabel, Tag } = window.DS;
  const [filter, setFilter] = React.useState("all");
  const all = window.KIT.findings;
  const shown = filter === "all" ? all : all.filter((f) => f.severity === filter);

  return (
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.4fr) minmax(0,1fr)",gap:"var(--sp-3)",padding:"var(--sp-3)",alignItems:"start"}}>
      <Panel label="Findings · order-processing">
        <div style={{display:"flex",gap:"var(--sp-1)"}}>
          {[["all","All"],["err","Errors"],["warn","Warnings"]].map(([id,l]) => (
            <Button key={id} size="sm" variant={filter===id?"primary":"secondary"} onClick={() => setFilter(id)}>{l}</Button>
          ))}
          <Button size="sm" variant="ghost" style={{marginLeft:"auto"}}>Re-run checks</Button>
        </div>
        {shown.length ? (
          <FindingsPanel errors={all.filter(f=>f.severity==="err").length} warnings={all.filter(f=>f.severity==="warn").length} info={0}>
            {shown.map((f,i) => (
              <div key={i} onClick={() => onJump && onJump(f.target.replace("node ",""))} style={{cursor:"pointer"}}>
                <Finding {...f} />
              </div>
            ))}
          </FindingsPanel>
        ) : <EmptyState>Nothing matches. Try <span style={{fontFamily:"var(--mono)"}}>all</span>.</EmptyState>}
      </Panel>

      <Panel label="Rule · cache-missing-eviction-policy">
        <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--rp)",padding:"var(--sp-2)",display:"flex",flexDirection:"column",gap:"var(--sp-1)"}}>
          <div style={{display:"flex",gap:"var(--sp-1)",alignItems:"center"}}>
            <Tag>warning</Tag><Tag mono>cache</Tag>
          </div>
          <div style={{fontSize:"0.9em"}}>A cache without an eviction policy grows until it is evicted by the host, at an unpredictable moment. Set one explicitly.</div>
        </div>
        <SectionLabel>Properties checked</SectionLabel>
        <PropertyTable rows={[
          ["evictionPolicy","enum",{label:"required",tone:"err"}],
          ["maxMemory","string","none"],
          ["persistence","boolean","false"],
        ]} />
      </Panel>
    </div>
  );
}
window.FindingsScreen = FindingsScreen;
