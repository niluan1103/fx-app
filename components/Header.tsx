import { Button } from "@/components/ui/button";
import { Menu, User, ChevronDown, LogOut } from "lucide-react"; // Added ChevronDown icon
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

interface HeaderProps {
  username: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSignOut: () => void;
}

export function Header({ username, isSidebarOpen, onToggleSidebar, onSignOut }: HeaderProps) {
  const trimmedUsername = username.split('@')[0];

  return (
    <header className="bg-white p-6 flex items-center justify-between border-b border-gray-200">
      <div className="flex items-center">
        <h1 className="text-3xl font-bold text-indigo-600">Fracture Detection App</h1>
      </div>
      <div className="flex items-center space-x-4">
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2">
                <div className="bg-indigo-100 rounded-full p-2">
                  <User className="h-6 w-6 text-indigo-600" />
                </div>
                <span className="text-lg font-medium text-gray-700">{trimmedUsername}</span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="bg-white rounded-md shadow-lg p-1 mt-2">
                <DropdownMenu.Item className="focus:outline-none">
                  <button 
                    onClick={onSignOut}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center rounded-md transition-colors duration-150 ease-in-out"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </button>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}