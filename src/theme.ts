// Design tokens. C/F/R are mutable so a theme can be swapped at runtime (screens read them during render).
// Palettes dealt by taste-skill (start.mjs deal --trade wellness); macro colours checked with the dataviz CVD validator.
import themes from './themes.json';

const BASE = themes[0].C;
export type Theme = { id: string; name: string; description: string; dark: boolean; C: typeof BASE; fonts?: Partial<typeof BASE_F>; radius?: { sm: number; md: number; lg: number } };

const BASE_F = { display: 'HostGrotesk_500Medium', displayLight: 'HostGrotesk_400Regular', body: 'HostGrotesk_400Regular', medium: 'HostGrotesk_500Medium', bold: 'HostGrotesk_600SemiBold' };
const BASE_R = { sm: 12, md: 20, lg: 28 }; // "round" radius for a consumer app

export const C = { ...BASE };
export const F = { ...BASE_F };
export const R = { ...BASE_R };
export const THEMES = themes as Theme[];
export let isDark = false;

export function applyTheme(id: string | null) {
  const t = THEMES.find(x => x.id === id) ?? THEMES[0];
  Object.assign(C, BASE, t.C);
  Object.assign(F, BASE_F, t.fonts ?? {});
  Object.assign(R, BASE_R, t.radius ?? {});
  isDark = t.dark;
}
