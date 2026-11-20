import {defineTheme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral';

// Brand values live here; dashboard layout consumes Astryx's shared tokens.
export const divercityTheme=defineTheme({
 name:'divercity-pay',
 extends:neutralTheme,
 tokens:{
  '--color-accent':'#a230ff',
  '--color-accent-muted':'#f4eafe',
  '--color-border-info':'#d2bcf7',
  '--color-text-accent':'#7620b2',
  '--color-on-accent':'#ffffff',
  '--color-background-body':'#faf7fd',
  '--color-background-surface':'#ffffff',
  '--color-background-card':'#ffffff',
  '--color-text-primary':'#242028',
  '--color-text-secondary':'#625a6d',
  '--color-border':'#e5ddea',
  '--focus-outline-color':'#7620b2',
  '--size-element-sm':'2.75rem',
  '--size-element-md':'2.75rem',
  '--size-element-lg':'3rem',
  '--font-family-body':'Manrope, "Noto Sans KR", sans-serif',
  '--font-family-heading':'Manrope, "Noto Sans KR", sans-serif',
  '--radius-element':'0.5rem',
  '--radius-container':'0.75rem',
 },
});
