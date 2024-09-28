import { useState, useEffect } from 'react';
import { ImageGrid, Image } from './ImageGrid';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ImageGridModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (image: Image) => void;
  compact?: boolean;
}

interface Dataset {
  id: number;
  dataset_name: string;
}

export function ImageGridModal({ 
  isOpen, 
  onClose, 
  onImageSelect, 
  compact = true 
}: ImageGridModalProps) {
  const [allImages, setAllImages] = useState<Image[]>([]);
  const [filteredImages, setFilteredImages] = useState<Image[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);

  const fetchImages = async () => {
    const { data, error } = await supabase
      .from('images')
      .select(`
        id, 
        imgur_url, 
        created_at, 
        filename, 
        description,
        datasets (id, dataset_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching images:', error);
    } else {
      const processedImages: Image[] = data.map(item => ({
        id: item.id,
        imgur_url: item.imgur_url,
        created_at: item.created_at,
        filename: item.filename,
        description: item.description,
        dataset_id: item.datasets ? item.datasets.id : null,
        dataset_name: item.datasets ? item.datasets.dataset_name : null
      }));
      setAllImages(processedImages);
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

  useEffect(() => {
    if (isOpen) {
      fetchImages();
      fetchDatasets();
    }
  }, [isOpen]);

  const handleDatasetChange = (datasetId: number | null) => {
    if (datasetId === null) {
      // If "All Datasets" is selected, show all images
      setFilteredImages(allImages);
    } else {
      // Filter images based on the selected dataset
      const filtered = allImages.filter(image => image.dataset_id === datasetId);
      setFilteredImages(filtered);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] w-full max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Select an Image</DialogTitle>
        </DialogHeader>
        <div className="flex-grow overflow-hidden p-6 pt-2">
          <ImageGrid 
            images={filteredImages} 
            onImageSelect={(image) => {
              onImageSelect(image);
              onClose();
            }}
            compact={compact}
            imageHeight={compact ? "h-24" : "h-64"}
            datasets={datasets}
            onDatasetChange={handleDatasetChange}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}