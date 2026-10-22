// Outline icons for the sidebar: 24x24 viewBox, stroke only.
// Each icon is a list of path `d` strings; paths must be unique within one icon
// because the path string is used as the v-for key.
export const navIcons = {
  dashboard: ['M4 4h7v9H4z', 'M13 4h7v5h-7z', 'M13 11h7v9h-7z', 'M4 15h7v5H4z'],
  box: ['M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'M4 7.5l8 4.5 8-4.5', 'M12 12v9'],
  clipboard: ['M9 3.5h6v3H9z', 'M9 5H6v15.5h12V5h-3', 'M9 11h6', 'M9 15h6'],
  card: ['M3 6h18v12H3z', 'M3 10h18', 'M6.5 14.5h4'],
  trending: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
  bars: ['M4 20h16', 'M7 20v-7', 'M12 20V5', 'M17 20V10'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
}
