"use client";

import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ImageGrid } from "@/components/ImageGrid";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { checkAndCreateUser } from '@/utils/userManagement';

// Initialize Supabase client
const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Image {
  id: number;
  gdrive_url: string;
  created_at: string;
  modified_at: string;
  file_name: string;
  gdrive_id: string;
  description: string | null;
  dataset_name: string | null;
  dataset_id: number | null;
}

interface User {
  user_email: string;
  // Add other user properties if needed
}

interface Dataset {
  id: number;
  dataset_name: string;
}

export default function Component() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [username, setUsername] = useState("User");
  const [isLoading, setIsLoading] = useState(true);
  const [images, setImages] = useState<Image[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [filteredImages, setFilteredImages] = useState<Image[]>([]);
  const router = useRouter();

  const fetchImages = async () => {
    const { data, error } = await supabase
      .from('images')
      .select(`
        id, 
        gdrive_url, 
        created_at, 
        modified_at,
        file_name, 
        gdrive_id,
        description,
        datasets (id, dataset_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching images:', error);
    } else {
      const processedImages: Image[] = data.map(item => ({
        id: item.id,
        gdrive_url: item.gdrive_url,
        created_at: item.created_at,
        modified_at: item.modified_at,
        file_name: item.file_name,
        gdrive_id: item.gdrive_id,
        description: item.description,
        dataset_name: item.datasets ? item.datasets.dataset_name : null,
        dataset_id: item.datasets ? item.datasets.id : null
      }));
      setImages(processedImages);
      setFilteredImages(processedImages);
    }
  };

  const fetchDatasets = async () => {
    const { data, error } = await supabase
      .from('datasets')
      .select('id, dataset_name')
      .order('dataset_name', { ascending: true });

    if (error) {
      console.error('Error fetching datasets:', error);
    } else {
      setDatasets(data || []);
    }
  };

  const handleDatasetChange = (datasetId: number | null) => {
    if (datasetId === null) {
      setFilteredImages(images);
    } else {
      const filtered = images.filter(image => image.dataset_id === datasetId);
      setFilteredImages(filtered);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        const userEmail = session.user.email || "User";
        const userId = session.user.id;
        const user = await checkAndCreateUser(userEmail, userId);
        if (user) {
          setUser(user);
          setUsername(user.user_email);
          setIsLoading(false);
        } else {
          console.error('Failed to check/create user');
          router.push('/login');
        }
      }
    };
    checkSession();
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchImages();
      fetchDatasets();
    }
  }, [user]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800">
      <Sidebar 
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        currentPage="Dashboard"
      />

      <main className="flex-1 flex flex-col overflow-hidden bg-white">
        <Header 
          username={username}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onSignOut={handleSignOut}
        />

        <div className="flex-1 overflow-hidden">
          <ImageGrid 
            images={filteredImages} 
            imageHeight="h-64" 
            datasets={datasets} 
            onDatasetChange={handleDatasetChange}
          />
        </div>
      </main>
    </div>
  );
}