import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Transformer, Text } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';

// Define the Rectangle type
interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
}

interface InferenceBox extends Rectangle {
  class: string;
  confidence: number;
}

interface KonvaCanvasProps {
  processedImage: string | null;
  selectedImage: string | null;
  imageDimensions: { width: number; height: number };
  rectangles: Rectangle[];
  selectedId: string | null;
  selectedTool: 'drag' | 'boundingBox' | null;  // Updated this line
  handleMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  handleMouseMove: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  handleMouseUp: () => void;
  handleSelectRect: (id: string) => void;
  handleDragEnd: (e: Konva.KonvaEventObject<DragEvent>, id: string) => void;
  handleClearAll: () => void;
  setRectangles: React.Dispatch<React.SetStateAction<Rectangle[]>>;
  handleDeleteSelected: () => void;
  inferenceBoxes: InferenceBox[];
}

export function KonvaCanvas({
  processedImage,
  selectedImage,
  imageDimensions,
  rectangles,
  selectedId,
  selectedTool,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleSelectRect,
  handleDragEnd,
  handleClearAll,
  setRectangles,
  handleDeleteSelected,
  inferenceBoxes
}: KonvaCanvasProps) {
  const [processedKonvaImage] = useImage(processedImage || '');
  const [selectedKonvaImage] = useImage(selectedImage || '');
  const transformerRef = useRef<Konva.Transformer>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [scale, setScale] = useState(1);

  const imageToRender = processedImage ? processedKonvaImage : selectedKonvaImage;

  useEffect(() => {
    if (imageToRender && imageToRender.complete) {
      setImageLoaded(true);
    }
  }, [imageToRender]);

  useEffect(() => {
    if (selectedId && transformerRef.current && stageRef.current) {
      const node = stageRef.current.findOne('#' + selectedId);
      if (node) {
        transformerRef.current.nodes([node as Konva.Node]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  }, [selectedId]);

  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // reset scale
    node.scaleX(1);
    node.scaleY(1);

    const newWidth = Math.max(20, node.width() * scaleX);
    const newHeight = Math.max(20, node.height() * scaleY);

    setRectangles(
      rectangles.map((rect) =>
        rect.id === node.id()
          ? {
              ...rect,
              x: node.x(),
              y: node.y(),
              width: newWidth,
              height: newHeight,
            }
          : rect
      )
    );
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
  }, [handleDeleteSelected]);

  const handleDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    const id = e.target.id();
    handleSelectRect(id);
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1) { // Middle mouse button
      setIsDragging(true);
      return;
    }
    handleMouseDown(e);
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isDragging) {
      const dx = e.evt.movementX;
      const dy = e.evt.movementY;
      setStagePos(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      return;
    }
    handleMouseMove(e);
  };

  const handleStageMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1) { // Middle mouse button
      setIsDragging(false);
      return;
    }
    handleMouseUp();
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

    stage.scale({ x: newScale, y: newScale });

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    stage.position(newPos);
    setStagePos(newPos);
  };

  useEffect(() => {
    if (imageToRender && stageRef.current) {
      const scaleX = stageRef.current.width() / imageDimensions.width;
      const scaleY = stageRef.current.height() / imageDimensions.height;
      setScale(Math.min(scaleX, scaleY));
    }
  }, [imageToRender, imageDimensions]);

  if (!imageLoaded) {
    return <div>Loading image...</div>;
  }

  return (
    <Stage
      width={imageDimensions.width}
      height={imageDimensions.height}
      onMouseDown={handleStageMouseDown}
      onMouseMove={handleStageMouseMove}
      onMouseUp={handleStageMouseUp}
      onWheel={handleWheel}
      ref={stageRef}
      tabIndex={1}
      x={stagePos.x}
      y={stagePos.y}
      draggable={false}
    >
      <Layer>
        <KonvaImage
          image={imageToRender}
          width={imageDimensions.width}
          height={imageDimensions.height}
        />
        {rectangles.map((rect) => {
          const { id, ...rectProps } = rect;
          return (
            <Rect
              key={id}
              id={id}
              {...rectProps}
              stroke="white"
              strokeWidth={2}
              draggable={true}  // Always allow dragging
              onClick={() => handleSelectRect(id)}
              onDragStart={handleDragStart}
              onDragEnd={(e) => handleDragEnd(e, id)}
              onTransformEnd={handleTransformEnd}
            />
          );
        })}
        {inferenceBoxes.map((box) => (
          <React.Fragment key={box.id}>
            <Rect
              x={box.x * scale}
              y={box.y * scale}
              width={box.width * scale}
              height={box.height * scale}
              stroke="red"
              strokeWidth={2 / scale}
            />
            <Text
              x={box.x * scale}
              y={(box.y * scale) - (20 / scale)}
              text={`${box.class} (${(box.confidence * 100).toFixed(2)}%)`}
              fontSize={12 / scale}
              fill="white"
            />
          </React.Fragment>
        ))}
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Limit resize
            if (newBox.width < 20 || newBox.height < 20) {
              return oldBox;
            }
            return newBox;
          }}
          rotateEnabled={false} // Disable rotation
          keepRatio={false} // Allow non-uniform scaling
        />
      </Layer>
    </Stage>
  );
}

export default KonvaCanvas;