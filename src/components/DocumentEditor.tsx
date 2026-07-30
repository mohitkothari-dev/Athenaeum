import { useState, useEffect, useRef } from 'react';
import { 
  Trash2, ArrowLeft, Eye, Edit3, Image as ImageIcon, 
  Heading1, Heading2, Heading3, List, CheckSquare, Quote, Code, AlertCircle, Loader2, Sparkles 
} from 'lucide-react';
import { AppDocument } from '@/types';

interface DocumentEditorProps {
  document: AppDocument;
  onSave: (updates: Partial<AppDocument>) => Promise<void>;
  onDelete: () => Promise<void>;
  onBack?: () => void;
  allDocuments: AppDocument[];
}

const COMMON_EMOJIS = ['📝', '📓', '💡', '💻', '🎓', '🎨', '📚', '✍️', '🎯', '🚀', '🧠', '📆', '📂', '🔑', '🏷️', '📢'];

const COVERS = [
  { name: 'Warm Cream', class: 'bg-cream-200' },
  { name: 'Terracotta Sunrise', class: 'bg-gradient-to-r from-terracotta-400 via-amber-500 to-terracotta-600' },
  { name: 'Sage Garden', class: 'bg-gradient-to-r from-sage-400 to-emerald-600' },
  { name: 'Midnight Ink', class: 'bg-gradient-to-r from-ink-800 via-slate-900 to-ink-950' },
  { name: 'Ochre Sand', class: 'bg-gradient-to-r from-yellow-100 via-sand-200 to-amber-100' },
  { name: 'Golden Glow', class: 'bg-gradient-to-r from-gold-400 to-amber-500' }
];

