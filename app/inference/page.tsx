"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Check } from "lucide-react";
import { createClient } from '@supabase/supabase-js';
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useRouter } from 'next/navigation';
import { ImageGridModal } from "@/components/ImageGridModal";
import { cn } from "@/lib/utils";
import { checkAndCreateUser } from '@/utils/userManagement';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogHeader } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

// Initialize Supabase client
const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// API Endpoint
//const API_ENDPOINT = 'https://5c22e1a5-2b9c-4ad8-bc43-4356427e40b8-00-1f0rg8937q931.sisko.replit.dev';  
//const API_ENDPOINT = 'http://localhost:8000';
// const API_ENDPOINT = 'https://polished-seriously-tortoise.ngrok-free.app'; // ngrok tunnel to local API
const API_ENDPOINT = 'https://api.ltlab.site'; //Cloudflare tunnel to local API

interface Model {
  id: number;
  model_name: string;
  model_description: string;
}

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

// Add this new interface for model results including error state
interface ModelResult {
  model_name: string;
  detections: any[];
  resultImage: string;
  rating: number;
  comment: string;
  isSaved: boolean;
  error?: string; // New field to store error messages
}

export default function InferencePage() {
  // State declarations
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
  const [isCopied, setIsCopied] = useState(false);
  const [randomImages, setRandomImages] = useState<Image[]>([]);
  const [alertState, setAlertState] = useState({ isOpen: false, message: '' });
  const [saveConfirmState, setSaveConfirmState] = useState({ isOpen: false, pendingImage: null as Image | null });
  const [isCurrentResultSaved, setIsCurrentResultSaved] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [isAllModelsSelected, setIsAllModelsSelected] = useState(false);
  const [inferenceResults, setInferenceResults] = useState<ModelResult[]>([]);
  const [isRunningInference, setIsRunningInference] = useState(false);
  const [selectedModelResult, setSelectedModelResult] = useState('');
  const [selectedResultModel, setSelectedResultModel] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(0);
  const { toast } = useToast();

  // Create a function to show toast notifications
  const showToast = (message: string, type: "default" | "success" | "error" = "default") => {
    toast({
      description: message,
      variant: type === "error" ? "destructive" : "default",
    })
  };

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
        .select('id, gdrive_url, created_at, modified_at, file_name, gdrive_id, description, datasets (dataset_name, id)')
        .in('id', randomIndices)
        .limit(6);

      if (error) throw error;

      const processedImages: Image[] = data.map(item => ({
        id: item.id,
        gdrive_url: item.gdrive_url,
        created_at: item.created_at,
        modified_at: item.modified_at,
        file_name: item.file_name,
        gdrive_id: item.gdrive_id,
        description: item.description || null,
        dataset_name: item.datasets && item.datasets ? item.datasets.dataset_name : null,
        dataset_id: item.datasets && item.datasets ? item.datasets.id : null
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

  const getSelectedModelDescription = (modelName: string) => {
    const model = models.find(m => m.model_name === modelName);
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
    if (selectedModels.length === 0 || !selectedImage) {
      showToast("Please select at least one model and an image.", "error");
      return;
    }

    setIsRunningInference(true);
    setInferenceResults([]);
    setProcessedImage(null);
    setHasInferenceRun(false);

    try {
      const response = await fetch(`${API_ENDPOINT}/run_inference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_names: selectedModels,
          imageUrl: selectedImage.gdrive_url,
          confidenceThreshold: confidenceThreshold / 100, // Convert to 0-1 range
        }),
      });

      if (!response.ok) {
        throw new Error('Inference request failed');
      }

      const result = await response.json();
      const processedResults: ModelResult[] = result.modelResults.map((modelResult: any) => ({
        ...modelResult,
        rating: 0,
        comment: "",
        isSaved: false,
        error: modelResult.error || undefined // Include any errors from the backend
      }));

      setInferenceResults(processedResults);
      
      // Find the first successful result to display
      const firstSuccessfulResult = processedResults.find(r => !r.error);
      if (firstSuccessfulResult) {
        setProcessedImage(firstSuccessfulResult.resultImage);
      }
      
      setHasInferenceRun(true);
      setIsCurrentResultSaved(false);

      // Show a summary of the inference results
      const successCount = processedResults.filter(r => !r.error).length;
      const errorCount = processedResults.length - successCount;
      showToast(`Inference completed. ${successCount} model(s) succeeded, ${errorCount} failed.`, "success");
    } catch (error) {
      console.error('Inference error:', error);
      showToast('Error occurred during inference.', "error");
    } finally {
      setIsRunningInference(false);
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
    setInferenceResults([]); // Clear inference results
    setHasInferenceRun(false);
    setIsCurrentResultSaved(false);  // Reset this when selecting a new image
  };

  useEffect(() => {
    console.log('Selected model changed:', selectedModel);
  }, [selectedModel]);

  const handleSaveResult = async () => {
    if (!selectedImage || !selectedResultModel) {
      showToast("Please select an image and a model result to save.", "error");
      return;
    }

    const currentResult = getCurrentModelResult();
    if (!currentResult) {
      showToast("No result found for the selected model.", "error");
      return;
    }

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

      // Get the model ID based on the model name
      const { data: modelData, error: modelError } = await supabase
        .from('models')
        .select('id')
        .eq('model_name', selectedResultModel)
        .single();

      if (modelError) throw modelError;

      const newAnnotation = {
        image_id: selectedImage.id,
        model_id: modelData.id,
        anno_json: currentResult.detections,
        rating: currentResult.rating,
        comment: currentResult.comment,
        by_user_id: userData.id
      };

      // Check for existing annotation
      const { data: existingAnnotations, error: checkError } = await supabase
        .from('model_anno')
        .select('*')
        .eq('image_id', newAnnotation.image_id)
        .eq('model_id', newAnnotation.model_id)
        .eq('by_user_id', newAnnotation.by_user_id);

      if (checkError) throw checkError;

      let saveOperation;
      if (existingAnnotations && existingAnnotations.length > 0) {
        // Update existing annotation
        saveOperation = supabase
          .from('model_anno')
          .update(newAnnotation)
          .eq('id', existingAnnotations[0].id);
      } else {
        // Insert new annotation
        saveOperation = supabase
          .from('model_anno')
          .insert([newAnnotation]);
      }

      const { error: saveError } = await saveOperation;
      if (saveError) throw saveError;

      showToast('Result saved successfully!', "success");
      setInferenceResults(prevResults =>
        prevResults.map(result =>
          result.model_name === selectedResultModel
            ? { ...result, isSaved: true }
            : result
        )
      );
    } catch (error) {
      console.error('Error saving result:', error);
      showToast('Failed to save result. Please try again.', "error");
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

  // Update this function to handle both card and tab selection
  const handleModelResultSelection = (modelName: string) => {
    setSelectedResultModel(modelName);
  };

  // Update the displayInferenceResult function to handle errors
  const displayInferenceResult = () => {
    if (inferenceResults.length === 0) {
      return hasInferenceRun ? 'No detection found' : 'No results yet';
    }

    return inferenceResults.map((result, index) => (
      <Card 
        key={index} 
        className={cn(
          "mb-2 transition-all cursor-pointer relative",
          selectedResultModel === result.model_name ? "bg-gray-200" : "bg-white",
          result.error ? "border-red-500" : ""
        )}
        onClick={() => handleModelResultSelection(result.model_name)}
      >
        {result.isSaved && (
          <div className="absolute top-2 right-2">
            <Check className="h-5 w-5 text-blue-500" />
          </div>
        )}
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-sm font-medium">{result.model_name}</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3">
          {result.error ? (
            <p className="text-xs text-red-500">{result.error}</p>
          ) : (
            <p className="text-xs">{formatInferenceResult(result.detections)}</p>
          )}
        </CardContent>
      </Card>
    ));
  };

  const handleCopyResult = async () => {
    let resultText: string;
    const result = displayInferenceResult();
    
    if (typeof result === 'string') {
      resultText = result;
    } else if (Array.isArray(result)) {
      resultText = result.map(item => item.props.children[1].props.children).join('\n');
    } else {
      resultText = 'No results available';
    }

    try {
      await navigator.clipboard.writeText(resultText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleModelSelection = (modelName: string) => {
    setSelectedModels(prev => 
      prev.includes(modelName) 
        ? prev.filter(m => m !== modelName)
        : [...prev, modelName]
    );
  };

  const handleSelectAllModels = () => {
    if (isAllModelsSelected) {
      setSelectedModels([]);
      setIsAllModelsSelected(false);
    } else {
      setSelectedModels(models.map(model => model.model_name));
      setIsAllModelsSelected(true);
    }
  };

  useEffect(() => {
    setIsAllModelsSelected(selectedModels.length === models.length);
  }, [selectedModels, models]);

  const handleRatingChange = (newRating: number) => {
    setInferenceResults(prevResults =>
      prevResults.map(result =>
        result.model_name === selectedResultModel
          ? { ...result, rating: newRating }
          : result
      )
    );
  };

  const handleCommentChange = (newComment: string) => {
    setInferenceResults(prevResults =>
      prevResults.map(result =>
        result.model_name === selectedResultModel
          ? { ...result, comment: newComment }
          : result
      )
    );
  };

  const getCurrentModelResult = () => {
    return inferenceResults.find(result => result.model_name === selectedResultModel);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-800">
      {/* Header */}
      <Header 
        username={username}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onSignOut={handleSignOut}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar 
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          currentPage="Inference"
        />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-white flex flex-col lg:flex-row pb-16 lg:pb-0">
          {/* Left Column */}
          <div className="w-full lg:w-1/4 p-4 lg:p-6 border-b lg:border-r border-gray-200">
            {/* Model Selection */}
            <h2 className="text-xl font-bold mb-4">Model Selection</h2>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedModels.length > 0 ? `${selectedModels.length} model(s) selected` : "Select Models"}
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full lg:w-80">
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="select-all-models"
                        checked={isAllModelsSelected}
                        onCheckedChange={handleSelectAllModels}
                      />
                      <label
                        htmlFor="select-all-models"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Select All Models
                      </label>
                    </div>
                    {models.map((model) => (
                      <div key={model.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`model-${model.id}`}
                          checked={selectedModels.includes(model.model_name)}
                          onCheckedChange={() => handleModelSelection(model.model_name)}
                        />
                        <label
                          htmlFor={`model-${model.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {model.model_name}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* Random Image Selection */}
            <h3 className="text-lg font-semibold mt-6 mb-2">Random Images to select</h3>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {randomImages.map((image) => (
                <img
                  key={image.id}
                  src={image.gdrive_url}
                  alt={image.file_name}
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
                disabled={selectedModels.length === 0}
              >
                Run Selected Models
              </Button>
            </div>
          </div>

          {/* Middle Column - Image Display */}
          <div className="w-full lg:w-1/2 p-4 lg:p-6 flex flex-col">
            <h2 className="text-xl font-bold mb-4">
              {inferenceResults.length > 0 ? "Model Result Images" : "Selected Image"}
            </h2>
            {inferenceResults.length > 0 ? (
              <Tabs 
                value={selectedResultModel || inferenceResults[0]?.model_name}
                className="w-full"
                onValueChange={handleModelResultSelection}
              >
                <TabsList className="flex flex-wrap mb-6">
                  {inferenceResults.map((result, index) => (
                    <TabsTrigger 
                      key={index} 
                      value={result.model_name}
                      className="flex-grow basis-1/2 lg:basis-1/4 max-w-[50%] lg:max-w-[25%]"
                    >
                      {result.model_name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <div className="mt-4">
                  {inferenceResults.map((result, index) => (
                    <TabsContent key={index} value={result.model_name}>
                      <Card className="w-full">
                        <CardHeader>
                          <CardTitle className="text-lg font-bold text-center">
                            {selectedImage ? selectedImage.file_name : 'No image selected'}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center">
                          {result.error ? (
                            <div className="w-full h-[50vh] bg-red-100 flex items-center justify-center text-red-500">
                              Error: {result.error}
                            </div>
                          ) : (
                            <img
                              src={result.resultImage}
                              alt={`${result.model_name} Result`}
                              className="max-w-full max-h-[50vh] object-contain mb-4"
                            />
                          )}
                          <p className="text-sm text-gray-600 text-center">
                            {selectedImage ? (selectedImage.description || "No description") : ''}
                          </p>
                        </CardContent>
                        <CardFooter>
                          <p className="text-sm text-gray-600 w-full text-center">
                            {result.error ? 'Inference failed for this model' : formatInferenceResult(result.detections)}
                          </p>
                        </CardFooter>
                      </Card>
                    </TabsContent>
                  ))}
                </div>
              </Tabs>
            ) : (
              <Card className="w-full">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-center">
                    {selectedImage ? selectedImage.file_name : 'No image selected'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                  {selectedImage ? (
                    <img
                      src={selectedImage.gdrive_url}
                      alt={selectedImage.file_name}
                      className="max-w-full max-h-[50vh] object-contain mb-4"
                    />
                  ) : (
                    <div className="w-full h-[50vh] bg-gray-200 flex items-center justify-center text-gray-500">
                      No image selected
                    </div>
                  )}
                  <p className="text-sm text-gray-600 text-center">
                    {selectedImage ? (selectedImage.description || "No description") : ''}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column */}
          <div className="w-full lg:w-1/4 p-4 lg:p-6 border-t lg:border-l border-gray-200">
            {/* Inference Results */}
            <h2 className="text-xl font-bold mb-4">Inference Results</h2>
            <div className="bg-white rounded mb-6 relative">
              <ScrollArea className="h-[50vh] pr-2">
                {isRunningInference ? (
                  <div className="p-3 flex items-center">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    <p className="text-base">Running inference...</p>
                  </div>
                ) : inferenceResults.length > 0 ? (
                  displayInferenceResult()
                ) : (
                  <p className="p-3 text-base">No inference results yet. Select an image and run inference.</p>
                )}
              </ScrollArea>
              <Button
                variant="ghost"
                size="icon"
                className="absolute bottom-2 right-2"
                onClick={handleCopyResult}
              >
                {isCopied ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </Button>
            </div>

            {/* Rating Section */}
            {selectedResultModel && (
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">
                  Rating: {selectedResultModel}
                </h3>
                <div className="flex mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 cursor-pointer ${
                        star <= (getCurrentModelResult()?.rating || 0) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
                      }`}
                      onClick={() => handleRatingChange(star)}
                    />
                  ))}
                </div>
                <Textarea
                  placeholder="Add your comments here..."
                  value={getCurrentModelResult()?.comment || ""}
                  onChange={(e) => handleCommentChange(e.target.value)}
                  className="w-full h-20 mb-2 text-sm"
                />
              </div>
            )}

            <div className="flex space-x-2 mt-4 mb-4 lg:mb-0">
              <Button 
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white" 
                onClick={handleSaveResult} 
                disabled={!hasInferenceRun || !selectedResultModel || getCurrentModelResult()?.isSaved}
              >
                {getCurrentModelResult()?.isSaved 
                  ? `${selectedResultModel} Result Saved` 
                  : `Save ${selectedResultModel} Result`}
              </Button>
            </div>
          </div>
        </main>
      </div>

      {/* ImageGridModal */}
      <ImageGridModal
        isOpen={isImageGridModalOpen}
        onClose={() => setIsImageGridModalOpen(false)}
        onImageSelect={handleImageSelect}
        compact={true}
      />

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
              setSaveConfirmState({ isOpen: false, pendingImage: null });
            }}>
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  );
}