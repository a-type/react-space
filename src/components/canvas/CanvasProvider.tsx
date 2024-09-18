import { createContext, useContext, useState } from 'react';
import { Canvas, CanvasConfig } from '../../logic/Canvas.js';
import { Viewport } from '../../logic/Viewport.js';

// A 'default' implementation of CanvasContext which essentially does nothing,
// might assist in easier isolated rendering of canvas-dependent components
const dummyCanvas = new Canvas({
	viewport: new Viewport({}),
});

const CanvasContext = createContext<Canvas>(dummyCanvas);
export const CanvasProvider = CanvasContext.Provider;

export function useCreateCanvas(options: CanvasConfig) {
	return useState(() => new Canvas(options))[0];
}

export const useCanvas = () => useContext(CanvasContext);
