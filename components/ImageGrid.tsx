import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Grid, List, Search, ChevronLeft, ChevronRight } from "lucide-react";

// Export the Image interface
export interface Image {
  id: number;
  imgur_url: string;
  created_at: string;
  filename: string;
  description: string | null;
  dataset_name: string | null;
  dataset_id: number | null;
}

interface Dataset {
  id: number;
  dataset_name: string;
}

interface ImageGridProps {
  images: Image[];
  onImageSelect?: (image: Image) => void;
  compact?: boolean;
  imageHeight?: string;
  datasets: Dataset[];
  onDatasetChange: (datasetId: number | null) => void;
}

export function ImageGrid({ 
  images: initialImages, 
  onImageSelect, 
  compact = false, 
  imageHeight = compact ? 'h-24' : 'h-64',
  datasets,
  onDatasetChange
}: ImageGridProps) {
  const [images, setImages] = useState<Image[]>(initialImages);
  const [filteredImages, setFilteredImages] = useState<Image[]>(initialImages);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'newest' | 'updated' | 'filename' | 'oldest'>('newest');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const imagesPerPage = 25;

  useEffect(() => {
    console.log('Initial images in ImageGrid:', initialImages);
    setImages(initialImages);
    setFilteredImages(initialImages);
  }, [initialImages]);

  useEffect(() => {
    sortImages();
  }, [sortBy]);

  const sortImages = () => {
    const sortedImages = [...filteredImages];
    switch (sortBy) {
      case 'newest':
        sortedImages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        sortedImages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'filename':
        sortedImages.sort((a, b) => a.filename.localeCompare(b.filename));
        break;
      case 'updated':
        sortedImages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    setFilteredImages(sortedImages);
  };

  const handleSearch = () => {
    if (searchTerm.trim() === '') {
      setFilteredImages(images);
    } else {
      const filtered = images.filter(image => 
        image.filename.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredImages(filtered);
    }
    setCurrentPage(1);
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (e.target.value.trim() === '') {
      setFilteredImages(images);
      setCurrentPage(1);
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const totalPages = Math.ceil(filteredImages.length / imagesPerPage);
  const indexOfLastImage = currentPage * imagesPerPage;
  const indexOfFirstImage = indexOfLastImage - imagesPerPage;
  const currentImages = filteredImages.slice(indexOfFirstImage, indexOfLastImage);

  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  const handleDatasetSelect = (value: string) => {
    setSelectedDataset(value);
    if (value === 'all') {
      onDatasetChange(null);
    } else {
      const datasetId = parseInt(value, 10);
      onDatasetChange(datasetId);
    }
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className={`bg-white ${compact ? 'p-2' : 'p-6'} flex items-center justify-between border-b border-gray-200`}>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            {/* Dataset selection dropdown */}
            <div className="mr-4">
              <Select value={selectedDataset || ''} onValueChange={handleDatasetSelect}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Dataset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Datasets</SelectItem>
                  {datasets.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id.toString()}>
                      {dataset.dataset_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input 
              className="w-64 bg-gray-100 border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500" 
              placeholder="Filter by filename" 
              value={searchTerm}
              onChange={handleSearchInputChange}
              onKeyPress={handleSearchKeyPress}
            />
            <Button 
              onClick={handleSearch}
              className="ml-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
          
          <Select value={sortBy} onValueChange={(value: 'newest' | 'updated' | 'filename' | 'oldest') => setSortBy(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="updated">Updated</SelectItem>
              <SelectItem value="filename">Filename</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            size="icon" 
            variant={viewMode === 'list' ? 'default' : 'ghost'} 
            className={`text-gray-600 ${viewMode === 'list' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
            onClick={() => setViewMode('list')}
          >
            <List className="h-5 w-5" />
          </Button>
          <Button 
            size="icon" 
            variant={viewMode === 'grid' ? 'default' : 'ghost'} 
            className={`text-gray-600 ${viewMode === 'grid' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Image Grid/List */}
      <ScrollArea className="flex-1">
        <div className={`${compact ? 'p-2' : 'p-6'} bg-white`}>
          <div className={viewMode === 'grid' ? `grid ${compact ? 'grid-cols-6 gap-2' : 'grid-cols-5 gap-4'}` : "space-y-4"}>
            {currentImages.map((image) => (
              <div key={image.id} className={`
                relative bg-gray-100 rounded-lg overflow-hidden group shadow-sm hover:shadow-md transition-shadow duration-300
                ${viewMode === 'list' ? 'flex items-center p-4' : ''}
              `}>
                <img
                  alt={`Image ${image.id}`}
                  className={`
                    object-cover
                    ${viewMode === 'grid' ? `w-full ${imageHeight}` : 'w-20 h-20 mr-4'}
                  `}
                  src={image.imgur_url}
                  style={{
                    aspectRatio: viewMode === 'grid' ? "1/1" : "auto",
                    objectFit: "cover",
                  }}
                />
                {image.dataset_name && (
                  <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded transition-opacity duration-300">
                    {image.dataset_name}
                  </div>
                )}
                <div className={`
                  absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs px-2 py-1
                  ${viewMode === 'grid' ? 'truncate' : ''}
                `}>
                  {image.filename}
                </div>
                {viewMode === 'list' && (
                  <div className="flex-1">
                    <p className="font-semibold">{image.filename}</p>
                    <p className="text-sm text-gray-500">{new Date(image.created_at).toLocaleString()}</p>
                    {image.dataset_name && (
                      <p className="text-xs text-indigo-600 mt-1">{image.dataset_name}</p>
                    )}
                  </div>
                )}
                <Button
                  className={`
                    bg-white text-indigo-600 hover:bg-indigo-50
                    ${viewMode === 'grid' 
                      ? 'absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity' 
                      : 'ml-auto'}
                  `}
                  size="sm"
                  onClick={() => onImageSelect && onImageSelect(image)}
                >
                  Select
                </Button>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Pagination */}
      <div className={`flex justify-center items-center ${compact ? 'p-2' : 'p-4'} border-t border-gray-200`}>
        <div className="flex items-center space-x-4">
          <Button 
            onClick={prevPage} 
            disabled={currentPage === 1}
            variant="outline"
            size="sm"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <span className="mx-4">Page {currentPage} of {totalPages}</span>
          <Button 
            onClick={nextPage} 
            disabled={currentPage === totalPages}
            variant="outline"
            size="sm"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}