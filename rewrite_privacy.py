import re

def rewrite_page(filepath, page_title, subtitle, icon_name, is_terms=False):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if is_terms:
        sections_match = re.search(r'const sections: TermsSection\[\] = (\[.*?\]);', content, re.DOTALL)
    else:
        sections_match = re.search(r'const sections: PolicySection\[\] = (\[.*?\]);', content, re.DOTALL)
        
    if not sections_match:
        print(f"Could not extract sections from {filepath}")
        return
        
    sections_array = sections_match.group(1)
    
    new_content = f"""import React, {{ useState, useEffect }} from 'react';
import {{ motion, AnimatePresence }} from 'framer-motion';
import {{ 
  Shield, Lock, Eye, Database, UserCheck, Search, Printer, Copy, Check, Sparkles, Mail, Code, Cpu, CheckCircle2, Key,
  ShieldAlert, ChevronDown, ChevronRight, Globe, Layers, Filter, HelpCircle, Activity, Layout, Terminal, Scale, 
  FileText, ArrowRight, Zap, RefreshCw, XCircle, AlertCircle
}} from 'lucide-react';

interface ContentSection {{
  id: string;
  title: string;
  icon: React.ElementType;
  badge: string;
  badgeGradient: string;
  cardGlow: string;
  summary: string;
  content: React.ReactNode;
}}

export const {page_title.replace(' ', '')}Page: React.FC = () => {{
  const [activeSection, setActiveSection] = useState<string>('collection');
  const [isCopied, setIsCopied] = useState(false);
  const [mousePosition, setMousePosition] = useState({{ x: 0, y: 0 }});
  
  useEffect(() => {{
    const handleMouseMove = (e: MouseEvent) => {{
      setMousePosition({{ x: e.clientX, y: e.clientY }});
    }};
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }}, []);

  const sections: ContentSection[] = {sections_array};

  useEffect(() => {{
    if (sections.length > 0 && !sections.find(s => s.id === activeSection)) {{
      setActiveSection(sections[0].id);
    }}
  }}, [sections, activeSection]);

  const handlePrint = () => window.print();

  const handleCopyLink = () => {{
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }};

  const activeData = sections.find(s => s.id === activeSection) || sections[0];
  const ActiveIcon = activeData?.icon || Shield;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030816] text-slate-900 dark:text-slate-100 font-sans relative overflow-hidden transition-colors duration-500">
      
      {{/* Animated Background Glows */}}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-600/10 dark:bg-brand-500/10 blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 dark:bg-indigo-500/10 blur-[120px] animate-pulse-slow" style={{{{ animationDelay: '2s' }}}} />
        <div 
          className="absolute w-[600px] h-[600px] rounded-full bg-purple-500/5 dark:bg-purple-500/10 blur-[100px] transition-transform duration-700 ease-out"
          style={{{{ transform: `translate(${{mousePosition.x - 300}}px, ${{mousePosition.y - 300}}px)` }}}}
        />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.015] dark:opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        
        {{/* Header Title & Actions */}}
        <motion.div 
          initial={{{{ opacity: 0, y: 30 }}}}
          animate={{{{ opacity: 1, y: 0 }}}}
          transition={{{{ duration: 0.6, ease: "easeOut" }}}}
          className="text-center max-w-3xl mx-auto mb-16 lg:mb-24"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 dark:bg-navy-900/60 border border-slate-200/50 dark:border-navy-700/50 backdrop-blur-md shadow-sm mb-6">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-500"></span>
            </span>
            <span className="text-xs font-black tracking-widest uppercase text-brand-600 dark:text-brand-400">
              Official Directive
            </span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white mb-6 tracking-tight leading-tight drop-shadow-sm">
            {page_title} <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 via-indigo-500 to-purple-500 animate-gradient-x">
              {subtitle}
            </span>
          </h1>
          
          <p className="text-lg text-slate-600 dark:text-slate-400 font-medium leading-relaxed mb-8">
            Engineered with a Zero-Trust architecture by Lead Developer <strong className="text-slate-900 dark:text-white">Nanthish S</strong> for Nandha Engineering College. 100% data authenticity guarantee.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button 
              onClick={{handlePrint}}
              className="group flex items-center gap-2 px-6 py-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 hover:border-brand-500/50 dark:hover:border-brand-500/50 rounded-2xl text-sm font-black transition-all shadow-sm hover:shadow-brand-500/10"
            >
              <Printer className="w-4 h-4 text-slate-500 group-hover:text-brand-500 transition-colors" />
              <span>Print Document</span>
            </button>
            <button 
              onClick={{handleCopyLink}}
              className="group flex items-center gap-2 px-6 py-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 rounded-2xl text-sm font-black transition-all shadow-sm hover:shadow-indigo-500/10"
            >
              {{isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-500 group-hover:text-indigo-500 transition-colors" />}}
              <span>{{isCopied ? 'Link Copied!' : 'Share Link'}}</span>
            </button>
          </div>
        </motion.div>

        {{/* Layout Grid */}}
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {{/* Left Navigation Sidebar */}}
          <motion.div 
            initial={{{{ opacity: 0, x: -30 }}}}
            animate={{{{ opacity: 1, x: 0 }}}}
            transition={{{{ duration: 0.6, delay: 0.2 }}}}
            className="lg:col-span-4 space-y-4 sticky top-24"
          >
            <div className="p-1.5 bg-white/40 dark:bg-navy-900/40 backdrop-blur-xl border border-white/60 dark:border-navy-700/50 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
              <div className="px-4 py-3 border-b border-slate-200/50 dark:border-navy-700/50 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Index
                </span>
                <Sparkles className="w-4 h-4 text-brand-500/50" />
              </div>
              <div className="p-2 flex flex-col gap-1.5">
                {{sections.map((s, idx) => {{
                  const Icon = s.icon;
                  const isActive = activeSection === s.id;
                  return (
                    <button
                      key={{s.id}}
                      onClick={{() => setActiveSection(s.id)}}
                      className={{`relative w-full text-left px-4 py-3.5 rounded-2xl transition-all duration-300 flex items-center justify-between group overflow-hidden ${{
                        isActive 
                          ? 'bg-gradient-to-r from-brand-500 to-indigo-600 text-white shadow-md shadow-brand-500/20 scale-[1.02]' 
                          : 'hover:bg-white dark:hover:bg-navy-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }}`}}
                    >
                      {{isActive && (
                        <motion.div 
                          layoutId="navGlow"
                          className="absolute inset-0 bg-gradient-to-r from-brand-400 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      )}}
                      <div className="relative z-10 flex items-center gap-3 min-w-0">
                        <div className={{`p-1.5 rounded-lg shrink-0 transition-colors ${{isActive ? 'bg-white/20' : 'bg-slate-100 dark:bg-navy-950 group-hover:bg-brand-50 dark:group-hover:bg-brand-500/10'}}`}}>
                          <Icon className={{`w-4 h-4 ${{isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-brand-500'}}`}} />
                        </div>
                        <span className="font-extrabold text-sm tracking-tight truncate">{{s.title.replace(/^\d+\.\s*/, '')}}</span>
                      </div>
                      <ChevronRight className={{`relative z-10 shrink-0 w-4 h-4 transition-transform duration-300 ${{isActive ? 'text-white translate-x-1 opacity-100' : 'opacity-0 -translate-x-2 group-hover:opacity-50 group-hover:translate-x-0'}}`}} />
                    </button>
                  );
                }})}}
              </div>
            </div>

            {{/* Tech Stack Security Card */}}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 to-navy-950 border border-navy-800 shadow-xl overflow-hidden relative group hidden lg:block">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl group-hover:bg-brand-500/20 transition-all duration-500" />
              <ShieldAlert className="w-8 h-8 text-brand-400 mb-4" />
              <h4 className="text-white font-black text-lg mb-2">Zero-Trust Framework</h4>
              <p className="text-slate-400 text-sm font-medium leading-relaxed">
                Platform telemetry is protected by Neon PostgreSQL encrypted at rest. We never store passwords or sync mock data.
              </p>
            </div>
          </motion.div>

          {{/* Right Main Content Area */}}
          <motion.div 
            initial={{{{ opacity: 0, x: 30 }}}}
            animate={{{{ opacity: 1, x: 0 }}}}
            transition={{{{ duration: 0.6, delay: 0.3 }}}}
            className="lg:col-span-8"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={{activeSection}}
                initial={{{{ opacity: 0, y: 20, scale: 0.98 }}}}
                animate={{{{ opacity: 1, y: 0, scale: 1 }}}}
                exit={{{{ opacity: 0, y: -20, scale: 0.98 }}}}
                transition={{{{ duration: 0.4, type: "spring", bounce: 0.2 }}}}
                className="relative"
              >
                {{/* Glowing Aura around active content */}}
                <div className={{`absolute -inset-0.5 rounded-[2.5rem] blur-xl opacity-20 bg-gradient-to-br ${{activeData.badgeGradient.replace('text-white', '').replace(/shadow-.*/, '')}} transition-all duration-700`}} />
                
                <div className="relative bg-white/70 dark:bg-navy-900/70 backdrop-blur-2xl border border-white/50 dark:border-navy-700/50 p-6 sm:p-10 rounded-[2.5rem] shadow-xl">
                  
                  {{/* Header */}}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-8 border-b border-slate-200/50 dark:border-navy-700/50">
                    <div className="flex items-center gap-4">
                      <div className={{`p-4 rounded-2xl bg-gradient-to-br ${{activeData.badgeGradient}} shadow-lg shrink-0`}}>
                        <ActiveIcon className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
                          {{activeData.title}}
                        </h2>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                          {{activeData.summary}}
                        </p>
                      </div>
                    </div>
                    <div className={{`hidden sm:flex px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r ${{activeData.badgeGradient}} shrink-0`}}>
                      {{activeData.badge}}
                    </div>
                  </div>

                  {{/* Formatted Content */}}
                  <div className="prose prose-slate dark:prose-invert prose-headings:font-black prose-p:font-medium prose-p:leading-relaxed prose-strong:font-black prose-strong:text-brand-600 dark:prose-strong:text-brand-400 max-w-none">
                    {{activeData.content}}
                  </div>

                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>

        </div>
      </div>
    </div>
  );
}};
"""
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Rewrote {filepath}")

rewrite_page('e:/Leetcode Web/frontend/src/pages/PrivacyPolicyPage.tsx', 'Privacy Policy', 'Data Intelligence', 'Shield')
rewrite_page('e:/Leetcode Web/frontend/src/pages/TermsOfServicePage.tsx', 'Terms of Service', 'Operational Framework', 'Scale', is_terms=True)
