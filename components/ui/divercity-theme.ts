import {defineTheme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral';

// Brand values live here; dashboard layout consumes Astryx's shared tokens.
export const divercityTheme=defineTheme({
 name:'divercity-pay',
 extends:neutralTheme,
 tokens:{
  '--color-accent':'#245fe0',
  '--color-accent-muted':'#edf3ff',
  '--color-border-info':'#b4c9ed',
  '--color-text-accent':'#1c50bc',
  '--color-on-accent':'#ffffff',
  '--color-background-body':'#f5f7fb',
  '--color-background-surface':'#ffffff',
  '--color-background-card':'#ffffff',
  '--color-text-primary':'#182d48',
  '--color-text-secondary':'#52647b',
  '--color-border':'#dce4ee',
  '--focus-outline-color':'#1452bd',
  '--size-element-sm':'2.75rem',
  '--size-element-md':'2.75rem',
  '--size-element-lg':'3rem',
  '--font-family-body':'Manrope, "Noto Sans KR", sans-serif',
  '--font-family-heading':'Manrope, "Noto Sans KR", sans-serif',
  '--radius-element':'0.5rem',
  '--radius-container':'0.75rem',
 },
});
