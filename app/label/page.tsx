"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Check, Move, Square, Undo, Redo, Trash2 } from "lucide-react";
import { createClient } from '@supabase/supabase-js';
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useRouter } from 'next/navigation';
import { ImageGridModal } from "@/components/ImageGridModal";
import { cn } from "@/lib/utils";
import { checkAndCreateUser } from '@/utils/userManagement';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogHeader } from "@/components/ui/alert-dialog";
import dynamic from 'next/dynamic';
import { InferenceResultDisplay } from "@/components/InferenceResultDisplay";
import { useHotkeys } from 'react-hotkeys-hook';

// Initialize Supabase client
const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Model {
  id: number;
  model_name: string;
  model_description: string;
}

interface Image {
  id: number;
  imgur_url: string;
  created_at: string;
  filename: string;
  description: string | null;
  dataset_name: string | null;
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
}

interface InferenceResult {
  bbox_xyxy: number[][];
  classes: string[];
  confidences: number[];
}

interface InferenceBox extends Rectangle {
  class: string;
  confidence: number;
}

const KonvaCanvas = dynamic(() => import('@/components/KonvaCanvas').then((mod) => mod.KonvaCanvas), {
  ssr: false,
});

export default function LabelPage() {
  // State declarations
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState('');
  const [confidenceThreshold, setConfidenceThreshold] = useState(50);
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);
  const [inferenceResult, setInferenceResult] = useState<string | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isViewAllImages, setIsViewAllImages] = useState(false);
  const [username, setUsername] = useState("User");
  const router = useRouter();
  const [isImageGridModalOpen, setIsImageGridModalOpen] = useState(false);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [hasInferenceRun, setHasInferenceRun] = useState(false);
  const [canSaveResult, setCanSaveResult] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [randomImages, setRandomImages] = useState<Image[]>([]);
  const [alertState, setAlertState] = useState({ isOpen: false, message: '' });
  const [saveConfirmState, setSaveConfirmState] = useState({ isOpen: false, pendingImage: null as Image | null });
  const [isCurrentResultSaved, setIsCurrentResultSaved] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [selectedTool, setSelectedTool] = useState<'drag' | 'boundingBox' | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [rectangles, setRectangles] = useState<Rectangle[]>([]);
  const [selectedId, selectShape] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [inferenceBoxes, setInferenceBoxes] = useState<InferenceBox[]>([]);
  const [checkedBoxes, setCheckedBoxes] = useState<Set<string>>(new Set());

  const handleImageLoad = useCallback((image: HTMLImageElement) => {
    setImageDimensions({ width: image.width, height: image.height });
  }, []);

  useEffect(() => {
    if (processedImage) {
      const img = new Image();
      img.onload = () => handleImageLoad(img);
      img.src = processedImage;
    }
  }, [processedImage, handleImageLoad]);

  // Fetch models from Supabase
  const fetchModels = async () => {
    setIsLoadingModels(true);
    const { data, error } = await supabase
      .from('models')
      .select('id, model_name, model_description');
    if (error) {
      console.error('Error fetching models:', error);
    } else {
      setModels(data || []);
      // Set default model
      const defaultModel = data?.find(model => model.id === 1);
      if (defaultModel) {
        setSelectedModel(defaultModel.model_name);
        console.log('Default model set:', defaultModel.model_name);
      } else {
        console.log('No default model found with id 1');
      }
    }
    setIsLoadingModels(false);
  };

  const fetchRandomImages = async () => {
    try {
      // First, get the total count of images
      const { count, error: countError } = await supabase
        .from('images')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;
      if (count === null) throw new Error('No images found');

      // Generate 6 random indices
      const totalImages = count;
      const randomIndices = Array.from({ length: 6 }, () => Math.floor(Math.random() * totalImages));

      // Fetch images at those indices
      const { data, error } = await supabase
        .from('images')
        .select('id, imgur_url, created_at, filename, description, datasets (dataset_name)')
        .in('id', randomIndices)
        .limit(6);

      if (error) throw error;

      const processedImages: Image[] = data.map(item => ({
        id: item.id,
        imgur_url: item.imgur_url,
        created_at: item.created_at || null,
        filename: item.filename,
        description: item.description || null,
        dataset_name: item.datasets && item.datasets[0] ? item.datasets[0].dataset_name : null
      }));

      setRandomImages(processedImages);
    } catch (error) {
      console.error('Error fetching random images:', error);
    }
  };

  // Use effect to fetch data on component mount
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
          setUsername(user.user_email);
          fetchModels();
          fetchRandomImages(); // Fetch random images when the component mounts
        } else {
          console.error('Failed to check/create user');
          router.push('/login');
        }
      }
    };
    checkSession();
  }, [router]);

  // Remove the handleViewAllImages function as we'll implement it differently

  const getSelectedModelDescription = () => {
    const model = models.find(m => m.model_name === selectedModel);
    return model ? model.model_description : '';
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const handleViewAllImages = () => {
    setIsImageGridModalOpen(true);
  };

  const handleImageSelect = (image: Image) => {
    handleImageSelection(image);
    setIsImageGridModalOpen(false);
  };

  const runInference = async () => {
    if (!selectedModel || !selectedImage) {
      showAlert("Please select both a model and an image.", 3000);
      return;
    }

    setInferenceResult("Running inference...");
    setProcessedImage(null);
    setCanSaveResult(false);

    try {
      const response = await fetch('http://localhost:8000/run_inference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_name: selectedModel,
          imageUrl: selectedImage.imgur_url,
          confidenceThreshold: confidenceThreshold / 100,
        }),
      });

      if (!response.ok) {
        throw new Error('Inference request failed');
      }

      const result = await response.json();
      setProcessedImage(result.originalImage);
      console.log('Inference result:', result.detections);

      const inferenceResult = result.detections;
      setInferenceResult(JSON.stringify(inferenceResult));

      if (inferenceResult && Array.isArray(inferenceResult) && inferenceResult.length > 0) {
        const newInferenceBoxes: InferenceBox[] = inferenceResult.map((detection, index) => ({
          x: detection.bbox_xyxy[0],
          y: detection.bbox_xyxy[1],
          width: detection.bbox_xyxy[2] - detection.bbox_xyxy[0],
          height: detection.bbox_xyxy[3] - detection.bbox_xyxy[1],
          id: `inference_${index}`,
          class: detection.class,
          confidence: detection.confidence,
        }));

        setInferenceBoxes(newInferenceBoxes);
      } else {
        console.warn('No detections found in inference result');
        setInferenceBoxes([]);
      }

      setHasInferenceRun(true);
      setIsCurrentResultSaved(false);
      setCanSaveResult(true);
    } catch (error) {
      console.error('Inference error:', error);
      setInferenceResult('Error occurred during inference.');
      setInferenceBoxes([]);
    }
  };

  const handleImageSelection = (image: Image) => {
    if (hasInferenceRun && !isCurrentResultSaved) {
      setSaveConfirmState({ isOpen: true, pendingImage: image });
    } else {
      proceedWithImageSelection(image);
    }
  };

  const proceedWithImageSelection = (image: Image) => {
    setSelectedImage(image);
    setProcessedImage(null);
    setInferenceResult(null);
    setHasInferenceRun(false);
    setCanSaveResult(false);  // Reset this when selecting a new image
    setIsCurrentResultSaved(false);  // Reset this when selecting a new image
  };

  useEffect(() => {
    console.log('Selected model changed:', selectedModel);
  }, [selectedModel]);

  const handleSaveResult = async () => {
    if (!canSaveResult || !selectedImage || !selectedModel || !inferenceResult) return;

    try {
      // Get the current user's ID from the users table
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user found');

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single();

      if (userError) throw userError;

      // Get the selected model's ID
      const { data: modelData, error: modelError } = await supabase
        .from('models')
        .select('id')
        .eq('model_name', selectedModel)
        .single();

      if (modelError) throw modelError;

      // Parse inferenceResult if it's a valid JSON string, otherwise use it as is
      let parsedInferenceResult;
      try {
        parsedInferenceResult = JSON.parse(inferenceResult);
      } catch {
        parsedInferenceResult = inferenceResult;
      }

      // Prepare the data for insertion
      const newAnnotation = {
        image_id: selectedImage.id,
        model_id: modelData.id,
        anno_json: parsedInferenceResult,
        by_user_id: userData.id
      };

      // Check for duplicate entries
      const { data: existingAnnotations, error: checkError } = await supabase
        .from('model_anno')
        .select('*')
        .eq('image_id', newAnnotation.image_id)
        .eq('model_id', newAnnotation.model_id)
        .eq('by_user_id', newAnnotation.by_user_id);

      if (checkError) throw checkError;

      if (existingAnnotations && existingAnnotations.length > 0) {
        // Check if the anno_json is the same
        const isDuplicate = existingAnnotations.some(annotation => 
          JSON.stringify(annotation.anno_json) === JSON.stringify(newAnnotation.anno_json)
        );

        if (isDuplicate) {
          showAlert('Result has already been saved.', 2000);
          setCanSaveResult(false);
          return;
        }
      }

      // If no duplicate found, insert the new row into the model_anno table
      const { error: insertError } = await supabase
        .from('model_anno')
        .insert([newAnnotation]);

      if (insertError) throw insertError;

      showAlert('Result saved successfully!', 2000);
      setCanSaveResult(false);
      setIsCurrentResultSaved(true);  // Set this to true after successful save
    } catch (error) {
      console.error('Error saving result:', error);
      showAlert('Failed to save result. Please try again.', 2000);
    }
  };

  const formatInferenceResult = (detections: any[]) => {
    // Check if detections array is empty
    if (!detections || detections.length === 0) {
      return "No detection found";
    }

    // Group detections by class and keep all confidences
    const groupedDetections = detections.reduce((acc: any, detection: any) => {
      if (!acc[detection.class]) {
        acc[detection.class] = [];
      }
      acc[detection.class].push(detection.confidence);
      return acc;
    }, {});

    // Format the grouped detections
    const formattedDetections = Object.entries(groupedDetections).map(([className, confidences]) => ({
      class: className,
      count: (confidences as number[]).length,
      confidences: (confidences as number[]).map(conf => (conf * 100).toFixed(0) + '%').join(', ')
    }));

    // Create the summary sentence
    return formattedDetections.reduce((summary: string, detection: any, index: number) => {
      const detectionPhrase = `${detection.count} ${detection.class}${detection.count > 1 ? 's' : ''} (${detection.confidences} confidence)`;
      if (index === 0) {
        return `The image contains ${detectionPhrase}`;
      } else if (index === formattedDetections.length - 1) {
        return `${summary}, and ${detectionPhrase}`;
      } else {
        return `${summary}, ${detectionPhrase}`;
      }
    }, '');
  };

  const displayInferenceResult = () => {
    if (!inferenceResult) {
      return hasInferenceRun ? 'No detection found' : 'No results yet';
    }

    try {
      const parsedResult = JSON.parse(inferenceResult);
      // Remove confidence property from each detection
      const cleanedResult = parsedResult.map((detection: any) => {
        const { confidence, ...rest } = detection;
        return rest;
      });
      return JSON.stringify(parsedResult, null, 2);
      //return formatInferenceResult(parsedResult);
    } catch (error) {
      // If parsing fails, it means inferenceResult is not a JSON string
      return inferenceResult;
    }
  };

  const handleCopyResult = async () => {
    const resultText = displayInferenceResult();
    try {
      await navigator.clipboard.writeText(resultText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const showAlert = (message: string, timeout: number) => {
    setAlertState({ isOpen: true, message });
    setTimeout(() => {
      setAlertState({ isOpen: false, message: '' });
    }, timeout);
  };

  const handleMouseDown = (e: any) => {
    if (selectedTool !== 'boundingBox') return;
    const pos = e.target.getStage().getPointerPosition();
    setIsDrawing(true);
    setRectangles([...rectangles, { x: pos.x, y: pos.y, width: 0, height: 0, id: `rect${rectangles.length + 1}` }]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const lastRect = rectangles[rectangles.length - 1];
    const newWidth = point.x - lastRect.x;
    const newHeight = point.y - lastRect.y;
    setRectangles(
      rectangles.map((r, i) => (i === rectangles.length - 1 ? { ...r, width: newWidth, height: newHeight } : r))
    );
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    const lastRect = rectangles[rectangles.length - 1];
    if (lastRect) {
      if (Math.abs(lastRect.width) < 20 || Math.abs(lastRect.height) < 20) {
        // Remove the last rectangle if it's too small
        setRectangles(rectangles.slice(0, -1));
      } else {
        // Ensure positive width and height
        setRectangles(rectangles.map((rect, index) => 
          index === rectangles.length - 1
            ? {
                ...rect,
                x: rect.width < 0 ? rect.x + rect.width : rect.x,
                y: rect.height < 0 ? rect.y + rect.height : rect.y,
                width: Math.abs(rect.width),
                height: Math.abs(rect.height),
              }
            : rect
        ));
      }
    }
  };

  const handleSelectRect = (id: string) => {
    selectShape(id);
  };

  const handleDragEnd = (e: any, id: string) => {
    const { x, y } = e.target.position();
    setRectangles(
      rectangles.map((rect) => (rect.id === id ? { ...rect, x, y } : rect))
    );
  };

  const handleClearAll = () => {
    setRectangles([]);
    selectShape(null);
  };

  const handleDeleteSelected = () => {
    if (selectedId) {
      setRectangles(rectangles.filter(rect => rect.id !== selectedId));
      selectShape(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete') {
        handleDeleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedId, rectangles]);

  useEffect(() => {
    if (selectedImage) {
      const img = new Image();
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height });
      };
      img.src = selectedImage.imgur_url;
    }
  }, [selectedImage]);

  const handleCheckboxChange = (id: string, checked: boolean) => {
    setCheckedBoxes(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const handleDeleteCheckedBoxes = useCallback(() => {
    if (checkedBoxes.size === 0) return;

    setInferenceBoxes(prev => prev.filter(box => !checkedBoxes.has(box.id)));
    setCheckedBoxes(new Set());
  }, [checkedBoxes]);

  useHotkeys('delete', handleDeleteCheckedBoxes, [handleDeleteCheckedBoxes]);

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800">
      {/* Sidebar */}
      <Sidebar 
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        currentPage="Label"
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header 
          username={username}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onSignOut={handleSignOut}
        />

        {/* Inference Content */}
        <main className="flex-1 overflow-hidden bg-white flex">
          {/* Left Column */}
          <div className="w-1/4 border-r border-gray-200">
            <ScrollArea className="h-full">
              <div className="p-6">
                {/* Dataset & Label Selection */}
                {/*<h2 className="text-2xl font-bold mb-4">Dataset & Label</h2>*/}
                <div className="flex space-x-2 mb-4">
                  <Select 
                    value={selectedDataset} 
                    onValueChange={setSelectedDataset}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Dataset" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dataset1">Dataset 1</SelectItem>
                      <SelectItem value="dataset2">Dataset 2</SelectItem>
                      <SelectItem value="dataset3">Dataset 3</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select 
                    value={selectedLabel} 
                    onValueChange={setSelectedLabel}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Label" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="label1">Label 1</SelectItem>
                      <SelectItem value="label2">Label 2</SelectItem>
                      <SelectItem value="label3">Label 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Random Image Selection */}
                {/*<h3 className="text-lg font-semibold mb-2">Random Images to select</h3>*/}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {randomImages.map((image) => (
                    <img
                      key={image.id}
                      src={image.imgur_url}
                      alt={image.filename}
                      className="w-full h-24 object-cover rounded cursor-pointer"
                      onClick={() => handleImageSelection(image)}
                    />
                  ))}
                </div>
                <Button 
                  className="w-full mb-4 bg-indigo-600 hover:bg-indigo-700 text-white" 
                  onClick={handleViewAllImages}
                >
                  View all
                </Button>

                {/* Tool Buttons */}
                <div className="flex justify-between mb-4">
                  <Button
                    variant="outline"
                    size="icon"
                    className={`w-12 h-12 ${selectedTool === 'boundingBox' ? 'bg-blue-100' : ''}`}
                    onClick={() => setSelectedTool(selectedTool === 'boundingBox' ? null : 'boundingBox')}
                  >
                    <Square className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-12 h-12"
                    onClick={handleClearAll}
                  >
                    <Trash2 className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-12 h-12"
                  >
                    <Undo className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-12 h-12"
                  >
                    <Redo className="h-6 w-6" />
                  </Button>
                </div>

                {/* Model Selection */}
                <h2 className="text-2xl font-bold mb-4">AI Helper</h2>
                <Select 
                  value={selectedModel} 
                  onValueChange={setSelectedModel} 
                  disabled={isLoadingModels}
                >
                  <SelectTrigger className="w-full mb-4">
                    <SelectValue placeholder={isLoadingModels ? "Loading models..." : "Select Model"} />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.model_name}>
                        {model.model_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select> 

                {/* Confidence Threshold */}
                <h3 className="text-lg font-semibold mb-2">Confidence Threshold</h3>
                <Slider
                  value={[confidenceThreshold]}
                  onValueChange={(value) => setConfidenceThreshold(value[0])}
                  max={100}
                  step={1}
                  className="mb-4"
                />
                <p className="text-sm text-gray-600 mb-4">Threshold: {confidenceThreshold}%</p>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <Button 
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white" 
                    onClick={runInference}
                  >
                    Run Model
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Middle Column - Image Display */}
          <div className="w-1/2 p-6 flex flex-col items-center justify-center" id="image-display">
            <div ref={containerRef} className="w-full h-[70vh] flex items-center justify-center overflow-hidden">
              {selectedImage && (
                <KonvaCanvas
                  processedImage={processedImage}
                  selectedImage={selectedImage.imgur_url}
                  imageDimensions={imageDimensions}
                  rectangles={rectangles}
                  inferenceBoxes={inferenceBoxes}
                  selectedId={selectedId}
                  selectedTool={selectedTool}
                  handleMouseDown={handleMouseDown}
                  handleMouseMove={handleMouseMove}
                  handleMouseUp={handleMouseUp}
                  handleSelectRect={handleSelectRect}
                  handleDragEnd={handleDragEnd}
                  handleClearAll={handleClearAll}
                  setRectangles={setRectangles}
                  handleDeleteSelected={handleDeleteSelected}
                />
              )}
            </div>
            {/* Image Description */}
            <h3 className="text-lg font-semibold mt-6 mb-2">
              {selectedImage ? selectedImage.filename : 'No image selected'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {selectedImage
                ? (selectedImage.description || "No description")
                : ''}
            </p>
          </div>

          {/* Right Column */}
          <div className="w-1/4 p-6 border-l border-gray-200">
            {/* Label Results */}
            <h2 className="text-2xl font-bold mb-4">Label Results</h2>
            <div className="bg-gray-100 p-4 rounded mb-4 relative overflow-hidden">
              <ScrollArea className="h-[50vh]">
                <InferenceResultDisplay 
                  inferenceBoxes={inferenceBoxes} 
                  onCheckboxChange={handleCheckboxChange}
                />
              </ScrollArea>
              <Button
                variant="ghost"
                size="icon"
                className="absolute bottom-2 right-2"
                onClick={handleCopyResult}
              >
                {isCopied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            {/* Save Result Button */}
            <div className="flex space-x-2 mt-4">
              <Button 
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white" 
                onClick={handleSaveResult} 
                disabled={!canSaveResult}
              >
                Save Result
              </Button>
            </div>
            <Button
              className="mt-4 bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeleteCheckedBoxes}
              disabled={checkedBoxes.size === 0}
            >
              Delete Selected
            </Button>
          </div>
        </main>

        {/* ImageGridModal */}
        <ImageGridModal
          isOpen={isImageGridModalOpen}
          onClose={() => setIsImageGridModalOpen(false)}
          onImageSelect={handleImageSelect}
          compact={true}
        />

        <AlertDialog open={alertState.isOpen} onOpenChange={(isOpen) => setAlertState(prev => ({ ...prev, isOpen }))}>
          <AlertDialogContent>
            <AlertDialogTitle>Info</AlertDialogTitle>
            <AlertDialogDescription>
              {alertState.message}
            </AlertDialogDescription>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog 
          open={saveConfirmState.isOpen} 
          onOpenChange={(isOpen) => setSaveConfirmState(prev => ({ ...prev, isOpen }))}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Save Current Result?</AlertDialogTitle>
              <AlertDialogDescription>
                Do you want to save the current inference result before selecting a new image?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => proceedWithImageSelection(saveConfirmState.pendingImage!)}>
                Don't Save
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                setCanSaveResult(true);
                setSaveConfirmState({ isOpen: false, pendingImage: null });
              }}>
                Save
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}