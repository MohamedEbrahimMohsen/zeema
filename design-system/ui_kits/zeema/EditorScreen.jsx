function EditorScreen({ selected, setSelected, onOpenFindings }) {
  const { Canvas, CanvasNode, CanvasEdge, Boundary, ContextMenu, Field, Select, TextInput, Checkbox, Radio,
          Disclosure, SectionLabel, Button, StatusText, Tag, Icon } = window.DS;
  const [menu, setMenu] = React.useState(null);
  const [dirty, setDirty] = React.useState(false);
  const node = window.KIT.nodes.find((n) => n.id === selected) || window.KIT.nodes[2];

  return (
    <div style={{display:"grid",gridTemplateColumns:"210px minmax(0,1fr) 280px",gap:"var(--sp-3)",padding:"var(--sp-3)",alignItems:"start"}}>

      <Panel label="Palette" style={{gap:"var(--sp-1)"}}>
        <TextInput placeholder="kind:queue" />
        <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--rp)",overflow:"hidden",maxHeight:330,overflowY:"auto"}}>
          {window.KIT.catalog.slice(0,10).map((c,i) => (
            <div key={c.slug} style={{display:"flex",alignItems:"center",gap:"var(--sp-1)",padding:"7px 10px",borderBottom:i<9?"1px solid var(--line)":"none",cursor:"grab"}}>
              <Icon src={c.icon} kind={c.iconKind||"component"} size="var(--icon-sm)" />
              <span style={{fontSize:"var(--fs-small)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name}</span>
              <span style={{marginLeft:"auto",fontFamily:"var(--mono)",fontSize:"var(--fs-micro)",color:"var(--muted)",whiteSpace:"nowrap",flexShrink:0}}>{c.kind}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <div style={{display:"flex",alignItems:"baseline",gap:"var(--sp-1-5)"}}>
          <span style={{fontWeight:"var(--fw-medium)"}}>Order processing</span>
          <Tag mono>aws</Tag>
          <StatusText tone={dirty?"warn":"ok"}>{dirty?"unsaved":"saved"}</StatusText>
          <div style={{marginLeft:"auto",display:"flex",gap:"var(--sp-1)"}}>
            <Button size="sm" onClick={onOpenFindings}>2 errors</Button>
            <Button size="sm" variant="primary" onClick={() => setDirty(false)}>Save</Button>
          </div>
        </div>
        <div onClick={() => setMenu(null)} style={{position:"relative"}}>
          <Canvas height={380}>
            <Boundary label="us-east-1 (region)" />
            {window.KIT.edges.map((e,i) => <CanvasEdge key={i} x={e.x} y={e.y} length={e.len} dashed={e.dashed!==false} rotate={e.rotate||0} />)}
            {window.KIT.nodes.map((n) => (
              <CanvasNode key={n.id} {...n} taxonomy={n.tax} selected={n.id===node.id}
                onClick={(ev) => { ev.stopPropagation(); setSelected(n.id); setMenu(null); }}
                onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); setSelected(n.id); setMenu({x:ev.nativeEvent.offsetX+n.x,y:ev.nativeEvent.offsetY+n.y}); }}
                style={{cursor:"pointer"}} />
            ))}
          </Canvas>
          {menu && (
            <div style={{position:"absolute",left:Math.min(menu.x,460),top:menu.y}}>
              <ContextMenu items={[
                {label:"Group",shortcut:"G",active:true},
                {label:"Duplicate",shortcut:"⌃D"},
                {label:"Ungroup",shortcut:"⌃⇧G",disabled:true},
                {separator:true},
                {label:"Delete",shortcut:"⌫",danger:true},
              ]} />
            </div>
          )}
        </div>
      </Panel>

      <Panel label={"Inspector · " + node.label}>
        <div style={{display:"flex",alignItems:"center",gap:"var(--sp-1)"}}>
          <Icon src={node.icon} kind={node.iconKind||"component"} />
          <span style={{fontWeight:"var(--fw-medium)"}}>{node.label}</span>
          <span style={{fontFamily:"var(--mono)",fontSize:"0.8em",color:"var(--muted)"}}>{node.kind}</span>
        </div>
        <Field label="name" hint="string · required"><TextInput value={node.label} onChange={() => setDirty(true)} /></Field>
        <Field label="delivery" hint="enum · required">
          <Select options={["at-least-once","exactly-once"]} onChange={() => setDirty(true)} />
        </Field>
        <Field label="ordering" hint="enum · inherited from kind" inherited><TextInput placeholder="unset (none)" /></Field>
        <Checkbox label="deadLetterQueue" defaultChecked onChange={() => setDirty(true)} />
        <SectionLabel style={{marginTop:"var(--sp-1)"}}>Visibility</SectionLabel>
        <div style={{display:"flex",gap:"var(--sp-2)"}}>
          <Radio name="vis" label="Private" defaultChecked /><Radio name="vis" label="Public" />
        </div>
        <Disclosure title="messaging" meta="· 1 set" open>
          <div style={{fontFamily:"var(--mono)",fontSize:"0.9em",color:"var(--muted)"}}>replay → <span style={{color:"var(--ink)"}}>true</span></div>
        </Disclosure>
      </Panel>
    </div>
  );
}
window.EditorScreen = EditorScreen;
