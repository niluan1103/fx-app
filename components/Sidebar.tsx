import { Button } from "@/components/ui/button";
import { Menu, SquareDashedMousePointer, Rocket, Layers, Settings } from "lucide-react";
import Link from 'next/link';

interface SidebarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  currentPage: string;
}

export function Sidebar({ isSidebarOpen, onToggleSidebar, currentPage }: SidebarProps) {
  const pages = [
    { name: 'Dashboard', icon: Layers, path: '/dashboard' },
    { name: 'Inference', icon: Rocket, path: '/inference' },
    { name: 'Label', icon: SquareDashedMousePointer, path: '/label' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  return (
    <aside className={`bg-white p-6 shadow-md transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-16'}`}>
      <div className="flex justify-between items-center mb-8">
        <h1 className={`text-2xl font-bold text-indigo-600 ${isSidebarOpen ? '' : 'hidden'}`}>LT LAB</h1>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onToggleSidebar}
          className="text-gray-600 hover:text-indigo-600 hover:bg-gray-100"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>
      <nav className="space-y-2">
        {pages.map((page) => (
          <Link href={page.path} key={page.name} passHref>
            <Button 
              variant={page.name === currentPage ? "default" : "ghost"}
              className={`w-full justify-start text-gray-600 hover:text-indigo-600 hover:bg-gray-100 ${
                isSidebarOpen ? '' : 'px-0 justify-center'
              } ${page.name === currentPage ? 'bg-indigo-100 text-indigo-600' : ''}`}
            >
              <page.icon className={`h-5 w-5 ${isSidebarOpen ? 'mr-3' : ''}`} />
              {isSidebarOpen && page.name}
            </Button>
          </Link>
        ))}
      </nav>
    </aside>
  );
}