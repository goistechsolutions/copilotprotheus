import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, History, Star } from 'lucide-react';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { CopilotHeader } from './CopilotHeader';
import { QuickActions } from './QuickActions';
import { CopilotConversation } from './CopilotConversation';
import { PromptInput } from './PromptInput';
import { HistoryList } from '../history/HistoryList';
import { FavoritesList } from '../favorites/FavoritesList';

/**
 * Execution Sidebar (Fase 9, 10, 11 e 12)
 */
export function CopilotSidebar() {
  const { chat } = useDashboardStore();
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'history' | 'favorites'

  return (
    <AnimatePresence>
      {chat.isOpen && (
        <motion.aside 
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute right-0 top-0 bottom-0 z-50 flex w-full max-w-[320px] sm:max-w-md md:w-96 shrink-0 flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 md:relative md:z-10 md:shadow-xl"
        >
          <CopilotHeader />
          
          {/* Tabs Nav */}
          <div className="flex px-4 pt-3 border-b border-slate-100 dark:border-slate-800/60 gap-1">
            <TabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={MessageSquare} label="Chat" />
            <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={History} label="Histórico" />
            <TabButton active={activeTab === 'favorites'} onClick={() => setActiveTab('favorites')} icon={Star} label="Favoritos" />
          </div>
          
          <div className="flex-1 overflow-hidden flex flex-col relative">
            <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-white to-transparent h-4 dark:from-slate-900 pointer-events-none" />
            
            {/* Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              {activeTab === 'chat' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <QuickActions />
                  <div className="h-px w-full bg-slate-100 dark:bg-slate-800/60 mb-4" />
                  <CopilotConversation />
                </motion.div>
              )}
              {activeTab === 'history' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <HistoryList />
                </motion.div>
              )}
              {activeTab === 'favorites' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <FavoritesList />
                </motion.div>
              )}
            </div>
          </div>
          
          {activeTab === 'chat' && <PromptInput />}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-xs font-semibold transition-colors ${
        active 
          ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500' 
          : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
      }`}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );
}
