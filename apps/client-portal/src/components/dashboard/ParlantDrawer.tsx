import React, { useEffect, useRef } from 'react';
import { X, MessageCircle, HelpCircle } from 'lucide-react';

interface ParlantDrawerProps {
  open: boolean;
  onClose: () => void;
  context: {
    action?: string;
    profile?: any;
    locale?: string;
    in_eoir?: boolean;
    receipts?: string[];
    mailId?: string;
  };
}

export const ParlantDrawer: React.FC<ParlantDrawerProps> = ({ open, onClose, context }) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        ref={drawerRef}
        className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 transform transition-transform"
        style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Immigration Assistant
            </h2>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-white/90">
            I'm here to help you complete: <strong>{context.action?.replace('-', ' ')}</strong>
          </p>
        </div>

        {/* Trust Banner */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3">
          <div className="flex items-start gap-2">
            <HelpCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">Not Legal Advice</p>
              <p className="text-xs mt-1">
                I provide guidance based on USCIS procedures. Always consult an attorney for legal advice.
              </p>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 p-4 overflow-y-auto" style={{ height: 'calc(100% - 180px)' }}>
          {/* Mock Parlant Chat Interface */}
          <div className="space-y-4">
            {/* Assistant Initial Message */}
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm">
                AI
              </div>
              <div className="flex-1">
                <div className="bg-gray-100 rounded-lg p-3">
                  <p className="text-sm text-gray-800">
                    {context.action === 'change-address' && (
                      <>
                        I'll help you update your address with USCIS
                        {context.in_eoir && ' and EOIR'}. This typically takes 3-5 minutes.
                        <br /><br />
                        First, let me verify your current address on file. Is this correct?
                        <br />
                        <strong>123 Main Street, Brooklyn, NY 11201</strong>
                      </>
                    )}
                    {context.action === 'review-mail' && (
                      <>
                        I can help you understand your USCIS mail. You can either:
                        <br />
                        1. Upload a photo or scan of the letter
                        <br />
                        2. Select from your recent mail
                        <br /><br />
                        I'll translate it, extract important dates, and create action items for you.
                      </>
                    )}
                    {!context.action && (
                      <>
                        Hello! I'm your immigration assistant. How can I help you today?
                        <br /><br />
                        You can ask me about your case status, upcoming deadlines, or any immigration process questions.
                      </>
                    )}
                  </p>
                </div>
                
                {/* Quick Actions */}
                {context.action === 'change-address' && (
                  <div className="mt-3 flex gap-2">
                    <button className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                      Yes, correct
                    </button>
                    <button className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300">
                      No, update it
                    </button>
                  </div>
                )}
                
                {context.action === 'review-mail' && (
                  <div className="mt-3 space-y-2">
                    <button className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                      📷 Upload Photo
                    </button>
                    <button className="w-full px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300">
                      View Recent Mail
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Context Info */}
            {context.receipts && context.receipts.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-800 font-medium mb-2">Your Active Cases:</p>
                <div className="space-y-1">
                  {context.receipts.map((receipt, idx) => (
                    <div key={idx} className="text-xs text-blue-700">
                      • {receipt}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
};