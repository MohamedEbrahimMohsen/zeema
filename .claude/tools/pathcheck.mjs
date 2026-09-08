// Is an SVG path's data legal? Shared by the icon generator, which must never emit a path a
// browser will refuse, and by the icon check that proves it did not.
const ARITY = { m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, z: 0 };

// Read one number starting at i; returns [value length, ok]
function number(s, i) {
  const m = /^[\s,]*(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/.exec(s.slice(i));
  return m ? m[0].length : 0;
}
function flag(s, i) {
  const m = /^[\s,]*([01])/.exec(s.slice(i));
  return m ? m[0].length : 0;
}

function scan(d) {
  const problems = [];
  let i = 0;
  let cmd = null;
  while (i < d.length) {
    if (/[\s,]/.test(d[i])) { i++; continue; }
    if (/[A-Za-z]/.test(d[i])) { cmd = d[i]; i++; if (cmd.toLowerCase() === "z") continue; }
    if (!cmd) { problems.push(`stray "${d[i]}" before any command`); break; }
    const low = cmd.toLowerCase();
    if (low === "a") {
      let ok = true;
      for (const step of [number, number, number, flag, flag, number, number]) {
        const n = step(d, i);
        if (!n) { ok = false; break; }
        i += n;
      }
      if (!ok) { problems.push(`arc ${cmd} is missing an argument`); break; }
      continue;
    }
    const arity = ARITY[low];
    if (arity === undefined) { problems.push(`unknown command ${cmd}`); break; }
    let ok = true;
    for (let k = 0; k < arity; k++) {
      const n = number(d, i);
      if (!n) { ok = false; break; }
      i += n;
    }
    if (!ok) { problems.push(`${cmd} wants ${arity} number${arity === 1 ? "" : "s"} per step and ran out`); break; }
  }
  return problems;
}

export function pathIsValid(d) { return scan(d).length === 0; }
export { scan };