export function DocumentEditor({ document, onSave, onDelete, onBack, allDocuments }: DocumentEditorProps) {
  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(document.content);
  const [icon, setIcon] = useState(document.icon || '📝');
  const [coverImage, setCoverImage] = useState(document.cover_image || COVERS[0].class);
  
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [isSaving, setIsSaving] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [showAiDrawer, setShowAiDrawer] = useState(false);
  
  // Slash Commands State
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashCoords, setSlashCoords] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commandMenuRef = useRef<HTMLDivElement>(null);
  
  // Auto-save debounce
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setTitle(document.title);
    setContent(document.content);
    setIcon(document.icon || '📝');
    setCoverImage(document.cover_image || COVERS[0].class);
    setMode('edit');
  }, [document.id, document.title, document.content, document.icon, document.cover_image]);

  const triggerSave = (updatedFields: Partial<AppDocument>) => {
    setIsSaving(true);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await onSave(updatedFields);
      } catch (err) {
        console.error('Failed to save document:', err);
      } finally {
        setIsSaving(false);
      }
    }, 1000);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    triggerSave({ title: val });
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    triggerSave({ content: val });
    detectSlashCommand();
  };

  const handleIconSelect = (emoji: string) => {
    setIcon(emoji);
    triggerSave({ icon: emoji });
    setShowEmojiPicker(false);
  };

  const handleCoverSelect = (coverClass: string) => {
    setCoverImage(coverClass);
    triggerSave({ cover_image: coverClass });
    setShowCoverPicker(false);
  };

  // Find document breadcrumbs
  const getBreadcrumbs = () => {
    const crumbs: AppDocument[] = [];
    let current: AppDocument | undefined = document;
    while (current) {
      crumbs.unshift(current);
      const parentId: string | null = current.parent_id;
      current = allDocuments.find(d => d.id === parentId);
    }
    return crumbs;
  };

  // Markdown parsing (basic visual parser matching the Athenaeum look)
  const parseMarkdown = (text: string) => {
    if (!text.trim()) return <p className="text-warmgray-300 italic font-serif">Empty page. Start writing or use AI helper...</p>;
    
    const lines = text.split('\n');
    let insideCodeBlock = false;
    let codeContent: string[] = [];

    return lines.map((line, idx) => {
      // Handle Code Block Toggle
      if (line.startsWith('```')) {
        if (insideCodeBlock) {
          insideCodeBlock = false;
          const renderedCode = codeContent.join('\n');
          codeContent = [];
          return (
            <pre key={idx} className="bg-ink-900 text-cream-100 p-4 rounded-xl font-mono text-sm my-4 overflow-x-auto shadow-inner border border-ink-800">
              <code>{renderedCode}</code>
            </pre>
          );
        } else {
          insideCodeBlock = true;
          return null;
        }
      }

      if (insideCodeBlock) {
        codeContent.push(line);
        return null;
      }

      // Checkboxes (Todo List)
      if (line.match(/^-\s*\[\s*[xX]\s*\]\s*(.*)/)) {
        const match = line.match(/^-\s*\[\s*[xX]\s*\]\s*(.*)/);
        return (
          <div key={idx} className="flex items-start gap-2.5 my-1.5 line-through text-warmgray-400">
            <span className="w-5 h-5 flex items-center justify-center bg-terracotta-500 border border-terracotta-500 rounded text-cream-50 mt-0.5">
              ✓
            </span>
            <span>{match?.[1]}</span>
          </div>
        );
      }
      if (line.match(/^-\s*\[\s*\]\s*(.*)/)) {
        const match = line.match(/^-\s*\[\s*\]\s*(.*)/);
        return (
          <div key={idx} className="flex items-start gap-2.5 my-1.5">
            <span className="w-5 h-5 border border-cream-300 rounded mt-0.5 bg-cream-50 flex-shrink-0" />
            <span className="text-ink-600">{match?.[1]}</span>
          </div>
        );
      }

      // Headers
      if (line.startsWith('# ')) return <h1 key={idx} className="font-serif text-3xl text-ink-700 font-semibold mt-6 mb-3">{line.slice(2)}</h1>;
      if (line.startsWith('## ')) return <h2 key={idx} className="font-serif text-2xl text-ink-700 font-medium mt-5 mb-2.5">{line.slice(3)}</h2>;
      if (line.startsWith('### ')) return <h3 key={idx} className="font-serif text-xl text-ink-700 font-medium mt-4 mb-2">{line.slice(4)}</h3>;

      // Callouts / Alert Box
      if (line.startsWith('> [!NOTE]')) return null; // Handled below if multi-line is needed, but we can treat blockquotes beautifully
      if (line.startsWith('> ')) {
        const isAlert = line.startsWith('> [!NOTE]') || line.startsWith('> [!IMPORTANT]');
        const sliceLen = isAlert ? line.indexOf(']') + 1 : 2;
        const text = line.slice(sliceLen).trim();
        return (
          <blockquote key={idx} className="border-l-3 border-terracotta-500 pl-4 py-1.5 my-3 italic text-ink-600 bg-terracotta-50/30 rounded-r-lg font-serif">
            {text}
          </blockquote>
        );
      }

      // Bullet points
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <ul key={idx} className="list-disc list-inside pl-4 my-1 text-ink-600">
            <li>{line.slice(2)}</li>
          </ul>
        );
      }

      // Numbered List
      if (line.match(/^\d+\.\s(.*)/)) {
        const match = line.match(/^\d+\.\s(.*)/);
        return (
          <ol key={idx} className="list-decimal list-inside pl-4 my-1 text-ink-600">
            <li>{match?.[1]}</li>
          </ol>
        );
      }

      // Empty lines
      if (!line.trim()) return <div key={idx} className="h-3" />;

      // Normal paragraph
      return <p key={idx} className="reading-text mb-3 text-ink-600 leading-relaxed">{line}</p>;
    }).filter(el => el !== null);
  };

  // Slash commands logic
  const detectSlashCommand = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const text = textarea.value;
    const selectionStart = textarea.selectionStart;
    
    // Find the current line the user is typing
    const beforeCursor = text.slice(0, selectionStart);
    const lastLineStart = beforeCursor.lastIndexOf('\n') + 1;
    const currentLine = beforeCursor.slice(lastLineStart);

    if (currentLine.startsWith('/')) {
      const query = currentLine.slice(1);
      setSlashQuery(query);
      setSlashIndex(0);
      
      // Calculate coordinates for the popup menu
      const coords = getSelectionCoords(textarea, selectionStart);
      setSlashCoords({
        top: Math.min(textarea.offsetHeight - 180, coords.top + 28),
        left: Math.min(textarea.offsetWidth - 200, coords.left)
      });
    } else {
      setSlashQuery(null);
    }
  };

  const getSelectionCoords = (textarea: HTMLTextAreaElement, position: number) => {
    // Basic approximate coordinate calculator for textarea positioning
    const textBeforeCursor = textarea.value.slice(0, position);
    const lines = textBeforeCursor.split('\n');
    const currentLineIdx = lines.length - 1;
    const currentLineText = lines[currentLineIdx];
    
    // Calculate approximate height and width (base font size ~16px)
    const lineHeight = 24; 
    const charWidth = 8; 
    
    return {
      top: currentLineIdx * lineHeight - textarea.scrollTop,
      left: currentLineText.length * charWidth
    };
  };

  const COMMANDS = [
    { name: 'Heading 1', desc: 'Large section heading', icon: Heading1, prefix: '# ' },
    { name: 'Heading 2', desc: 'Medium section heading', icon: Heading2, prefix: '## ' },
    { name: 'Heading 3', desc: 'Small section heading', icon: Heading3, prefix: '### ' },
    { name: 'Todo List', desc: 'Checkbox list item', icon: CheckSquare, prefix: '- [ ] ' },
    { name: 'Bulleted List', desc: 'Simple bullet point', icon: List, prefix: '- ' },
    { name: 'Blockquote', desc: 'Format as pull quote', icon: Quote, prefix: '> ' },
    { name: 'Code Block', desc: 'Formatted code block', icon: Code, prefix: '```\n\n```' },
    { name: 'Callout Box', desc: 'Highlighted alert box', icon: AlertCircle, prefix: '> [!NOTE]\n' }
  ];

  const filteredCommands = COMMANDS.filter(cmd => 
    cmd.name.toLowerCase().includes((slashQuery || '').toLowerCase())
  );

  const applyCommand = (command: typeof COMMANDS[number]) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const text = textarea.value;

    const beforeCursor = text.slice(0, start);
    const lastLineStart = beforeCursor.lastIndexOf('\n') + 1;
    const beforeLine = text.slice(0, lastLineStart);

    // Insert prefix at the start of current line
    const replacement = beforeLine + command.prefix + text.slice(start);
    setContent(replacement);
    triggerSave({ content: replacement });
    setSlashQuery(null);
    
    // Focus back on editor
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = lastLineStart + command.prefix.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashQuery !== null) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[slashIndex]) {
          applyCommand(filteredCommands[slashIndex]);
        }
      } else if (e.key === 'Escape') {
        setSlashQuery(null);
      }
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-140px)] bg-cream-50 border border-cream-200 rounded-xl2 overflow-hidden shadow-soft">
      {/* Top Header Bar */}
      <header className="px-5 py-3.5 bg-cream-100 border-b border-cream-200 flex items-center justify-between z-10">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button 
              onClick={onBack} 
              className="p-1.5 rounded-lg hover:bg-cream-200 text-warmgray-500 hover:text-ink-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs text-warmgray-400 font-medium truncate">
            <span>Workspace</span>
            {getBreadcrumbs().map((crumb, idx) => (
              <span key={crumb.id} className="flex items-center gap-1">
                <span>/</span>
                <span className={idx === getBreadcrumbs().length - 1 ? 'text-ink-600 font-semibold' : ''}>
                  {crumb.icon} {crumb.title || 'Untitled'}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          {/* Saving Indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cream-200/80 border border-cream-200/50 text-[11px] font-medium text-warmgray-500">
            {isSaving ? (
              <>
                <Loader2 className="w-3 h-3 text-terracotta-500 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Saved</span>
              </>
            )}
          </div>


          {/* Mode Switcher */}
          <div className="flex items-center bg-cream-200 rounded-lg p-0.5 border border-cream-200/40">
            <button
              onClick={() => setMode('edit')}
              className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                mode === 'edit' 
                  ? 'bg-cream-50 text-ink-700 shadow-soft' 
                  : 'text-warmgray-500 hover:text-ink-600'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              Write
            </button>
            <button
              onClick={() => setMode('preview')}
              className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                mode === 'preview' 
                  ? 'bg-cream-50 text-ink-700 shadow-soft' 
                  : 'text-warmgray-500 hover:text-ink-600'
              }`}
            >
              <Eye className="w-3 h-3" />
              View
            </button>
          </div>

          {/* Delete Page */}
          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete this page?')) {
                onDelete();
              }
            }}
            className="p-1.5 rounded-lg hover:bg-brick-50 text-warmgray-400 hover:text-brick-500 transition-colors"
            title="Delete Document"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Editor Content Area */}
      <div className="flex-1 flex relative min-h-0 overflow-y-auto">
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* Cover Photo */}
          <div className={`h-40 w-full relative ${coverImage} transition-colors group flex items-end justify-end p-4`}>
            <button
              onClick={() => setShowCoverPicker(!showCoverPicker)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-900/60 backdrop-blur-sm hover:bg-ink-900/80 text-cream-50 font-medium text-xs shadow-soft transition-all opacity-0 group-hover:opacity-100"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Change cover
            </button>

            {showCoverPicker && (
              <div className="absolute right-4 top-28 bg-cream-50 border border-cream-200 rounded-xl p-3 shadow-lifted z-20 grid grid-cols-3 gap-2 w-72">
                {COVERS.map(cov => (
                  <button
                    key={cov.name}
                    onClick={() => handleCoverSelect(cov.class)}
                    className={`h-12 rounded-lg border-2 hover:scale-105 transition-all ${cov.class} ${
                      coverImage === cov.class ? 'border-terracotta-500' : 'border-transparent'
                    }`}
                    title={cov.name}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Icon & Title Workspace */}
          <div className="px-8 md:px-16 pt-6 max-w-4xl w-full mx-auto relative">
            {/* Page Emoji Icon */}
            <div className="relative -mt-16 mb-4 inline-block">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-16 h-16 rounded-2xl bg-cream-50 border border-cream-200 shadow-soft flex items-center justify-center text-3xl hover:bg-cream-100 hover:scale-105 transition-all"
              >
                {icon}
              </button>
              
              {showEmojiPicker && (
                <div className="absolute left-0 top-18 bg-cream-50 border border-cream-200 rounded-xl p-3 shadow-lifted z-20 grid grid-cols-4 gap-2.5 w-52">
                  {COMMON_EMOJIS.map(em => (
                    <button
                      key={em}
                      onClick={() => handleIconSelect(em)}
                      className="text-2xl hover:scale-125 transition-transform"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Editable Title */}
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Untitled Page"
              className="w-full font-serif text-4.5xl font-semibold text-ink-700 tracking-tight placeholder:text-warmgray-300 bg-transparent focus:outline-none py-1 border-b border-transparent focus:border-cream-200"
            />
          </div>

          {/* Custom Block / Text Editor */}
          <div className="flex-1 px-8 md:px-16 py-6 max-w-4xl w-full mx-auto relative min-h-[400px]">
            {mode === 'edit' ? (
              <div className="relative h-full flex flex-col">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type '/' for commands..."
                  className="flex-1 w-full text-base text-ink-600 placeholder:text-warmgray-300 bg-transparent resize-none focus:outline-none leading-relaxed font-sans min-h-[350px]"
                />

                {/* Floating slash command menu */}
                {slashQuery !== null && filteredCommands.length > 0 && (
                  <div 
                    ref={commandMenuRef}
                    className="absolute bg-cream-50 border border-cream-200 rounded-xl shadow-lifted w-60 py-1.5 z-30 max-h-56 overflow-y-auto"
                    style={{ top: `${slashCoords.top}px`, left: `${slashCoords.left}px` }}
                  >
                    <div className="px-3 py-1 text-[10px] font-semibold text-warmgray-400 uppercase tracking-wider border-b border-cream-100 mb-1">
                      Basic Blocks
                    </div>
                    {filteredCommands.map((cmd, idx) => {
                      const IconComponent = cmd.icon;
                      return (
                        <button
                          key={cmd.name}
                          onClick={() => applyCommand(cmd)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                            idx === slashIndex 
                              ? 'bg-cream-200 text-ink-700 font-semibold' 
                              : 'text-warmgray-600 hover:bg-cream-100 hover:text-ink-600'
                          }`}
                        >
                          <div className={`p-1 rounded bg-cream-50 ${idx === slashIndex ? 'bg-cream-50 text-terracotta-500' : 'text-warmgray-400'}`}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm leading-none">{cmd.name}</p>
                            <p className="text-[10px] text-warmgray-400 mt-0.5">{cmd.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="prose prose-warm max-w-none pb-20">
                {parseMarkdown(content)}
              </div>
            )}
          </div>
        </div>

        {/* AI Assistant Drawer */}
      </div>
    </div>
  );
}
