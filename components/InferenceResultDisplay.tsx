import React from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface InferenceBox {
  id: string;
  class: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface InferenceResultDisplayProps {
  inferenceBoxes: InferenceBox[];
  onCheckboxChange: (id: string, checked: boolean) => void;
}

export function InferenceResultDisplay({ inferenceBoxes, onCheckboxChange }: InferenceResultDisplayProps) {
  return (
    <div className="space-y-3">
      {inferenceBoxes.map((box) => (
        <div key={box.id} className="flex items-start space-x-2">
          <Checkbox 
            id={box.id} 
            className="mt-1" 
            onCheckedChange={(checked) => onCheckboxChange(box.id, checked as boolean)}
          />
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <Label htmlFor={box.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {box.class}
              </Label>
              <span className="text-xs text-gray-500">
                {`(${(box.confidence * 100).toFixed(2)}%)`}
              </span>
            </div>
            <span className="text-xs text-gray-500 mt-1">
              {`[${box.x.toFixed(2)}, ${box.y.toFixed(2)}, ${(box.x + box.width).toFixed(2)}, ${(box.y + box.height).toFixed(2)}]`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}