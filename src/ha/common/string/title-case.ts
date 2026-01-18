export const titleCase = (s: string) =>
  s.replace(/^_*(.)|_+(.)/g, (_s, c, d) =>
    c ? c.toUpperCase() : " " + d.toUpperCase()
  );
