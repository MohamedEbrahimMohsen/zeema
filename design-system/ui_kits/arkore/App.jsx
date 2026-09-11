function App() {
  const [view, setView] = React.useState("editor");
  const [theme, setTheme] = React.useState("light");
  const [selected, setSelected] = React.useState("orders");
  const [design, setDesign] = React.useState(null);

  React.useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);

  const screens = {
    editor: <EditorScreen selected={selected} setSelected={setSelected} onOpenFindings={() => setView("findings")} />,
    findings: <FindingsScreen onJump={(id) => { setSelected(id); setView("editor"); }} />,
    browse: <BrowseScreen onOpen={(d) => { setDesign(d); setView("detail"); }} />,
    detail: <DetailScreen design={design} onEdit={() => setView("editor")} />,
    catalog: <CatalogScreen />,
    auth: <AuthScreen />,
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)", fontFamily: "var(--sans)", fontSize: "var(--fs)" }}>
      <TopBar view={view} setView={setView} theme={theme} setTheme={setTheme} />
      {screens[view]}
    </div>
  );
}
window.App = App;
