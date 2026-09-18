function DetailScreen({ design, onEdit }) {
  const { Canvas, CanvasNode, CanvasEdge, Boundary, Button, Tag, SectionLabel, ComponentRow, PropertyTable, StatusText } = window.DS;
  const d = design || window.KIT.designs[1];

  return (
    <div style={{padding:"var(--sp-3)",display:"flex",flexDirection:"column",gap:"var(--sp-3)",maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:"var(--sp-2)"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"var(--sp-0-5)",minWidth:0}}>
          <div style={{display:"flex",gap:"var(--sp-1)",alignItems:"baseline",flexWrap:"wrap"}}>
            <span style={{fontSize:"var(--fs-display)",fontWeight:"var(--fw-semibold)",letterSpacing:"var(--ls-display)",lineHeight:"var(--lh-tight)"}}>{d.title}</span>
            {d.provider && <Tag mono>{d.provider}</Tag>}
            {d.visibility && <Tag>{d.visibility}</Tag>}
          </div>
          <div style={{color:"var(--muted)"}}>{d.description || "No summary."}</div>
          <div style={{display:"flex",gap:"var(--sp-1)",fontSize:"var(--fs-meta)",color:"var(--muted)",marginTop:4}}>
            <span>{d.author}</span><span>·</span><span>{d.componentCount} components</span>
            {d.clones != null && <><span>·</span><span>{d.clones} clones</span></>}
          </div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:"var(--sp-1)"}}>
          <Button size="sm">Clone</Button>
          <Button size="sm" variant="primary" onClick={onEdit}>Open in editor</Button>
        </div>
      </div>

      <Canvas height={320}>
        <Boundary label="us-east-1 (region)" />
        {window.KIT.edges.map((e,i) => <CanvasEdge key={i} x={e.x} y={e.y-30} length={e.len} dashed={e.dashed!==false} rotate={e.rotate||0} />)}
        {window.KIT.nodes.map((n) => <CanvasNode key={n.id} {...n} y={n.y-30} taxonomy={n.tax} />)}
      </Canvas>

      <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.3fr) minmax(0,1fr)",gap:"var(--sp-3)",alignItems:"start"}}>
        <Panel label="Components">
          <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--rp)",overflow:"hidden"}}>
            {window.KIT.nodes.map((n,i) => (
              <ComponentRow key={n.id} name={n.label} slug={n.kind} kind={n.kind} icon={n.icon} iconKind={n.iconKind||"component"} last={i===window.KIT.nodes.length-1} />
            ))}
          </div>
        </Panel>
        <Panel label="Requirements">
          <PropertyTable columns={["requirement","value","status"]} rows={[
            ["replay","true",{label:"failing",tone:"err"}],
            ["delivery","at-least-once",{label:"met",tone:"ok"}],
            ["rpo","5m",{label:"met",tone:"ok"}],
            ["persistence","true",{label:"failing",tone:"err"}],
          ]} />
          <div style={{display:"flex",gap:"var(--sp-1)",alignItems:"center"}}>
            <StatusText tone="err">2 requirements unmet</StatusText>
          </div>
        </Panel>
      </div>
    </div>
  );
}
window.DetailScreen = DetailScreen;
