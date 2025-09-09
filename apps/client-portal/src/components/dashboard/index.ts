// Trustworthy Dashboard Components
// Central hub for one-click immigration actions with agent assistance

export { TrustworthyDashboard } from './TrustworthyDashboard';
export { QuickActionCard } from './QuickActionCard';
export { StatusGlance } from './StatusGlance';
export { ParlantDrawer } from './ParlantDrawer';

// Integration Guide:
// 
// TrustworthyDashboard: Main dashboard component with all quick actions
// - 8 primary quick actions (Change Address, Review Mail, etc.)
// - Status at a glance showing case status, tasks, deadlines
// - Locale switcher (EN, ES, AR, FR)
// - Timeline of completed actions
// - Integrated Parlant agent assistance
//
// QuickActionCard: Individual action tile component
// - Priority indicators (high/medium/low)
// - Badge support for notifications
// - Icon and call-to-action button
//
// StatusGlance: Overview cards showing immigration status
// - Case status, open tasks, deadlines
// - Days in USA, completed forms
// - Next appointment information
//
// ParlantDrawer: Agent assistance drawer
// - Context-aware help for each action
// - Trust banners and legal disclaimers
// - Mock conversation interface (ready for Parlant integration)