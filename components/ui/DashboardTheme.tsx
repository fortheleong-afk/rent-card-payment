'use client';
import type {ReactNode} from 'react';
import Link from 'next/link';
import {Theme} from '@astryxdesign/core/theme';
import {LinkProvider} from '@astryxdesign/core/Link';
import {divercityPayTheme} from './divercity-pay.js';
import '@astryxdesign/core/astryx.css';
import './divercity-theme.built.css';

// Keep the existing app reset. A second global reset would restyle untouched routes.
// The theme owns this route and is removed when the dashboard unmounts.
export default function DashboardTheme({children}:{children:ReactNode}){
 return <Theme theme={divercityPayTheme} mode="light"><LinkProvider component={Link}>{children}</LinkProvider></Theme>;
}
