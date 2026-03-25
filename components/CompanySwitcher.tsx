'use client';

import { useEffect, useRef, useState } from 'react';
import { useCompanyStore, Company } from '@/stores/useCompanyStore';
import { useUserStore } from '@/stores/useUserStore';
import { useSidebarStore } from '@/stores/useSidebarStore';
import { Building2, ChevronRight, CheckCircle2, PlusCircle } from 'lucide-react';
import Link from 'next/link';

// Deterministic color from company name
function getCompanyColor(name: string): string {
  const colors = ['#6366F1', '#E24681', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#06B6D4', '#F43F5E', '#14B8A6', '#EF4444'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function CompanySwitcher() {
  const { companies, activeCompany, setActiveCompany, fetchCompanies } = useCompanyStore();
  const { isSuperAdmin } = useUserStore();
  const { isCollapsed, isMobileOpen, setMobileOpen } = useSidebarStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Re-fetch when role resolves — super admins get all companies,
    // regular users get only their assigned ones.
    fetchCompanies();
  }, [isSuperAdmin]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showExpanded = !isCollapsed || isMobileOpen;

  const handleSelect = (company: Company | null) => {
    setActiveCompany(company);
    setIsOpen(false);
    setMobileOpen(false);
  };

  if (!showExpanded) {
    // Collapsed sidebar: just show the active company dot/icon
    return (
      <div className="flex justify-center py-2 px-2">
        {activeCompany ? (
          <div
            onClick={() => setIsOpen(!isOpen)}
            className="relative w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm cursor-pointer shadow-lg"
            style={{ backgroundColor: getCompanyColor(activeCompany.name) }}
            title={activeCompany.name}
          >
            {activeCompany.name[0].toUpperCase()}
          </div>
        ) : (
          <div
            onClick={() => setIsOpen(!isOpen)}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-input-bg border border-dashed border-card-border cursor-pointer hover:border-primary/40 transition-all"
          >
            <Building2 size={18} className="text-foreground/30" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative px-4 mb-2">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl border transition-all duration-200 text-left group ${
          activeCompany
            ? 'bg-input-bg/60 border-card-border hover:border-primary/40'
            : 'bg-input-bg/40 border-dashed border-card-border hover:border-primary/30'
        }`}
      >
        {activeCompany ? (
          <>
            <div
              className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-white font-black text-sm shadow-md"
              style={{ backgroundColor: getCompanyColor(activeCompany.name) }}
            >
              {activeCompany.name[0].toUpperCase()}
            </div>
            <span className="flex-1 text-xs font-black text-foreground truncate uppercase tracking-tight">
              {activeCompany.name}
            </span>
          </>
        ) : (
          <>
            <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center bg-card-bg border border-card-border">
              <Building2 size={14} className="text-foreground/30" />
            </div>
            <span className="flex-1 text-xs font-black text-foreground/30 uppercase tracking-widest">
              Select Company
            </span>
          </>
        )}
        <ChevronRight
          size={14}
          className={`text-foreground/20 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-4 right-4 top-full mt-2 bg-card-bg border border-card-border rounded-2xl shadow-2xl shadow-black/10 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 max-h-64 overflow-y-auto custom-scrollbar">
            {companies.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Building2 size={24} className="mx-auto text-foreground/20 mb-2" />
                <p className="text-[10px] font-black text-foreground/30 uppercase tracking-widest">No companies yet</p>
              </div>
            ) : (
              <>
                {/* No Company Option */}
                <button
                  onClick={() => handleSelect(null)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all mb-1 ${
                    !activeCompany ? 'bg-primary/10 text-primary' : 'hover:bg-input-bg text-foreground/40'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-input-bg border border-card-border flex items-center justify-center shrink-0">
                    <Building2 size={12} />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-widest flex-1">No Workspace</span>
                  {!activeCompany && <CheckCircle2 size={14} className="text-primary" />}
                </button>

                <div className="h-px bg-card-border my-1" />

                {companies.map(company => (
                  <button
                    key={company.id}
                    onClick={() => handleSelect(company)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                      activeCompany?.id === company.id ? 'bg-primary/10 text-primary' : 'hover:bg-input-bg text-foreground'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-white font-black text-xs"
                      style={{ backgroundColor: getCompanyColor(company.name) }}
                    >
                      {company.name[0].toUpperCase()}
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-tight flex-1 truncate">
                      {company.name}
                    </span>
                    {activeCompany?.id === company.id && <CheckCircle2 size={14} className="text-primary shrink-0" />}
                  </button>
                ))}
              </>
            )}
          </div>

          {isSuperAdmin && (
            <div className="border-t border-card-border p-2">
              <Link
                href="/companies"
                onClick={() => { setIsOpen(false); setMobileOpen(false); }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl w-full text-left hover:bg-primary/5 text-primary transition-all"
              >
                <PlusCircle size={14} />
                <span className="text-[11px] font-black uppercase tracking-widest">Manage Companies</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
