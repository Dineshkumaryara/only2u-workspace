'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart } from 'lucide-react';

export default function Footer() {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  if (isAuthPage) {
    return null;
  }

  return (
    <footer className="w-full border-t border-card-border bg-card-bg mt-auto">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex justify-center md:justify-start space-x-6 md:order-2">
            <Link href="#" className="text-gray-400 hover:text-primary transition-colors">
              About
            </Link>
            <Link href="#" className="text-gray-400 hover:text-primary transition-colors">
              Tasks
            </Link>
            <Link href="#" className="text-gray-400 hover:text-primary transition-colors">
              Privacy
            </Link>
            <Link href="#" className="text-gray-400 hover:text-primary transition-colors">
              Terms
            </Link>
          </div>
          
          <div className="mt-8 md:mt-0 md:order-1 flex items-center justify-center md:justify-start">
            <p className="text-base text-gray-400 font-medium">
              &copy; {new Date().getFullYear()} only2u. All rights reserved.
            </p>
          </div>
        </div>
        
        <div className="mt-4 flex items-center justify-center text-sm text-gray-500">
          Made with <Heart size={14} className="mx-1 text-primary fill-primary animate-pulse" /> by only2u team
        </div>
      </div>
    </footer>
  );
}
