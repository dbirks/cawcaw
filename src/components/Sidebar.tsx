import { Menu, MessageSquare, Plus, Settings as SettingsIcon, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerClose, DrawerContent } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Conversation } from '@/services/conversationStorage';
import { conversationStorage } from '@/services/conversationStorage';

// Edge swipe activator for iOS-style left edge gesture
function LeftEdgeActivator({ onOpen }: { onOpen: () => void }) {
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });

  const onDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (e.clientX > 24) return; // only within the edge zone
    draggingRef.current = true;
    startRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = Math.abs(e.clientY - startRef.current.y);
    if (dx > 32 && dy < 30) {
      draggingRef.current = false;
      onOpen(); // open the drawer
    }
  };

  const onUp: React.PointerEventHandler<HTMLDivElement> = () => {
    draggingRef.current = false;
  };

  return (
    <div
      className="fixed inset-y-0 left-0 z-40"
      style={{ width: 16, touchAction: 'pan-y' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      aria-hidden="true"
    />
  );
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  onNewConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  onOpenSettings: () => void;
  currentConversationId: string | null;
}

export default function Sidebar({
  isOpen,
  onClose,
  onOpen,
  onNewConversation,
  onSelectConversation,
  onOpenSettings,
  currentConversationId,
}: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const loadConversations = useCallback(async () => {
    const allConversations = await conversationStorage.getAllConversations();
    setConversations(allConversations);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Refresh conversations when sidebar opens
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, loadConversations]);

  const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (confirm('Are you sure you want to delete this conversation?')) {
      try {
        await conversationStorage.deleteConversation(conversationId);
        loadConversations();

        // If we deleted the current conversation, notify parent
        if (conversationId === currentConversationId) {
          const current = await conversationStorage.getCurrentConversation();
          if (current) {
            onSelectConversation(current.id);
          }
        }
      } catch (error) {
        console.error('Failed to delete conversation:', error);
        alert('Failed to delete conversation');
      }
    }
  };

  const handleNewConversation = async () => {
    await conversationStorage.createNewConversation();
    loadConversations();
    onNewConversation();
    onClose(); // Close sidebar after creating new conversation
  };

  const handleSelectConversation = async (conversationId: string) => {
    await conversationStorage.setCurrentConversation(conversationId);
    onSelectConversation(conversationId);
    onClose(); // Close sidebar on mobile after selecting
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  const handleOpen = () => {
    if (!isOpen) {
      onOpen();
    }
  };

  return (
    <>
      {/* Edge swipe activator for iOS-style gesture */}
      <LeftEdgeActivator onOpen={handleOpen} />

      <Drawer
        direction="left"
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        dismissible={true}
        modal={true}
      >
        {/* Drawer Content */}
        <DrawerContent className="w-80 h-full flex flex-col lg:hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b safe-top">
            <h2 className="text-lg font-semibold">caw caw</h2>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <X className="h-5 w-5" />
              </Button>
            </DrawerClose>
          </div>

          {/* New Conversation Button */}
          <div className="p-4 border-b">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={handleNewConversation}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Conversation
            </Button>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Conversations</h3>
                {conversations.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    No conversations yet
                  </div>
                ) : (
                  conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => handleSelectConversation(conversation.id)}
                      className={`w-full text-left p-3 rounded-lg hover:bg-accent transition-colors group ${
                        conversation.id === currentConversationId ? 'bg-accent' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <h4 className="text-sm font-medium truncate">{conversation.title}</h4>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{conversation.messages.length} messages</span>
                            <span>•</span>
                            <span>{formatDate(conversation.updatedAt)}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={(e) => handleDeleteConversation(conversation.id, e)}
                          title="Delete conversation"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Settings Section - at bottom */}
          <div className="border-t p-4 safe-bottom">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                onOpenSettings();
                onClose();
              }}
            >
              <SettingsIcon className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

// Export a toggle button component for convenience
export function SidebarToggle({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="lg:hidden"
      aria-label="Open sidebar"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}
