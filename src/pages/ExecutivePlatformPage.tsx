import React from 'react';
import { useExecutive } from '../contexts/ExecutiveContext';
import ExecutiveHeader from '../components/executive/ExecutiveHeader';
import ExecutiveWorkspace from '../components/executive/ExecutiveWorkspace';
import ExecutiveCopilotPanel from '../components/executive/ExecutiveCopilotPanel';
import CommandPaletteModal from '../components/executive/CommandPaletteModal';
import ExportExecutiveReportModal from '../components/executive/ExportExecutiveReportModal';

export default function ExecutivePlatformPage() {
  const { copilotOpen } = useExecutive();

  return (
    <div className="min-h-screen flex flex-col bg-[#EEF3F8] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 80px Sticky Glassmorphism Header */}
      <ExecutiveHeader />

      {/* Main Grid: 70% Workspace & 30% AI Copilot */}
      <main className="flex-1 flex flex-col xl:flex-row w-full max-w-[1920px] mx-auto relative overflow-x-hidden">
        {/* 70% Executive Workspace */}
        <div className="flex-1 w-full overflow-y-auto">
          <ExecutiveWorkspace />
        </div>

        {/* 30% AI Executive Copilot Panel */}
        {copilotOpen && <ExecutiveCopilotPanel />}
      </main>

      {/* ⌘K Command Palette Modal */}
      <CommandPaletteModal />

      {/* Export Executive Briefing Modal */}
      <ExportExecutiveReportModal />
    </div>
  );
}
