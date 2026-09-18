function AuthScreen() {
  const { Button, Field, TextInput, EmptyState, SectionLabel, Icon } = window.DS;
  return (
    <div style={{padding:"var(--sp-3)",display:"grid",gridTemplateColumns:"360px minmax(0,1fr)",gap:"var(--sp-6)",alignItems:"start",maxWidth:1000,margin:"0 auto"}}>
      <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--rp)",padding:"var(--sp-3)",display:"flex",flexDirection:"column",gap:"var(--sp-2)"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"var(--sp-0-5)"}}>
          <span style={{fontSize:"var(--fs-title)",fontWeight:"var(--fw-semibold)",letterSpacing:"var(--ls-title)"}}>Zeema</span>
          <span style={{color:"var(--muted)",fontSize:"var(--fs-small)"}}>Architecture as typed, queryable data.</span>
        </div>
        <Field label="email" hint="string · required"><TextInput placeholder="you@company.com" /></Field>
        <Button variant="primary">Continue</Button>
        <div style={{height:1,background:"var(--line)"}} />
        <Button icon={<Icon src="../../assets/icons/providers/github.svg" kind="provider" size="var(--icon-sm)" />}>Continue with GitHub</Button>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:"var(--sp-3)"}}>
        <Panel label="Empty · search">
          <EmptyState>Nothing matches. Try a product name, or <span style={{fontFamily:"var(--mono)"}}>kind:queue</span>.</EmptyState>
        </Panel>
        <Panel label="Empty · no designs yet">
          <EmptyState>No designs yet. Start from a component, or <span style={{fontFamily:"var(--mono)"}}>clone</span> one from Browse.</EmptyState>
        </Panel>
        <Panel label="Empty · page level">
          <EmptyState variant="panel" title="Not found" action={<Button size="sm">Browse designs</Button>}>
            There is no design or person at this address, or it is private.
          </EmptyState>
        </Panel>
      </div>
    </div>
  );
}
window.AuthScreen = AuthScreen;
