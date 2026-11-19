
'use client'

import { useTheme } from 'next-themes';
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed';
import { cn } from '@/lib/utils';
import LogoIcon from '@/public/assets/images/logo-icon.png';
import LogoWhite from '@/public/assets/images/logo-light.png';
import LogoDark from '@/public/assets/images/logo.png';

function LogoSidebar() {
  const { theme } = useTheme()
  const isCollapsed = useSidebarCollapsed();

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Don't render until mounted to avoid hydration mismatch or wrong theme
  if (!isMounted) return null;

  return (
    <Link
      href="/"
      className={cn(
        'sidebar-logo h-[3.75rem] py-2.5 flex items-center justify-center border-b border-neutral-100 dark:border-slate-700',
        isCollapsed ? 'px-1' : 'px-4'
      )}
    >
      <Image
        src={
          isCollapsed
            ? LogoIcon
            : theme === 'dark'
              ? LogoWhite
              : LogoDark
        }
        alt="Logo"
        width={isCollapsed ? 36 : 140}
        height={32}
        priority
      />
    </Link>
  )
}

export default LogoSidebar