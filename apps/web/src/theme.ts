import type {ThemeConfig} from 'antd';

/** Single source for CSS custom properties and Ant Design's generated colors. */
export const palette = {
  "navy": "#101B2A",
  "blue": "#0E57AD",
  "yellow": "#F1B72B",
  "white": "#FFFFFF",
  "light": "#F4F7FB",
  "red": "#D9363E",
  "blueHover": "#084486",
  "blueTint": "#E7EFF9",
  "yellowHover": "#FFCC4D",
  "yellowInk": "#705000",
  "yellowTint": "#FFF4D3",
  "ink": "#101B2A",
  "muted": "#53647A",
  "line": "#CBD5E2",
  "darkPanel": "#182B43",
  "darkRaised": "#213A56",
  "darkMuted": "#B7C7DC",
  "darkLine": "#405773",
  "redTint": "#FCECEE"
} as const;
export function installPalette() {
  for (const [name, value] of Object.entries(palette)) {
    document.documentElement.style.setProperty('--kfl-' + name.replace(/[A-Z]/g, c => '-' + c.toLowerCase()), value);
  }
}
export const arenaTheme: ThemeConfig = {
  token: {
    colorPrimary: palette.blue, colorInfo: palette.blue, colorSuccess: palette.blue,
    colorWarning: palette.yellowInk, colorError: palette.yellowInk,
    colorBgBase: palette.white, colorBgLayout: palette.light,
    colorBgContainer: palette.white, colorBgElevated: palette.white,
    colorText: palette.ink, colorTextSecondary: palette.muted,
    colorBorder: palette.line, colorTextPlaceholder: palette.muted,
    borderRadius: 8, controlHeight: 44, fontSize: 14,
    fontFamily: '"DM Sans", Arial, sans-serif', motionDurationMid: '0.16s',
  },
  components: {
    Button: {primaryColor: palette.white, fontWeight: 600},
    Table: {headerBg: palette.navy, headerColor: palette.white, rowHoverBg: palette.blueTint, borderColor: palette.line},
    Tabs: {inkBarColor: palette.blue, itemSelectedColor: palette.blue},
    Select: {optionSelectedBg: palette.blueTint},
    Input: {activeShadow: '0 0 0 3px ' + palette.blueTint},
    Modal: {contentBg: palette.white, headerBg: palette.white},
    Drawer: {colorBgElevated: palette.white},
  },
};
