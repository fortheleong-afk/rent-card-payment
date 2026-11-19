'use client';
import type {ReactNode} from 'react';
import Link from 'next/link';
import {Theme} from '@astryxdesign/core/theme';
import {LinkProvider} from '@astryxdesign/core/Link';
import {divercityPayTheme} from './divercity-pay.js';
import '@astryxdesign/core/astryx.css';
import './divercity-theme.built.css';

// Reuse the existing app reset and the same built theme on account screens.
// The route owns its provider; unrelated pages keep their existing styling.
export default function AccountTheme({children}:{children:ReactNode}){
 return <Theme theme={divercityPayTheme} mode="light"><LinkProvider component={Link}>{children}</LinkProvider></Theme>;
}
